import { describe, expect, it } from 'vitest';
import type { GameState } from '../engine/types';
import { MAX_OPPONENT_BALANCE, MIN_OPPONENT_BALANCE } from '../lib/opponentBalance';
import { createSoloProfile, settleSoloRound, SOLO_BALANCE, SOLO_USER_ID } from '../lib/soloPlay';

const ended = (winner: 'human' | 'computer', amount: number, gameUuid = 'round-1') => ({
  phase: 'round-ended',
  winner,
  gameUuid,
  settlement: { displayAmount: amount }
}) as GameState;

describe('혼자 플레이 정산', () => {
  it('잔액이 0냥이면 다시 접속해도 자동으로 채우지 않는다', () => {
    expect(createSoloProfile({
      id: SOLO_USER_ID,
      username: 'solo',
      displayName: '나',
      role: 'member',
      virtualBalance: 0,
      opponentBalance: 0
    }).virtualBalance).toBe(0);
  });

  it('저장된 계정이 없으면 로컬 혼자 플레이 계정을 만든다', () => {
    const created = createSoloProfile(null, () => 0);
    expect(created).toMatchObject({
      id: SOLO_USER_ID,
      displayName: '나',
      virtualBalance: SOLO_BALANCE,
      opponentBalance: MIN_OPPONENT_BALANCE
    });
    expect(createSoloProfile(null, () => 1 - Number.EPSILON).opponentBalance).toBe(MAX_OPPONENT_BALANCE);
  });

  it('이기면 게임머니가 늘고 같은 판은 다시 정산하지 않는다', () => {
    const first = settleSoloRound(createSoloProfile(null), ended('human', 3000));
    expect(first?.transfer.amount).toBe(3000);
    expect(first?.profile.virtualBalance).toBe(SOLO_BALANCE + 3000);
    expect(settleSoloRound(first!.profile, ended('human', 3000))).toBeNull();
  });

  it('지면 게임머니가 줄고, 이긴 뒤 상대 잔액이 비면 다시 채운다', () => {
    const broke = settleSoloRound(createSoloProfile(null), ended('computer', 4000, 'round-2'));
    expect(broke?.profile.virtualBalance).toBe(SOLO_BALANCE - 4000);
    const drained = settleSoloRound({ ...createSoloProfile(null, () => 0), opponentBalance: 1000 }, ended('human', 4000, 'round-3'), () => 0);
    expect(drained?.profile.opponentBalance).toBe(MIN_OPPONENT_BALANCE);
    expect(drained?.transfer.computerRefillAfter).toBe(MIN_OPPONENT_BALANCE);
    const kept = createSoloProfile({
      id: SOLO_USER_ID,
      username: 'solo',
      displayName: '나',
      role: 'member',
      virtualBalance: 480_800,
      opponentBalance: 12_345
    }, () => 0);
    expect(kept.virtualBalance).toBe(480_800);
    expect(kept.opponentBalance).toBe(12_345);
  });
});
