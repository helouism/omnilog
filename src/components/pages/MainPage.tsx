import { useEffect } from 'react';
import { LandingView } from '../landing/LandingView';
import { AnalysisWorkspace } from './AnalysisWorkspace';
import type { AnalyticsState } from '../../hooks/useLogAnalytics';

interface Props {
  state: AnalyticsState;
  processFile: (file: File) => void;
  reset: () => void;
}

export function MainPage({ state, processFile, reset }: Props) {
  useEffect(() => {
    document.title = 'OmniLog Analytics Engine — Browser-Based Log Analysis';
  }, []);

  return (
    <div className="flex-grow-1 d-flex flex-column overflow-hidden">
      {state.status === 'idle' ? (
        <LandingView onFile={processFile} />
      ) : (
        <AnalysisWorkspace state={state} reset={reset} />
      )}
    </div>
  );
}
