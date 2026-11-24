import { useRef } from 'react';
import { randomUuid } from '../engine/random';
import type { VoiceActor } from './audio';
import { assignPlayerIndexes, hashText, playerIdProfile, type PlayerIdProfile } from './playerIds';

export type ComputerPlayerSlot = 'computerA' | 'computerB';
export interface ComputerPlayerProfile {
  name: string;
  actionLabel: string;
  icon: string;
  voiceActor: VoiceActor;
}
export type GostopComputerPlayers = Record<ComputerPlayerSlot, ComputerPlayerProfile>;

const GOSTOP_OPPONENT_SESSION_KEY = 'hwatu.gostop.opponent-session';

export const VOICE_ACTOR_NAMES: Readonly<Record<VoiceActor, string>> = Object.freeze({
  player: '사용자',
  opponent: '이정호',
  matgoFemale: '김영숙',
  gostopComputerA: '이서윤',
  gostopComputerB: '박영수',
  gostopComputerC: '최동철',
  gostopComputerD: '한서진'
});

export function voiceActorDisplayName(voiceActor: VoiceActor, userDisplayName: string): string {
  return voiceActor === 'player' ? userDisplayName : VOICE_ACTOR_NAMES[voiceActor];
}

function computerProfile(profile: PlayerIdProfile): ComputerPlayerProfile {
  return { name: profile.name, actionLabel: profile.name, icon: profile.icon, voiceActor: profile.voiceActor };
}

export const COMPUTER_PLAYERS = Object.freeze({
  computerA: computerProfile(playerIdProfile(0)),
  computerB: computerProfile(playerIdProfile(1))
});

export function gostopComputerPlayersForSession(sessionId: string, roundsPlayed = 0): GostopComputerPlayers {
  const hash = hashText(sessionId);
  const first = (hash + roundsPlayed) % 1000;
  let second = (first + 1 + ((hash >>> 8) % 998)) % 1000;
  if (second === first) second = (first + 1) % 1000;
  if (second % 6 === first % 6) second = (second + 1) % 1000;
  return {
    computerA: computerProfile(playerIdProfile(first)),
    computerB: computerProfile(playerIdProfile(second))
  };
}

export function assignGostopPlayers(seed: string, gameId: string): GostopComputerPlayers {
  const [first, second] = assignPlayerIndexes(gameId, 2, seed);
  return {
    computerA: computerProfile(playerIdProfile(first)),
    computerB: computerProfile(playerIdProfile(second))
  };
}

export function getGostopOpponentSessionId(): string {
  try {
    const stored = window.sessionStorage.getItem(GOSTOP_OPPONENT_SESSION_KEY);
    if (stored) return stored;
    const created = randomUuid();
    window.sessionStorage.setItem(GOSTOP_OPPONENT_SESSION_KEY, created);
    return created;
  }
  catch {
    return randomUuid();
  }
}

export function resetGostopOpponentSession() {
  try { window.sessionStorage.removeItem(GOSTOP_OPPONENT_SESSION_KEY); }
  catch { /* 저장소를 사용할 수 없으면 현재 화면 생명주기만 사용 */ }
}

export function useGostopComputerPlayers(): GostopComputerPlayers {
  const sessionRef = useRef<string | null>(null);
  const playersRef = useRef<GostopComputerPlayers | null>(null);
  sessionRef.current ??= getGostopOpponentSessionId();
  playersRef.current ??= assignGostopPlayers(sessionRef.current, randomUuid());
  return playersRef.current;
}

export function computerPlayerName(player: ComputerPlayerSlot, players: GostopComputerPlayers = COMPUTER_PLAYERS): string {
  return players[player].name;
}

export function computerPlayerActionLabel(player: ComputerPlayerSlot, players: GostopComputerPlayers = COMPUTER_PLAYERS): string {
  return players[player].actionLabel;
}
