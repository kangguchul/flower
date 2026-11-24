import { chooseChongtong, chooseGo, chooseStop, createInitialGame, declareShake, getDrawFloorChoice, getFlipOnlyDrawChoice, nextRoundMultiplier, playBomb, playFlipOnlyTurn, playTurn, setGookjinChoice } from '../engine/gameState';
import { normalizeMatgoPointValue } from '../engine/rules/settings';
import type { GameState, PlayerId } from '../engine/types';

export type Seat = 'host' | 'guest';

export type GuestAction =
  | { kind: 'play'; cardId: string; playedMatchId?: string; drawnMatchId?: string }
  | { kind: 'shake'; month: number; cardId: string; drawnMatchId?: string }
  | { kind: 'bomb'; month: number }
  | { kind: 'flip-only'; drawnMatchId?: string }
  | { kind: 'draw-choice'; cardId: string }
  | { kind: 'go' }
  | { kind: 'stop' }
  | { kind: 'gookjin'; asDoubleJunk: boolean }
  | { kind: 'chongtong'; decision: 'continue' | 'stop' }
  | { kind: 'next'; seed: number };

export interface DrawChoiceRequest {
  drawnCardId: string;
  candidateIds: string[];
}

export type ApplyResult =
  | { type: 'state'; state: GameState }
  | { type: 'choice'; choice: DrawChoiceRequest; pending: GuestAction };

const GUEST: PlayerId = 'computer';

const swapPlayer = (player: PlayerId | null): PlayerId | null =>
  player === 'human' ? 'computer' : player === 'computer' ? 'human' : player;

function swapSides(state: GameState): GameState {
  const next = structuredClone(state);
  const pairs = [
    ['humanHand', 'computerHand'],
    ['humanCaptured', 'computerCaptured'],
    ['humanGoCount', 'computerGoCount'],
    ['humanScoreAtLastGo', 'computerScoreAtLastGo'],
    ['humanPpeokCount', 'computerPpeokCount'],
    ['humanOpeningPpeokCount', 'computerOpeningPpeokCount'],
    ['humanSweepCount', 'computerSweepCount'],
    ['humanBombSkips', 'computerBombSkips'],
    ['humanShakeCount', 'computerShakeCount'],
    ['humanBombCount', 'computerBombCount'],
    ['humanShakenMonths', 'computerShakenMonths'],
    ['humanPendingShakeMonth', 'computerPendingShakeMonth'],
    ['humanGookjinAsDoubleJunk', 'computerGookjinAsDoubleJunk']
  ] as const;
  for (const [left, right] of pairs) {
    const current = next[left] as GameState[typeof left];
    next[left] = next[right] as never;
    next[right] = current as never;
  }
  next.currentPlayer = swapPlayer(next.currentPlayer) ?? next.currentPlayer;
  next.startingPlayer = next.startingPlayer ? swapPlayer(next.startingPlayer) ?? undefined : next.startingPlayer;
  next.pendingDecision = swapPlayer(next.pendingDecision);
  next.winner = swapPlayer(next.winner);
  next.lastDiscardedBy = next.lastDiscardedBy ? swapPlayer(next.lastDiscardedBy) : next.lastDiscardedBy;
  next.chongtongOwner = swapPlayer(next.chongtongOwner);
  next.ppeokPiles = next.ppeokPiles?.map(pile => ({ ...pile, owner: swapPlayer(pile.owner) ?? pile.owner }));
  return next;
}

function hideHandAndDeck(state: GameState, player: 'human' | 'computer'): GameState {
  const next = structuredClone(state);
  const key = player === 'human' ? 'humanHand' : 'computerHand';
  next[key] = next[key].map((_, index) => `hidden-${player}-${index}`);
  next.drawPile = next.drawPile.map((_, index) => `deck-${index}`);
  return next;
}

export function viewForSeat(state: GameState, seat: Seat): GameState {
  if (seat === 'host') return state;
  return swapSides(hideHandAndDeck(state, 'human'));
}

function playFromGuest(state: GameState, action: Extract<GuestAction, { kind: 'play' | 'shake' | 'flip-only' }>): GameState {
  if (action.kind === 'shake') {
    const shaken = declareShake(state, GUEST, action.month);
    return playTurn(shaken, GUEST, action.cardId, { drawnMatchId: action.drawnMatchId }).state;
  }
  if (action.kind === 'flip-only') return playFlipOnlyTurn(state, GUEST, action.drawnMatchId).state;
  return playTurn(state, GUEST, action.cardId, { playedMatchId: action.playedMatchId, drawnMatchId: action.drawnMatchId }).state;
}

function choiceFor(state: GameState, action: GuestAction): DrawChoiceRequest | null {
  if (action.kind === 'play' && !action.drawnMatchId) {
    const choice = getDrawFloorChoice(state, action.cardId, action.playedMatchId);
    return choice ? { drawnCardId: choice.drawnCardId, candidateIds: choice.candidateIds } : null;
  }
  if (action.kind === 'shake' && !action.drawnMatchId) {
    const shaken = declareShake(state, GUEST, action.month);
    const choice = getDrawFloorChoice(shaken, action.cardId);
    return choice ? { drawnCardId: choice.drawnCardId, candidateIds: choice.candidateIds } : null;
  }
  if (action.kind === 'flip-only' && !action.drawnMatchId) {
    const choice = getFlipOnlyDrawChoice(state);
    return choice ? { drawnCardId: choice.drawnCardId, candidateIds: choice.candidateIds } : null;
  }
  return null;
}

export function applyGuestAction(state: GameState, action: GuestAction, pending: GuestAction | null = null): ApplyResult {
  if (action.kind === 'draw-choice') {
    if (!pending || (pending.kind !== 'play' && pending.kind !== 'shake' && pending.kind !== 'flip-only')) {
      return { type: 'state', state };
    }
    return { type: 'state', state: playFromGuest(state, { ...pending, drawnMatchId: action.cardId }) };
  }
  if (action.kind === 'next') {
    if (state.phase !== 'round-ended') return { type: 'state', state };
    const starter = state.winner ?? state.startingPlayer;
    return {
      type: 'state',
      state: createInitialGame(action.seed, state.computerDifficulty ?? 'normal', normalizeMatgoPointValue(state.pointValue), starter, nextRoundMultiplier(state.roundResult, state.roundMultiplier))
    };
  }
  if (action.kind === 'go') return { type: 'state', state: chooseGo(state, GUEST) };
  if (action.kind === 'stop') return { type: 'state', state: chooseStop(state, GUEST) };
  if (action.kind === 'gookjin') return { type: 'state', state: setGookjinChoice(state, GUEST, action.asDoubleJunk) };
  if (action.kind === 'chongtong') return { type: 'state', state: chooseChongtong(state, GUEST, action.decision) };
  if (action.kind === 'bomb') return { type: 'state', state: playBomb(state, GUEST, action.month).state };
  const choice = choiceFor(state, action);
  if (choice && (action.kind === 'play' || action.kind === 'shake' || action.kind === 'flip-only')) {
    return { type: 'choice', choice, pending: action };
  }
  if (action.kind === 'play' || action.kind === 'shake' || action.kind === 'flip-only') {
    return { type: 'state', state: playFromGuest(state, action) };
  }
  return { type: 'state', state };
}
