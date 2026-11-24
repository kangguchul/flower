import { describe, expect, it, vi } from 'vitest';
import { syncScreenWakeLock } from '../lib/screenWakeLock';

describe('화면 켜 두기', () => {
  it('화면이 보이는 동안 잠금을 잡고 끝나면 풀어 준다', async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release }));
    const held = await syncScreenWakeLock(true, null, { request });
    expect(request).toHaveBeenCalledWith('screen');
    expect(held).toEqual({ release });
    expect(await syncScreenWakeLock(false, held, { request })).toBeNull();
    expect(release).toHaveBeenCalledOnce();
  });

  it('화면 잠금 API가 없어도 게임은 계속된다', async () => {
    expect(await syncScreenWakeLock(true, null, null)).toBeNull();
  });

  it('이미 풀린 잠금은 다시 요청한다', async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ release, released: false }));
    const held = await syncScreenWakeLock(true, { release, released: true }, { request });
    expect(request).toHaveBeenCalledWith('screen');
    expect(held?.released).toBe(false);
  });
});
