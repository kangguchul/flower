import { getCard } from '../engine/cards';
import { getMatchingFloorCards } from '../engine/gameState';

export interface FloorStackOffset {
  x: number;
  y: number;
  rotate: number;
}

const BEHIND_OFFSETS: readonly FloorStackOffset[] = [
  { x: 46, y: -38, rotate: -15 },
  { x: -42, y: -32, rotate: 13 },
  { x: 24, y: -54, rotate: -8 }
];

export function groupFloorCardsByMonth(cardIds: readonly string[]): string[][] {
  const groups: string[][] = [];
  const indexByMonth = new Map<number, number>();
  for (const cardId of cardIds) {
    const month = getCard(cardId)?.month ?? 0;
    const existing = indexByMonth.get(month);
    if (existing === undefined) {
      indexByMonth.set(month, groups.length);
      groups.push([cardId]);
    } else groups[existing].push(cardId);
  }
  return groups;
}

export function floorStackBehindOffset(index: number): FloorStackOffset {
  return BEHIND_OFFSETS[Math.min(Math.max(index, 1), BEHIND_OFFSETS.length) - 1];
}

export function nextTableDrawId(drawPile: readonly string[]): string | null {
  return drawPile.find(cardId => !getCard(cardId)?.tags.includes('bonus-pee')) ?? null;
}

export function matchFlightOnFloor(floorCardIds: readonly string[], cardId: string): { cardId: string; offset: FloorStackOffset } | null {
  const matches = getMatchingFloorCards([...floorCardIds], cardId);
  if (matches.length === 0) return null;
  return { cardId: matches[0], offset: floorStackBehindOffset(matches.length) };
}

export function drawnMatchFlight(
  floorCardIds: readonly string[],
  playedCardId: string,
  drawnCardId: string | null,
  preferredPlayedId?: string
): { cardId: string; offset: FloorStackOffset } | null {
  if (!drawnCardId || getCard(drawnCardId)?.tags.includes('bonus-pee')) return null;
  const playedMatches = getMatchingFloorCards([...floorCardIds], playedCardId);
  const sameMonth = getCard(drawnCardId)?.month === getCard(playedCardId)?.month;
  if (playedMatches.length === 1 && sameMonth) {
    return { cardId: playedMatches[0], offset: floorStackBehindOffset(playedMatches.length + 1) };
  }
  let remaining = [...floorCardIds];
  if (playedMatches.length > 0) {
    const selected = playedMatches.length === 2
      ? [preferredPlayedId && playedMatches.includes(preferredPlayedId) ? preferredPlayedId : playedMatches[0]]
      : [...playedMatches];
    const selectedIds = new Set(selected);
    remaining = remaining.filter(cardId => !selectedIds.has(cardId));
  }
  const drawMatches = getMatchingFloorCards(remaining, drawnCardId).filter(cardId => floorCardIds.includes(cardId));
  if (drawMatches.length === 0) return null;
  return { cardId: drawMatches[0], offset: floorStackBehindOffset(drawMatches.length) };
}
