import { describe, expect, it } from 'vitest';
import { formatScoreCookie, parseScoreCookie } from '../lib/scoreCookie';

describe('내 점수 쿠키', () => {
  it('일 년 동안 남는 쿠키로 자신의 점수를 저장한다', () => {
    expect(formatScoreCookie(7)).toBe('hwatu-score=7; Max-Age=31536000; Path=/; SameSite=Lax');
    expect(formatScoreCookie(12, true)).toContain('; Secure');
    expect(parseScoreCookie('other=1; hwatu-score=7; session=abc')).toBe(7);
  });

  it('점수가 아니면 저장값을 만들지 않는다', () => {
    expect(formatScoreCookie(-3)).toContain('hwatu-score=0;');
    expect(parseScoreCookie('hwatu-score=abc')).toBeNull();
    expect(parseScoreCookie('')).toBeNull();
  });
});
