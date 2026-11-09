const key = (id: string) => 'rl-draft:' + id;
export interface DraftEnvelope<T> { savedAt: number; data: T }

export function saveDraft<T>(id: string, data: T, now = Date.now()): void {
  try { localStorage.setItem(key(id), JSON.stringify({ savedAt: now, data } satisfies DraftEnvelope<T>)); } catch { /* quota/private mode: ignore */ }
}
export function loadDraft<T>(id: string): DraftEnvelope<T> | null {
  try {
    const raw = localStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as DraftEnvelope<T>) : null;
  } catch { return null; }
}
export function clearDraft(id: string): void {
  try { localStorage.removeItem(key(id)); } catch { /* ignore */ }
}
