export const MANUAL_IDLE_MS = 60_000;

export function manualIdleKey(input: {
  started: boolean;
  autoPlay: boolean;
  multiplayer: boolean;
  dealing: boolean;
  menuOpen: boolean;
  phase: string;
  currentPlayer: string;
  pendingDecision: string | null;
  turnNumber: number;
  choosing: boolean;
}) {
  if (!input.started || input.autoPlay || input.multiplayer || input.dealing || input.menuOpen || input.phase === 'round-ended') return '';
  if (input.phase === 'playing' && input.currentPlayer === 'human') return `play:${input.turnNumber}`;
  if (input.pendingDecision === 'human') return `decision:${input.phase}:${input.turnNumber}`;
  if (input.choosing) return `choice:${input.turnNumber}`;
  return '';
}
