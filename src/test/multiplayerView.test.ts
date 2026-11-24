import { describe, expect, it } from 'vitest';
import { createInitialGame } from '../engine/gameState';
import { applyGuestAction, viewForSeat } from '../lib/multiplayerView';

describe('같이 하기 화면과 수', () => {
  it('손님에게는 방장 패와 더미 순서를 보여주지 않고 손님 패를 아래에 둔다', () => {
    const state = createInitialGame(11, 'normal', 100, 'human');
    const guest = viewForSeat(state, 'guest');
    expect(guest.humanHand).toEqual(state.computerHand);
    expect(guest.computerHand.every(cardId => cardId.startsWith('hidden-'))).toBe(true);
    expect(guest.drawPile.every(cardId => cardId.startsWith('deck-'))).toBe(true);
    expect(guest.humanHand.some(cardId => state.humanHand.includes(cardId))).toBe(false);
    expect(guest.currentPlayer).toBe(state.currentPlayer === 'human' ? 'computer' : 'human');
  });

  it('손님의 패 내기는 컴퓨터 자리 규칙으로 적용된다', () => {
    let state = createInitialGame(3, 'normal', 100, 'computer');
    for (let seed = 3; state.phase !== 'playing' && seed < 40; seed += 1) {
      state = createInitialGame(seed, 'normal', 100, 'computer');
    }
    expect(state.phase).toBe('playing');
    const cardId = state.computerHand[0];
    const applied = applyGuestAction(state, { kind: 'play', cardId });
    expect(applied.type === 'state' || applied.type === 'choice').toBe(true);
    if (applied.type === 'state') expect(applied.state.computerHand).not.toContain(cardId);
    if (applied.type === 'choice') expect(applied.choice.candidateIds.length).toBe(2);
  });
});
