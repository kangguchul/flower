import mariadb from 'mariadb';
import { seoulDayStart } from './accessTime.mjs';
import { readBoardDbConfig } from './boardDb.mjs';

import { SESSION_GAP_MS, buildAccessReport, normalizeIp } from './accessStats.mjs';

const CREATE_EVENTS = `CREATE TABLE IF NOT EXISTS visit_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visited_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_visit_events_visited (visited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const CREATE_REPORTS = `CREATE TABLE IF NOT EXISTS access_reports (
  id BIGINT NOT NULL AUTO_INCREMENT,
  recorded_at BIGINT NOT NULL,
  current_users INT NOT NULL,
  today_users INT NOT NULL,
  total_users INT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_access_reports_recorded (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const CREATE_SESSIONS = `CREATE TABLE IF NOT EXISTS visit_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  visitor_id VARCHAR(36) NOT NULL,
  ip VARCHAR(64) NOT NULL,
  started_at BIGINT NOT NULL,
  last_seen BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_visit_sessions_seen (last_seen),
  KEY idx_visit_sessions_visitor (visitor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

function connectionOptions(config, database) {
  return {
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    connectTimeout: 2000,
    ssl: false,
    bigIntAsNumber: true,
    ...(database ? { database } : {})
  };
}

export function createAccessRecorder(config = readBoardDbConfig()) {
  let connection = null;
  let ready = null;
  const ensure = async () => {
    const admin = await mariadb.createConnection(connectionOptions(config));
    try {
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    }
    finally {
      await admin.end();
    }
    connection = await mariadb.createConnection(connectionOptions(config, config.database));
    await connection.query(CREATE_EVENTS);
    await connection.query(CREATE_SESSIONS);
    await connection.query(CREATE_REPORTS);
  };
  const query = async (sql, values) => {
    if (!ready) ready = ensure().catch(error => { ready = null; throw error; });
    await ready;
    return connection.query(sql, values);
  };
  return {
    record(now = Date.now()) {
      return query('INSERT INTO visit_events (visited_at) VALUES (?)', [now]);
    },
    async countSince(start) {
      const rows = await query('SELECT COUNT(*) AS total FROM visit_events WHERE visited_at >= ?', [start]);
      return Number(rows?.[0]?.total ?? 0);
    },
    countToday(now = Date.now()) {
      return this.countSince(seoulDayStart(now));
    },
    async note(event) {
      const visitorId = String(event.visitorId || '').slice(0, 36);
      const ip = normalizeIp(event.ip);
      const now = Number(event.now) || Date.now();
      if (!visitorId) return;
      const rows = await query(
        'SELECT id, last_seen AS lastSeen FROM visit_sessions WHERE visitor_id = ? ORDER BY last_seen DESC LIMIT 1',
        [visitorId]
      );
      const open = rows?.[0];
      if (open && now - Number(open.lastSeen) <= SESSION_GAP_MS) {
        await query('UPDATE visit_sessions SET last_seen = ?, ip = ? WHERE id = ?', [now, ip, open.id]);
        return;
      }
      await query(
        'INSERT INTO visit_sessions (visitor_id, ip, started_at, last_seen) VALUES (?, ?, ?, ?)',
        [visitorId, ip, now, now]
      );
    },
    async sessionsSince(start) {
      const rows = await query(
        'SELECT visitor_id AS visitorId, ip, started_at AS startedAt, last_seen AS lastSeen FROM visit_sessions WHERE last_seen >= ? ORDER BY started_at ASC',
        [start]
      );
      return (Array.isArray(rows) ? rows : []).map(row => ({
        visitorId: String(row.visitorId),
        ip: normalizeIp(row.ip),
        startedAt: Number(row.startedAt),
        lastSeen: Number(row.lastSeen)
      }));
    },
    async reportsSince(start) {
      const rows = await query(
        'SELECT recorded_at AS recordedAt, current_users AS currentUsers FROM access_reports WHERE recorded_at >= ? ORDER BY recorded_at ASC',
        [start]
      );
      return (Array.isArray(rows) ? rows : []).map(row => ({
        recordedAt: Number(row.recordedAt),
        current: Number(row.currentUsers)
      }));
    },
    async report(now = Date.now()) {
      const since = now - 24 * 60 * 60 * 1000;
      const [sessions, samples] = await Promise.all([this.sessionsSince(since), this.reportsSince(since)]);
      return { ...buildAccessReport(sessions, samples, now), source: 'database' };
    }
  };
}
