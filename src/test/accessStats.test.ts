import { describe, expect, it } from 'vitest';
import { visitBaseline, visitTotal } from '../../server/accessDb.mjs';
import { averageDurationMs, buildAccessReport, formatDuration, maxConcurrent, normalizeIp, peopleStats, playList, trackSession } from '../../server/accessStats.mjs';

describe('접속 그래프', () => {
  it('같은 접속은 이어 붙이고 아이피만 정리한다', () => {
    const sessions: { visitorId: string; ip: string; startedAt: number; lastSeen: number }[] = [];
    trackSession(sessions, { visitorId: 'a', ip: '::ffff:203.0.113.4', now: 1_000 });
    trackSession(sessions, { visitorId: 'a', ip: '203.0.113.9', now: 50_000 });
    trackSession(sessions, { visitorId: 'a', ip: '203.0.113.9', now: 200_000 });
    expect(normalizeIp('::ffff:203.0.113.4')).toBe('203.0.113.4');
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ ip: '203.0.113.9', startedAt: 1_000, lastSeen: 50_000 });
  });

  it('평균 접속 시간, 동시 최대, 개인별 접속 수를 계산한다', () => {
    const sessions = [
      { visitorId: 'a', ip: '203.0.113.4', startedAt: 0, lastSeen: 60_000 },
      { visitorId: 'b', ip: '203.0.113.5', startedAt: 10_000, lastSeen: 40_000 },
      { visitorId: 'a', ip: '198.51.100.7', startedAt: 120_000, lastSeen: 180_000 }
    ];
    expect(maxConcurrent(sessions)).toBe(2);
    expect(averageDurationMs(sessions)).toBe(50_000);
    expect(formatDuration(50_000)).toBe('50초');
    expect(formatDuration(90_000)).toBe('1분 30초');
    expect(peopleStats(sessions)).toEqual([
      { visitorId: 'a', visits: 2, ips: ['203.0.113.4', '198.51.100.7'], averageMs: 60_000 },
      { visitorId: 'b', visits: 1, ips: ['203.0.113.5'], averageMs: 30_000 }
    ]);
    const report = buildAccessReport(sessions, [{ recordedAt: 10_000, current: 3 }], 180_000);
    expect(report.maxConcurrent).toBe(3);
    expect(report.series).toEqual([{ at: 10_000, current: 3 }]);
  });

  it('파일에만 있던 누적 접속을 데이터베이스 기준값으로 옮긴다', () => {
    expect(visitBaseline(103, 18)).toBe(85);
    expect(visitTotal(85, 18)).toBe(103);
    expect(visitTotal(85, 19)).toBe(104);
    expect(visitBaseline(10, 12)).toBe(0);
  });

  it('최근 8일을 아이피별 접속자 수로 만든다', () => {
    const now = 10 * 24 * 60 * 60 * 1000;
    const within = now - 2 * 24 * 60 * 60 * 1000;
    const old = now - 9 * 24 * 60 * 60 * 1000;
    const sessions = [
      { visitorId: 'a', ip: '203.0.113.4', startedAt: within, lastSeen: within },
      { visitorId: 'b', ip: '203.0.113.4', startedAt: within, lastSeen: within },
      { visitorId: 'a', ip: '203.0.113.4', startedAt: within + 1000, lastSeen: within + 1000 },
      { visitorId: 'c', ip: '198.51.100.8', startedAt: within, lastSeen: within },
      { visitorId: 'd', ip: '203.0.113.9', startedAt: old, lastSeen: old },
      { visitorId: 'e', ip: 'unknown', startedAt: within, lastSeen: within }
    ];
    expect(playList(sessions, now)).toEqual([
      '2명:203.0.113.4',
      '1명:198.51.100.8',
      '1명:알 수 없음'
    ]);
  });
});