import { describe, expect, it } from 'vitest';
import { drawnMatchFlight, floorStackBehindOffset, groupFloorCardsByMonth, matchFlightOnFloor } from '../lib/floorStack';

describe('바닥 짝패 겹침', () => {
  it('같은 월은 한 묶음으로 모으고 먼저 나온 패가 앞에 남는다', () => {
    expect(groupFloorCardsByMonth(['m03-03', 'm05-01', 'm03-04', 'm08-01'])).toEqual([
      ['m03-03', 'm03-04'],
      ['m05-01'],
      ['m08-01']
    ]);
  });

  it('뒤에 겹치는 패는 중앙이 아니라 대각선으로 비껴 난다', () => {
    expect(floorStackBehindOffset(1)).toEqual({ x: 46, y: -38, rotate: -15 });
    expect(floorStackBehindOffset(2)).toEqual({ x: -42, y: -32, rotate: 13 });
  });

  it('낸 패는 같은 월 바닥패 위로 향한다', () => {
    expect(matchFlightOnFloor(['m02-01', 'm03-03', 'm03-04'], 'm03-01')).toEqual({
      cardId: 'm03-03',
      offset: floorStackBehindOffset(2)
    });
    expect(matchFlightOnFloor(['m02-01'], 'm05-01')).toBeNull();
  });

  it('뒤집은 패도 남아 있는 짝 위로 향하고 쪽은 바닥 칸을 만들지 않는다', () => {
    expect(drawnMatchFlight(['m03-03', 'm05-02'], 'm04-01', 'm05-01')).toEqual({
      cardId: 'm05-02',
      offset: floorStackBehindOffset(1)
    });
    expect(drawnMatchFlight(['m03-03'], 'm03-01', 'm03-02')).toEqual({
      cardId: 'm03-03',
      offset: floorStackBehindOffset(2)
    });
    expect(drawnMatchFlight(['m05-01'], 'm03-01', 'm03-02')).toBeNull();
  });
});
