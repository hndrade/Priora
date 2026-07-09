import { supabase } from './supabase';

/**
 * Offline-first mutation queue.
 *
 * Every write goes through `pushOp`. When online, the op executes against
 * Supabase immediately; when offline (or on a network failure) it is queued
 * in localStorage and replayed in order once connectivity returns. All row
 * ids are generated client-side, so inserts/updates/deletes compose safely
 * while offline. The UI always updates optimistically from the stores.
 */

export interface PendingOp {
  id: string;
  table: string;
  kind: 'insert' | 'update' | 'delete';
  /** row payload for insert/update; for update/delete `rowId` selects the row */
  payload?: Record<string, unknown>;
  rowId?: string;
  queuedAt: number;
}

const QUEUE_KEY = 'priora-pending-ops';

function readQueue(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notifyListeners();
}

type QueueListener = (pendingCount: number, syncing: boolean) => void;
const listeners = new Set<QueueListener>();
let syncing = false;

function notifyListeners() {
  const count = readQueue().length;
  listeners.forEach((l) => l(count, syncing));
}

export function onQueueChange(listener: QueueListener): () => void {
  listeners.add(listener);
  listener(readQueue().length, syncing);
  return () => listeners.delete(listener);
}

async function execOp(op: PendingOp): Promise<void> {
  if (op.kind === 'insert') {
    const { error } = await supabase.from(op.table).upsert(op.payload!);
    if (error) throw error;
  } else if (op.kind === 'update') {
    const { error } = await supabase.from(op.table).update(op.payload!).eq('id', op.rowId!);
    if (error) throw error;
  } else {
    const { error } = await supabase.from(op.table).delete().eq('id', op.rowId!);
    if (error) throw error;
  }
}

function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return /fetch|network|failed to|timeout|abort/i.test(msg);
}

export async function pushOp(op: Omit<PendingOp, 'id' | 'queuedAt'>): Promise<void> {
  const full: PendingOp = { ...op, id: crypto.randomUUID(), queuedAt: Date.now() };
  const queue = readQueue();
  if (!navigator.onLine || queue.length > 0) {
    // Preserve ordering: if anything is already queued, queue behind it.
    writeQueue([...queue, full]);
    if (navigator.onLine) void flushQueue();
    return;
  }
  try {
    await execOp(full);
  } catch (e) {
    if (isNetworkError(e)) {
      writeQueue([...readQueue(), full]);
    } else {
      // Permission/constraint errors are surfaced but not retried forever.
      console.error('[priora] mutation rejected by server:', e);
      throw e;
    }
  }
}

export async function flushQueue(): Promise<void> {
  if (syncing || !navigator.onLine) return;
  syncing = true;
  notifyListeners();
  try {
    let queue = readQueue();
    while (queue.length > 0) {
      const [head, ...rest] = queue;
      try {
        await execOp(head);
      } catch (e) {
        if (isNetworkError(e)) return; // still offline; retry later
        console.error('[priora] dropping unsyncable op:', head, e);
      }
      writeQueue(rest);
      queue = readQueue();
    }
  } finally {
    syncing = false;
    notifyListeners();
  }
}

export function initOfflineSync() {
  window.addEventListener('online', () => void flushQueue());
  void flushQueue();
}
