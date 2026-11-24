import { mkdir, readFile, rm, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const BOARD_NAME_LIMIT = 20;
export const BOARD_BODY_LIMIT = 500;
export const BOARD_POST_LIMIT = 100;

export function cleanBoardText(value, limit) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

export function createBoardPost(input, now = Date.now(), id = `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`) {
  const body = cleanBoardText(input?.body, BOARD_BODY_LIMIT);
  if (!body) return null;
  const name = cleanBoardText(input?.name, BOARD_NAME_LIMIT) || '손님';
  return { id, name, body, createdAt: now };
}

export function prependBoardPost(posts, post, limit = BOARD_POST_LIMIT) {
  const kept = Array.isArray(posts) ? posts.filter(item => item && item.id !== post.id) : [];
  return [post, ...kept].slice(0, limit);
}

function boardRow(row) {
  return {
    id: String(row.id),
    name: String(row.name),
    body: String(row.body),
    createdAt: Number(row.createdAt)
  };
}

export function createQueryBoardStore(query, limit = BOARD_POST_LIMIT) {
  const keep = Number.isInteger(limit) && limit > 0 ? limit : BOARD_POST_LIMIT;
  let chain = Promise.resolve();
  const enqueue = task => {
    const run = chain.then(task);
    chain = run.then(() => undefined, () => undefined);
    return run;
  };
  return {
    list() {
      return enqueue(async () => {
        const rows = await query(
          `SELECT id, name, body, created_at AS createdAt FROM board_posts ORDER BY created_at DESC, id DESC LIMIT ${keep}`
        );
        return (Array.isArray(rows) ? rows : []).map(boardRow);
      });
    },
    add(input, now = Date.now()) {
      return enqueue(async () => {
        const post = createBoardPost(input, now);
        if (!post) return null;
        await query(
          'INSERT INTO board_posts (id, name, body, created_at) VALUES (?, ?, ?, ?)',
          [post.id, post.name, post.body, post.createdAt]
        );
        await query(
          `DELETE FROM board_posts WHERE id NOT IN (
            SELECT id FROM (
              SELECT id FROM board_posts ORDER BY created_at DESC, id DESC LIMIT ${keep}
            ) AS kept
          )`
        );
        return { ...post };
      });
    }
  };
}

export function createBoardStore(file) {
  let posts = [];
  let ready = null;
  let chain = Promise.resolve();

  function ensureLoaded() {
    if (!ready) {
      ready = readFile(file, 'utf8').then(text => {
        const saved = JSON.parse(text);
        posts = Array.isArray(saved?.posts) ? saved.posts.filter(item => item && typeof item.body === 'string' && typeof item.id === 'string') : [];
      }).catch(error => {
        if (error?.code !== 'ENOENT') throw error;
        posts = [];
      });
    }
    return ready;
  }

  async function persist() {
    const temporary = `${file}.${process.pid}.tmp`;
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(temporary, JSON.stringify({ posts }));
    await rm(file, { force: true });
    await rename(temporary, file);
  }

  return {
    list() {
      const run = chain.then(async () => {
        await ensureLoaded();
        return posts.map(post => ({ ...post }));
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
    add(input, now = Date.now()) {
      const run = chain.then(async () => {
        await ensureLoaded();
        const post = createBoardPost(input, now);
        if (!post) return null;
        posts = prependBoardPost(posts, post);
        await persist();
        return { ...post };
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    }
  };
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', chunk => {
      size += chunk.length;
      if (size > 8192) {
        reject(new Error('body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      }
      catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

export function handleBoardRequest(store, request, response) {
  if (request.method === 'GET') {
    store.list().then(posts => {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.setHeader('cache-control', 'no-store');
      response.end(JSON.stringify({ posts }));
    }).catch(() => {
      if (response.writableEnded) return;
      response.statusCode = 500;
      response.end();
    });
    return;
  }
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('allow', 'GET, POST');
    response.end();
    return;
  }
  readBody(request).then(async body => {
    const post = await store.add(body);
    if (!post) {
      response.statusCode = 400;
      response.end();
      return;
    }
    response.statusCode = 201;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify(post));
  }).catch(() => {
    if (response.writableEnded) return;
    response.statusCode = 400;
    response.end();
  });
}
