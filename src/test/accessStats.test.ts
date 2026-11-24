import { describe, expect, it } from 'vitest';
import { averageDurationMs, buildAccessReport, formatDuration, maxConcurrent, normalizeIp, peopleStats, trackSession } from '../../server/accessStats.mjs';

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
});