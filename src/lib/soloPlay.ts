import type { MoneyTransfer } from '../components/RoundResultOverlay';
import type { GameState } from '../engine/types';
import { randomOpponentBalance } from './opponentBalance';
import type { UserProfile } from './types';

export const SOLO_USER_ID = -1;
export const SOLO_BALANCE = 500_000;
export const REFILL_RECONNECT_MESSAGE = 'generaltopics.net 이라는 웹페이지 이름을 기억하고 다시 접속하세요';

export function createSoloProfile(saved?: UserProfile | null, random: () => number = Math.random): UserProfile {
  const opponentBalance = (saved?.opponentBalance ?? 0) > 0 && saved?.opponentBalance !== SOLO_BALANCE
    ? saved.opponentBalance
    : randomOpponentBalance(random);
  if (saved?.id === SOLO_USER_ID) {
    return {
      ...saved,
      displayName: saved.displayName || '나',
      virtualBalance: saved.virtualBalance > 0 ? saved.virtualBalance : saved.virtualBalance <= 0 ? saved.virtualBalance : SOLO_BALANCE,
      opponentBalance
    };
  }
  return {
    id: SOLO_USER_ID,
    username: 'solo',
    displayName: '나',
    role: 'member',
    virtualBalance: SOLO_BALANCE,
    opponentBalance: randomOpponentBalance(random)
  };
}

export function settleSoloRound(profile: UserProfile, state: GameState, random: () => number = Math.random): { profile: UserProfile; transfer: MoneyTransfer } | null {
  if (state.phase !== 'round-ended' || !state.settlement || !state.winner) return null;
  if (profile.lastSettledGameUuid === state.gameUuid) return null;
  const amount = state.settlement.displayAmount;
  const humanDelta = state.winner === 'human' ? amount : -amount;
  const humanBefore = profile.virtualBalance;
  const computerBefore = profile.opponentBalance ?? SOLO_BALANCE;
  let computerAfter = computerBefore - humanDelta;
  let computerRefillAfter: number | undefined;
  if (computerAfter <= 0) {
    computerRefillAfter = randomOpponentBalance(random);
    computerAfter = computerRefillAfter;
  }
  return {
    profile: {
      ...profile,
      virtualBalance: humanBefore + humanDelta,
      opponentBalance: computerAfter,
      lastSettledGameUuid: state.gameUuid
    },
    transfer: {
      humanBefore,
      humanAfter: humanBefore + humanDelta,
      computerBefore,
      computerAfter,
      ...(computerRefillAfter ? { computerRefillAfter } : {}),
      amount: humanDelta,
      appliedNow: true
    }
  };
}
