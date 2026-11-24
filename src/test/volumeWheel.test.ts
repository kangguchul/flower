import { describe, expect, it } from 'vitest';
import { applyVolumeWheel } from '../lib/volumeWheel';

describe('마우스 휠 음량', () => {
  it('휠을 올리면 5% 커지고 내리면 5% 작아진다', () => {
    expect(applyVolumeWheel(0.28, -100)).toEqual({ volume: 0.33, pending: 0 });
    expect(applyVolumeWheel(0.28, 100)).toEqual({ volume: 0.23, pending: 0 });
  });

  it('한 칸이 되기 전의 작은 움직임은 모아 두었다가 한 번에 반영한다', () => {
    const first = applyVolumeWheel(0.4, -40);
    expect(first).toEqual({ volume: 0.4, pending: -40 });
    expect(applyVolumeWheel(first.volume, -60, first.pending)).toEqual({ volume: 0.45, pending: 0 });
  });

  it('0%와 100%를 넘기지 않고 반대 방향으로는 바로 반응한다', () => {
    expect(applyVolumeWheel(1, -100)).toEqual({ volume: 1, pending: 0 });
    expect(applyVolumeWheel(0, 100)).toEqual({ volume: 0, pending: 0 });
    expect(applyVolumeWheel(0.98, -100)).toEqual({ volume: 1, pending: 0 });
  });
});
