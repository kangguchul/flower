import { describe, expect, it } from 'vitest';
import { audioContextIsBlocked } from '../lib/audioContextState';

describe('소리 장치 상태', () => {
  it('멈춤과 끼어듦은 다시 켜야 하고 재생 중은 그대로 둔다', () => {
    expect(audioContextIsBlocked('suspended')).toBe(true);
    expect(audioContextIsBlocked('interrupted')).toBe(true);
    expect(audioContextIsBlocked('running')).toBe(false);
    expect(audioContextIsBlocked('closed')).toBe(false);
  });
});