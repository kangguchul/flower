import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createBoardPost, createBoardStore, createQueryBoardStore, prependBoardPost } from '../../server/board.mjs';

describe('방문자 게시판', () => {
  it('빈 글은 거절하고 이름과 줄바꿈을 정리한다', () => {
    expect(createBoardPost({ name: '  ', body: '   ' }, 10, 'a')).toBeNull();
    expect(createBoardPost({ name: ' 길동\n', body: ' 안녕하세요 \n 문의 ' }, 10, 'a')).toEqual({
      id: 'a',
      name: '길동',
      body: '안녕하세요 문의',
      createdAt: 10
    });
  });

  it('새 글을 앞에 두고 오래된 글은 개수만큼만 남긴다', () => {
    const first = createBoardPost({ body: '하나' }, 1, '1');
    const second = createBoardPost({ body: '둘' }, 2, '2');
    expect(prependBoardPost([first], second, 1)).toEqual([second]);
  });

  it('글을 파일에 저장하고 다시 읽는다', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hwatu-board-'));
    const file = path.join(directory, 'board.json');
    try {
      const store = createBoardStore(file);
      expect(await store.add({ body: '   ' }, 1)).toBeNull();
      const saved = await store.add({ name: '손님', body: '리필이 안 됩니다' }, 2);
      expect(saved?.body).toBe('리필이 안 됩니다');
      expect(JSON.parse(await readFile(file, 'utf8')).posts).toHaveLength(1);
      const reloaded = createBoardStore(file);
      expect(await reloaded.list()).toEqual([saved]);
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('마리아디비 질의로 글을 저장하고 오래된 글을 지운다', async () => {
    const rows: { id: string; name: string; body: string; createdAt: number }[] = [];
    const query = async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('SELECT')) return rows.map(row => ({ ...row })).sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
      if (sql.startsWith('INSERT')) {
        rows.push({ id: String(params[0]), name: String(params[1]), body: String(params[2]), createdAt: Number(params[3]) });
        return { affectedRows: 1 };
      }
      const keep = rows.sort((a, b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id)).slice(0, 1).map(row => row.id);
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (!keep.includes(rows[index].id)) rows.splice(index, 1);
      }
      return { affectedRows: 1 };
    };
    const store = createQueryBoardStore(query, 1);
    expect(await store.add({ body: '   ' }, 1)).toBeNull();
    const first = await store.add({ name: '손님', body: '하나' }, 2);
    const second = await store.add({ body: '둘' }, 3);
    expect(await store.list()).toEqual([second]);
    expect(first?.id).not.toBe(second?.id);
    expect(rows).toHaveLength(1);
  });
});
