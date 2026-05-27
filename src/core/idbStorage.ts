import { openDB, type IDBPDatabase } from 'idb';
import type { IDBSession, AggregationResult, LogFormat } from '../types/log.types';

const DB_NAME = 'omnilog';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';

interface SessionRecord {
  id: string;
  fileName: string;
  fileSize: number;
  format: LogFormat;
  createdAt: string; // ISO string
  aggregation: AggregationResult;
}

let _db: IDBPDatabase | null = null;

async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
  return _db;
}

export async function saveSession(
  fileName: string,
  fileSize: number,
  aggregation: AggregationResult,
): Promise<string> {
  const db = await getDB();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record: SessionRecord = {
    id,
    fileName,
    fileSize,
    format: aggregation.format,
    createdAt: new Date().toISOString(),
    aggregation,
  };
  await db.put(STORE_SESSIONS, record);
  return id;
}

export async function listSessions(): Promise<IDBSession[]> {
  const db = await getDB();
  const records: SessionRecord[] = await db.getAllFromIndex(STORE_SESSIONS, 'createdAt');
  return records.reverse().map(r => ({
    id: r.id,
    fileName: r.fileName,
    fileSize: r.fileSize,
    format: r.format,
    createdAt: new Date(r.createdAt),
    aggregation: r.aggregation,
  }));
}

export async function getSession(id: string): Promise<IDBSession | undefined> {
  const db = await getDB();
  const r: SessionRecord | undefined = await db.get(STORE_SESSIONS, id);
  if (!r) return undefined;
  return {
    id: r.id,
    fileName: r.fileName,
    fileSize: r.fileSize,
    format: r.format,
    createdAt: new Date(r.createdAt),
    aggregation: r.aggregation,
  };
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_SESSIONS, id);
}

export async function clearAllSessions(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_SESSIONS);
}
