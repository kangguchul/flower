import type { VoiceActor } from './audio';
import { INSTAGRAM_IDS } from './instagramIds';

export const PLAYER_ID_COUNT = INSTAGRAM_IDS.length;

const VOICE_ACTORS = ['opponent', 'matgoFemale', 'gostopComputerA', 'gostopComputerB', 'gostopComputerC', 'gostopComputerD'] as const satisfies readonly VoiceActor[];
const ICONS = ['🦊', '🐱', '🐶', '🐯', '🐻', '🦋'] as const;

export interface PlayerIdProfile {
  name: string;
  voiceActor: VoiceActor;
  icon: string;
}

export function playerIdAt(index: number): string {
  const slot = ((index % PLAYER_ID_COUNT) + PLAYER_ID_COUNT) % PLAYER_ID_COUNT;
  return INSTAGRAM_IDS[slot];
}

export function playerIds(): string[] {
  return Array.from({ length: PLAYER_ID_COUNT }, (_, index) => playerIdAt(index));
}

export function playerIdProfile(index: number): PlayerIdProfile {
  const slot = ((index % PLAYER_ID_COUNT) + PLAYER_ID_COUNT) % PLAYER_ID_COUNT;
  return {
    name: playerIdAt(slot),
    voiceActor: VOICE_ACTORS[slot % VOICE_ACTORS.length],
    icon: ICONS[slot % ICONS.length]
  };
}

export function hashText(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const MIN_CONSECUTIVE_ROUNDS = 1;
export const MAX_CONSECUTIVE_ROUNDS = 10;

const ROUNDS_KEY = 'hwatu.player-id.rounds';
const GAME_KEY = 'hwatu.player-id.game';

interface MemoryStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface SavedSeat {
  seed: string;
  activeGameId: string | null;
  indexes: number[];
  count: number;
  limit: number;
  played: number;
  countedGameId: string | null;
}

export function randomConsecutiveRounds(random: () => number = Math.random): number {
  return MIN_CONSECUTIVE_ROUNDS + Math.floor(random() * (MAX_CONSECUTIVE_ROUNDS - MIN_CONSECUTIVE_ROUNDS + 1));
}

function browserStore(): MemoryStore | null {
  try {
    return window.localStorage;
  }
  catch {
    return null;
  }
}

export function assignPlayerIndexes(gameId: string, count: number, seed: string, store: MemoryStore | null = browserStore(), random: () => number = Math.random): number[] {
  const saved = readSeat(store);
  if (saved?.activeGameId === gameId && saved.indexes.length >= count) return saved.indexes.slice(0, count);
  if (saved && saved.seed === seed && saved.played < saved.limit && saved.indexes.length >= count) {
    saved.activeGameId = gameId;
    writeSeat(store, saved);
    return saved.indexes.slice(0, count);
  }
  const rounds = saved && saved.seed === seed && saved.played >= saved.limit ? readRounds(store) + 1 : readRounds(store);
  const seat = createSeat(seed, rounds, count, random);
  seat.activeGameId = gameId;
  if (saved && saved.seed === seed && saved.played >= saved.limit) store?.setItem(ROUNDS_KEY, String(rounds));
  writeSeat(store, seat);
  return seat.indexes.slice(0, count);
}

export function seatNextUser(seed: string, count: number, store: MemoryStore | null = browserStore(), random: () => number = Math.random): { leftName: string; nextName: string; indexes: number[] } {
  const saved = readSeat(store);
  const leftName = saved?.indexes.length ? playerIdAt(saved.indexes[0]) : '';
  const rounds = readRounds(store) + (saved ? 1 : 0);
  if (saved) store?.setItem(ROUNDS_KEY, String(rounds));
  const seat = createSeat(seed, rounds, count, random);
  writeSeat(store, seat);
  return { leftName, nextName: playerIdAt(seat.indexes[0]), indexes: seat.indexes };
}

export function finishPlayerSeat(store: MemoryStore | null = browserStore(), random: () => number = Math.random): { leaving: boolean; leftName: string; nextName: string } {
  const saved = readSeat(store);
  if (!saved?.activeGameId || saved.countedGameId === saved.activeGameId) return { leaving: false, leftName: '', nextName: '' };
  saved.played += 1;
  saved.countedGameId = saved.activeGameId;
  saved.activeGameId = null;
  if (saved.played < saved.limit) {
    writeSeat(store, saved);
    return { leaving: false, leftName: '', nextName: '' };
  }
  const leftName = playerIdAt(saved.indexes[0]);
  const rounds = readRounds(store) + 1;
  store?.setItem(ROUNDS_KEY, String(rounds));
  const next = createSeat(saved.seed, rounds, saved.count, random);
  writeSeat(store, next);
  return { leaving: true, leftName, nextName: playerIdAt(next.indexes[0]) };
}

function createSeat(seed: string, rounds: number, count: number, random: () => number): SavedSeat {
  const start = (hashText(seed) + rounds) % PLAYER_ID_COUNT;
  const indexes: number[] = [];
  let cursor = start;
  while (indexes.length < count) {
    if (!indexes.includes(cursor)) indexes.push(cursor);
    cursor = (cursor + 1) % PLAYER_ID_COUNT;
  }
  if (count > 1 && indexes[0] % VOICE_ACTORS.length === indexes[1] % VOICE_ACTORS.length) indexes[1] = (indexes[1] + 1) % PLAYER_ID_COUNT;
  return {
    seed,
    activeGameId: null,
    indexes,
    count,
    limit: randomConsecutiveRounds(random),
    played: 0,
    countedGameId: null
  };
}

function readRounds(store: MemoryStore | null): number {
  const value = Number(store?.getItem(ROUNDS_KEY) ?? '0');
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function readSeat(store: MemoryStore | null): SavedSeat | null {
  const raw = store?.getItem(GAME_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as SavedSeat;
    if (!saved || !Array.isArray(saved.indexes) || typeof saved.seed !== 'string' || !Number.isInteger(saved.limit)) return null;
    if (saved.limit > MAX_CONSECUTIVE_ROUNDS) saved.limit = MAX_CONSECUTIVE_ROUNDS;
    return saved;
  }
  catch {
    return null;
  }
}

function writeSeat(store: MemoryStore | null, seat: SavedSeat) {
  store?.setItem(GAME_KEY, JSON.stringify(seat));
}
