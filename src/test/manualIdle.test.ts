import { describe, expect, it } from 'vitest';
import { MANUAL_IDLE_MS, manualIdleKey } from '../lib/manualIdle';

const playing = {
  started: true,
  autoPlay: false,
  multiplayer: false,
  dealing: false,
  menuOpen: false,
  phase: 'playing',
  currentPlayer: 'human',
  pendingDecision: null,
  turnNumber: 4,
  choosing: false
};

describe('수동 치기 대기', () => {
  it('내 차례가 1분이 되면 패 고르기로 돌아갈 기준이 된다', () => {
    expect(MANUAL_IDLE_MS).toBe(60_000);
    expect(manualIdleKey(playing)).toBe('play:4');
    expect(manualIdleKey({ ...playing, currentPlayer: 'computer' })).toBe('');
    expect(manualIdleKey({ ...playing, autoPlay: true })).toBe('');
    expect(manualIdleKey({ ...playing, turnNumber: 5 })).toBe('play:5');
  });

  it('고스톱 선택이나 패 고르는 중에도 기다리고, 끝난 판은 기다리지 않는다', () => {
    expect(manualIdleKey({ ...playing, phase: 'awaiting-go-stop', currentPlayer: 'computer', pendingDecision: 'human' })).toBe('decision:awaiting-go-stop:4');
    expect(manualIdleKey({ ...playing, currentPlayer: 'computer', choosing: true })).toBe('choice:4');
    expect(manualIdleKey({ ...playing, phase: 'round-ended' })).toBe('');
    expect(manualIdleKey({ ...playing, menuOpen: true })).toBe('');
  });
});