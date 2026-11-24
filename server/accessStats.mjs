export const SESSION_GAP_MS = 2 * 60 * 1000;

export function normalizeIp(ip) {
  const text = String(ip || 'unknown').trim().slice(0, 64) || 'unknown';
  return text.startsWith('::ffff:') ? text.slice(7) : text;
}

export function trackSession(sessions, { visitorId, ip, now }, gapMs = SESSION_GAP_MS) {
  if (!Array.isArray(sessions)) return null;
  const address = normalizeIp(ip);
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const session = sessions[index];
    if (session.visitorId !== visitorId) continue;
    if (now - session.lastSeen > gapMs) break;
    session.lastSeen = now;
    session.ip = address;
    return session;
  }
  const created = { visitorId, ip: address, startedAt: now, lastSeen: now };
  sessions.push(created);
  return created;
}

export function averageDurationMs(sessions, now = Date.now()) {
  if (!sessions.length) return 0;
  const total = sessions.reduce((sum, session) => sum + Math.max(0, (session.lastSeen ?? now) - session.startedAt), 0);
  return Math.round(total / sessions.length);
}

export function maxConcurrent(sessions) {
  const events = [];
  for (const session of sessions) {
    const end = Math.max(session.startedAt, session.lastSeen);
    events.push({ at: session.startedAt, delta: 1 });
    events.push({ at: end + 1, delta: -1 });
  }
  events.sort((left, right) => left.at - right.at || left.delta - right.delta);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

export function concurrentSeries(sessions, { from, to, step }) {
  const points = [];
  for (let at = from; at < to; at += step) {
    const current = sessions.filter(session => session.startedAt < at + step && session.lastSeen >= at).length;
    points.push({ at, current });
  }
  return points;
}

export function peopleStats(sessions) {
  const grouped = new Map();
  for (const session of sessions) {
    const row = grouped.get(session.visitorId) ?? { visitorId: session.visitorId, visits: 0, ips: new Set(), durationMs: 0 };
    row.visits += 1;
    if (session.ip) row.ips.add(session.ip);
    row.durationMs += Math.max(0, session.lastSeen - session.startedAt);
    grouped.set(session.visitorId, row);
  }
  return [...grouped.values()]
    .map(row => ({
      visitorId: row.visitorId,
      visits: row.visits,
      ips: [...row.ips],
      averageMs: Math.round(row.durationMs / row.visits)
    }))
    .sort((left, right) => right.visits - left.visits || left.visitorId.localeCompare(right.visitorId));
}

export const IP_COUNT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

export function playList(sessions, now = Date.now(), windowMs = IP_COUNT_WINDOW_MS) {
  const from = now - windowMs;
  const visitors = new Map();
  for (const session of sessions) {
    if (session.lastSeen < from) continue;
    const ip = session.ip && session.ip !== 'unknown' ? session.ip : '알 수 없음';
    const ids = visitors.get(ip) ?? new Set();
    ids.add(session.visitorId);
    visitors.set(ip, ids);
  }
  return [...visitors.entries()]
    .map(([ip, ids]) => ({ ip, count: ids.size }))
    .sort((left, right) => right.count - left.count || left.ip.localeCompare(right.ip))
    .map(row => `${row.count}명:${row.ip}`);
}

export function buildAccessReport(sessions, samples = [], now = Date.now()) {
  const from = now - 24 * 60 * 60 * 1000;
  const recent = sessions.filter(session => session.lastSeen >= from);
  const rawSeries = samples.length
    ? samples.map(sample => ({ at: Number(sample.recordedAt), current: Number(sample.current) }))
    : concurrentSeries(recent, { from, to: now, step: 30 * 60 * 1000 });
  const series = rawSeries.some(point => point.current > 0) ? rawSeries : [];
  const samplePeak = samples.reduce((peak, sample) => Math.max(peak, Number(sample.current) || 0), 0);
  return {
    averageMs: averageDurationMs(recent, now),
    maxConcurrent: Math.max(maxConcurrent(recent), samplePeak),
    series,
    people: peopleStats(recent),
    plays: playList(sessions, now)
  };
}

export function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms) / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}초`;
  return `${minutes}분 ${rest}초`;
}
