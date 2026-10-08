import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  AggregationResult,
  WorkerStatus,
  LogFormat,
  WorkerEvent,
} from '../types/log.types';
import { listSessions, saveSession } from '../core/idbStorage';

export interface AnalyticsState {
  status: WorkerStatus;
  progress: number;
  eta: number;
  linesProcessed: number;
  processedBytes: number;
  totalBytes: number;
  format: LogFormat;
  confidence: number;
  aggregation: AggregationResult | null;
  error: string | null;
  fileName: string | null;
  fileSize: number;
}

const INITIAL_STATE: AnalyticsState = {
  status: 'idle',
  progress: 0,
  eta: 0,
  linesProcessed: 0,
  processedBytes: 0,
  totalBytes: 0,
  format: 'unknown',
  confidence: 0,
  aggregation: null,
  error: null,
  fileName: null,
  fileSize: 0,
};

export function useLogAnalytics() {
  const [state, setState] = useState<AnalyticsState>(INITIAL_STATE);
  const workerRef = useRef<Worker | null>(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void listSessions().then(sessions => {
      const latest = sessions[0];
      if (cancelled || hasStartedRef.current || !latest) return;
      setState({
        ...INITIAL_STATE,
        status: 'done',
        progress: 100,
        processedBytes: latest.fileSize,
        totalBytes: latest.fileSize,
        linesProcessed: latest.aggregation.totalLines,
        format: latest.aggregation.format,
        confidence: latest.aggregation.confidence,
        aggregation: latest.aggregation,
        fileName: latest.fileName,
        fileSize: latest.fileSize,
      });
    }).catch(() => {
      // IndexedDB is optional; a blocked or unavailable store must not prevent use.
    });
    return () => { cancelled = true; };
  }, []);

  const processFile = useCallback((file: File) => {
    hasStartedRef.current = true;
    // Terminate any running worker
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    setState({
      ...INITIAL_STATE,
      status: 'sniffing',
      fileName: file.name,
      fileSize: file.size,
      totalBytes: file.size,
    });

    const worker = new Worker(
      new URL('../core/workers/logProcessor.worker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = async (e: MessageEvent<WorkerEvent>) => {
      const data = e.data;

      switch (data.type) {
        case 'sniff':
          setState(s => ({
            ...s,
            status: 'parsing',
            format: data.format,
            confidence: data.confidence,
          }));
          break;

        case 'progress':
          setState(s => ({
            ...s,
            progress: data.percent,
            eta: data.eta,
            linesProcessed: data.linesProcessed,
            processedBytes: data.processedBytes,
          }));
          break;

        case 'partial':
          setState(s => ({ ...s, aggregation: data.aggregation }));
          break;

        case 'done':
          setState(s => ({
            ...s,
            status: 'done',
            progress: 100,
            eta: 0,
            aggregation: data.aggregation,
            linesProcessed: data.aggregation.totalLines,
          }));
          // Persist to IndexedDB
          try {
            await saveSession(file.name, file.size, data.aggregation);
          } catch {
            // IDB save failure is non-critical
          }
          worker.terminate();
          workerRef.current = null;
          break;

        case 'error':
          setState(s => ({ ...s, status: 'error', error: data.message }));
          worker.terminate();
          workerRef.current = null;
          break;
      }
    };

    worker.onerror = (err) => {
      setState(s => ({ ...s, status: 'error', error: err.message }));
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ type: 'start', file });
  }, []);

  const reset = useCallback(() => {
    hasStartedRef.current = true;
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    setState(INITIAL_STATE);
  }, []);

  return { state, processFile, reset };
}
