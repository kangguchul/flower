export const MIN_OPPONENT_BALANCE = 1_000;
export const MAX_OPPONENT_BALANCE = 50_000_000;
const LEGACY_OPPONENT_BALANCE = 500_000;

export function randomOpponentBalance(random: () => number = Math.random): number {
  const span = MAX_OPPONENT_BALANCE - MIN_OPPONENT_BALANCE;
  return MIN_OPPONENT_BALANCE + Math.floor(random() * (span + 1));
}

export function opponentEntryBalance(saved: number | undefined, random: () => number = Math.random): number {
  if (saved != null && Number.isFinite(saved) && saved > 0 && saved !== LEGACY_OPPONENT_BALANCE) return saved;
  return randomOpponentBalance(random);
}

interface MemoryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStore(): MemoryStore | null {
  try {
    return window.localStorage;
  }
  catch {
    return null;
  }
}

export function migrateOpponentEntry(key: string, saved: number | undefined, random: () => number = Math.random, store: MemoryStore | null = browserStore()): number {
  if (store?.getItem(key) === '1' && saved != null && Number.isFinite(saved) && saved > 0) return saved;
  const next = randomOpponentBalance(random);
  store?.setItem(key, '1');
  return next;
}
