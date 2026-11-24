import { useEffect, useRef, useState } from 'react';
import { randomUuid } from '../engine/random';
import type { VoiceActor } from './audio';
import { assignPlayerIndexes, hashText, playerIdProfile } from './playerIds';
const MATGO_OPPONENT_SESSION_KEY = 'hwatu.matgo.opponent-session';

export interface MatgoOpponentProfile {
  name: string;
  voiceActor: VoiceActor;
}

export function opponentProfileForSession(sessionId: string, roundsPlayed = 0): MatgoOpponentProfile {
  const profile = playerIdProfile(hashText(sessionId) + roundsPlayed);
  return { name: profile.name, voiceActor: profile.voiceActor };
}

export function opponentNameForGame(gameUuid: string, roundsPlayed = 0): string {
  return opponentProfileForSession(gameUuid, roundsPlayed).name;
}

export function getMatgoOpponentSessionId(): string {
  try {
    const stored = window.sessionStorage.getItem(MATGO_OPPONENT_SESSION_KEY);
    if (stored) return stored;
    const created = randomUuid();
    window.sessionStorage.setItem(MATGO_OPPONENT_SESSION_KEY, created);
    return created;
  }
  catch {
    return randomUuid();
  }
}

export function resetMatgoOpponentSession() {
  try { window.sessionStorage.removeItem(MATGO_OPPONENT_SESSION_KEY); }
  catch { /* 저장소를 사용할 수 없으면 현재 화면 생명주기만 사용 */ }
}

export function useMatgoOpponent(gameId?: string): MatgoOpponentProfile {
  const sessionRef = useRef<string | null>(null);
  sessionRef.current ??= getMatgoOpponentSessionId();
  const [profile, setProfile] = useState<MatgoOpponentProfile>(() => opponentProfileForSession(sessionRef.current!, 0));
  useEffect(() => {
    if (!gameId) return;
    const [index] = assignPlayerIndexes(gameId, 1, sessionRef.current!);
    const next = playerIdProfile(index);
    setProfile({ name: next.name, voiceActor: next.voiceActor });
  }, [gameId]);
  return profile;
}
