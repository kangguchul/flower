import { mkdir, readFile, rm, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seoulDateKey } from './accessTime.mjs';
import { trackSession } from './accessStats.mjs';

const PRESENCE_MS = 2 * 60 * 1000;

const VISITOR_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVisitorId(id) {
  return typeof id === 'string' && VISITOR_ID.test(id);
}

export function parseCountIni(text) {
  const match = /^count=(\d+)\s*$/m.exec(text);
  return match ? Number(match[1]) : null;
}

export function formatCountIni(count) {
  return `count=${count}\n`;
}

export function createVisitCounter({ limit = 30, windowMs = 60 * 60 * 1000 } = {}) {
  const ids = [];
  const bursts = new Map();

  function allowNewVisitor(ip, now) {
    const key = ip || 'unknown';
    const current = bursts.get(key);
    if (!current || now - current.started > windowMs) {
      bursts.set(key, { started: now, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }

  return {
    ids() {
      return [...ids];
    },
    load(saved) {
      const savedIds = Array.isArray(saved?.ids) ? saved.ids : [];
      for (const id of savedIds) {
        if (isVisitorId(id) && !ids.includes(id)) ids.push(id);
      }
      const savedVisits = Number(saved?.visits);
      return Number.isInteger(savedVisits) && savedVisits >= ids.length ? savedVisits : ids.length;
    },
    admit(id, ip = 'unknown', now = Date.now()) {
      if (!isVisitorId(id)) return false;
      if (!ids.includes(id)) {
        if (!allowNewVisitor(ip, now)) return false;
        ids.push(id);
      }
      return true;
    }
  };
}

export function createVisitStore(idsFile, countFile, options) {
  const counter = createVisitCounter(options);
  let ready = null;
  let chain = Promise.resolve();
  let broken = false;
  let todayKey = null;
  let todayCount = 0;
  const presence = new Map();

  function rollToday(now) {
    const key = seoulDateKey(now);
    if (todayKey !== key) {
      todayKey = key;
      todayCount = 0;
    }
  }

  function rememberPresence(id, now) {
    if (!isVisitorId(id)) return;
    presence.set(id, now);
  }

  function currentVisitors(now) {
    for (const [id, seen] of presence) {
      if (now - seen > PRESENCE_MS) presence.delete(id);
    }
    return presence.size;
  }

  function ensureLoaded() {
    if (!ready) {
      ready = (async () => {
        let saved = null;
        try {
          saved = JSON.parse(await readFile(idsFile, 'utf8'));
        }
        catch (error) {
          if (error?.code !== 'ENOENT') {
            broken = true;
            return;
          }
        }
        const seeded = counter.load(saved);
        try {
          const parsed = parseCountIni(await readFile(countFile, 'utf8'));
          if (parsed == null) throw new Error('bad count');
        }
        catch (error) {
          if (error?.code !== 'ENOENT' && error?.message !== 'bad count') {
            broken = true;
            return;
          }
          await writeCount(seeded);
        }
        if (saved && Object.hasOwn(saved, 'visits')) await persistIds();
        if (options?.loadToday) {
          try {
            const loaded = await Promise.race([
              Promise.resolve(options.loadToday(Date.now())),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
            ]);
            if (Number.isInteger(loaded) && loaded >= 0) {
              todayKey = seoulDateKey(Date.now());
              todayCount = loaded;
            }
          }
          catch { /* 오늘 접속 수는 이번 실행에서 다시 셉니다. */ }
        }
        if (options?.seedTotal) {
          try {
            await options.seedTotal(await readCount());
          }
          catch { /* 누적 수는 다음 조회에서 다시 맞춘다. */ }
        }
      })();
    }
    return ready;
  }

  async function writeCount(count) {
    const temporary = `${countFile}.${process.pid}.tmp`;
    await mkdir(path.dirname(countFile), { recursive: true });
    await writeFile(temporary, formatCountIni(count));
    await rm(countFile, { force: true });
    await rename(temporary, countFile);
  }

  async function readCount() {
    return parseCountIni(await readFile(countFile, 'utf8'));
  }

  async function persistIds() {
    const temporary = `${idsFile}.${process.pid}.tmp`;
    await mkdir(path.dirname(idsFile), { recursive: true });
    await writeFile(temporary, JSON.stringify({ ids: counter.ids() }));
    await rm(idsFile, { force: true });
    await rename(temporary, idsFile);
  }

  return {
    record(id, ip, now = Date.now()) {
      const run = chain.then(async () => {
        await ensureLoaded();
        if (broken) return null;
        const known = isVisitorId(id) && counter.ids().includes(id);
        if (!counter.admit(id, ip, now)) return { total: await readCount(), ordinal: null };
        const total = (await readCount()) + 1;
        await writeCount(total);
        if (!known) await persistIds();
        rollToday(now);
        todayCount += 1;
        rememberPresence(id, now);
        trackSession(options?.sessions, { visitorId: id, ip, now });
        if (options?.onVisit) await Promise.resolve(options.onVisit({ visitorId: id, ip, now })).catch(() => undefined);
        return { total, ordinal: total };
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
    touch(id, ip = 'unknown', now = Date.now()) {
      const run = chain.then(async () => {
        await ensureLoaded();
        if (broken || !isVisitorId(id)) return false;
        rememberPresence(id, now);
        trackSession(options?.sessions, { visitorId: id, ip, now });
        if (options?.onSession) await Promise.resolve(options.onSession({ visitorId: id, ip, now })).catch(() => undefined);
        return true;
      });
      chain = run.then(() => undefined, () => undefined);
      return run;
    },
    sessions() {
      return Array.isArray(options?.sessions) ? options.sessions.map(session => ({ ...session })) : [];
    },
    stats(now = Date.now()) {
      const run = chain.then(async () => {
        await ensureLoaded();
        if (broken) return null;
        if (options?.summary) return await options.summary(now);
        rollToday(now);
        return { current: currentVisitors(now), today: todayCount, total: await readCount() };
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
      if (size > 1024) {
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

export function clientAddress(request) {
  const cloudflare = request.headers?.['cf-connecting-ip'];
  if (typeof cloudflare === 'string' && cloudflare.trim()) return cloudflare.trim();
  return request.socket?.remoteAddress || 'unknown';
}

export function handleVisitStats(store, response) {
  store.stats().then(stats => {
    if (!stats) {
      response.statusCode = 503;
      response.end();
      return;
    }
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify(stats));
  }).catch(() => {
    if (response.writableEnded) return;
    response.statusCode = 500;
    response.end();
  });
}

export function handleVisitPresence(store, request, response) {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('allow', 'POST');
    response.end();
    return;
  }
  readBody(request).then(async body => {
    const ok = await store.touch(body?.id, clientAddress(request));
    response.statusCode = ok ? 204 : 400;
    response.end();
  }).catch(() => {
    if (response.writableEnded) return;
    response.statusCode = 400;
    response.end();
  });
}

export function handleVisitRequest(store, request, response) {
  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.setHeader('allow', 'POST');
    response.end();
    return;
  }
  readBody(request).then(async body => {
    const result = await store.record(body?.id, clientAddress(request));
    if (result == null) {
      response.statusCode = 503;
      response.end();
      return;
    }
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json; charset=utf-8');
    response.setHeader('cache-control', 'no-store');
    response.end(JSON.stringify({ total: result.total, ordinal: result.ordinal }));
  }).catch(() => {
    if (response.writableEnded) return;
    response.statusCode = 400;
    response.end();
  });
}
