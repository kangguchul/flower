import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createVisitStore, formatCountIni } from '../../server/visits.mjs';

const first = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const third = '33333333-3333-4333-8333-333333333333';

describe('누적 접속 인원', () => {
  it('같은 사람이 다시 접속해도 count.ini 숫자가 오른다', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hwatu-visits-'));
    const idsFile = path.join(directory, 'visits.json');
    const countFile = path.join(directory, 'count.ini');
    try {
      const store = createVisitStore(idsFile, countFile);
      expect(await store.record(first, '1.1.1.1', 1_000)).toEqual({ total: 1, ordinal: 1 });
      expect(await store.record(first, '1.1.1.1', 1_100)).toEqual({ total: 2, ordinal: 2 });
      expect(await store.record(second, '8.8.8.8', 1_200)).toEqual({ total: 3, ordinal: 3 });
      expect(await store.record('not-a-person', '8.8.8.8', 1_300)).toEqual({ total: 3, ordinal: null });
      expect(await readFile(countFile, 'utf8')).toBe(formatCountIni(3));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('한 주소에서 짧은 시간에 너무 많은 새 식별값은 무시한다', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hwatu-visits-'));
    const idsFile = path.join(directory, 'visits.json');
    const countFile = path.join(directory, 'count.ini');
    try {
      const store = createVisitStore(idsFile, countFile, { limit: 1, windowMs: 1_000 });
      expect(await store.record(first, '1.1.1.1', 1_000)).toEqual({ total: 1, ordinal: 1 });
      expect(await store.record(second, '1.1.1.1', 1_100)).toEqual({ total: 1, ordinal: null });
      expect(await store.record(third, '8.8.8.8', 1_100)).toEqual({ total: 2, ordinal: 2 });
      expect(await store.record(second, '1.1.1.1', 3_000)).toEqual({ total: 3, ordinal: 3 });
      expect(await readFile(countFile, 'utf8')).toBe(formatCountIni(3));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('json에 있던 숫자는 count.ini로 옮긴다', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hwatu-visits-'));
    const idsFile = path.join(directory, 'visits.json');
    const countFile = path.join(directory, 'count.ini');
    try {
      await writeFile(idsFile, JSON.stringify({ ids: [first], visits: 19 }));
      const store = createVisitStore(idsFile, countFile);
      expect(await store.record(first, '1.1.1.1')).toEqual({ total: 20, ordinal: 20 });
      expect(await readFile(countFile, 'utf8')).toBe(formatCountIni(20));
      expect(JSON.parse(await readFile(idsFile, 'utf8')).visits).toBeUndefined();
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('서버를 다시 열어도 count.ini 숫자를 이어서 센다', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hwatu-visits-'));
    const idsFile = path.join(directory, 'visits.json');
    const countFile = path.join(directory, 'count.ini');
    try {
      const firstStore = createVisitStore(idsFile, countFile);
      expect(await firstStore.record(first, '1.1.1.1')).toEqual({ total: 1, ordinal: 1 });
      const saved = JSON.parse(await readFile(idsFile, 'utf8')) as { ids: string[]; visits?: number };
      expect(saved.ids).toEqual([first]);
      expect(saved.visits).toBeUndefined();
      expect(await readFile(countFile, 'utf8')).toBe(formatCountIni(1));

      const secondStore = createVisitStore(idsFile, countFile);
      expect(await secondStore.record(first, '1.1.1.1')).toEqual({ total: 2, ordinal: 2 });
      expect(await secondStore.record(second, '8.8.8.8')).toEqual({ total: 3, ordinal: 3 });
      expect(await readFile(countFile, 'utf8')).toBe(formatCountIni(3));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('현재 접속, 오늘 접속, 누적 접속을 구분한다', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hwatu-visits-'));
    const idsFile = path.join(directory, 'visits.json');
    const countFile = path.join(directory, 'count.ini');
    const evening = Date.parse('2026-11-23T20:00:00+09:00');
    const nextDay = Date.parse('2026-11-24T00:10:00+09:00');
    try {
      const seeded = createVisitStore(idsFile, countFile, { loadToday: async () => 4 });
      const now = Date.now();
      expect(await seeded.stats(now)).toEqual({ current: 0, today: 4, total: 0 });
      expect(await seeded.record(first, '1.1.1.1', now)).toEqual({ total: 1, ordinal: 1 });
      expect(await seeded.touch(second, '203.0.113.8', now)).toBe(true);
      expect(await seeded.stats(now)).toEqual({ current: 2, today: 5, total: 1 });
      expect(await seeded.stats(now + 3 * 60 * 1000)).toEqual({ current: 0, today: 5, total: 1 });

      const days = createVisitStore(path.join(directory, 'days.json'), path.join(directory, 'days.ini'));
      expect(await days.record(first, '1.1.1.1', evening)).toEqual({ total: 1, ordinal: 1 });
      expect(await days.record(first, '1.1.1.1', nextDay)).toEqual({ total: 2, ordinal: 2 });
      expect(await days.stats(nextDay)).toEqual({ current: 1, today: 1, total: 2 });

      const fromDatabase = createVisitStore(path.join(directory, 'db.json'), path.join(directory, 'db.ini'), {
        summary: async () => ({ current: 4, today: 9, total: 103 })
      });
      expect(await fromDatabase.stats(now)).toEqual({ current: 4, today: 9, total: 103 });
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
