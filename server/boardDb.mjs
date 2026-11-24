import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mariadb from 'mariadb';
import { createQueryBoardStore } from './board.mjs';
import { readMariaDbConfig } from './dbeaverConfig.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS board_posts (
  id VARCHAR(40) NOT NULL,
  name VARCHAR(20) NOT NULL,
  body VARCHAR(500) NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_board_posts_created (created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

function readEnvFile(file) {
  try {
    const env = {};
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      env[key] = value;
    }
    return env;
  }
  catch {
    return {};
  }
}

export function readBoardDbConfig(env = process.env, fileEnv = readEnvFile(path.join(root, '.env'))) {
  const value = key => env[key] ?? fileEnv[key];
  const database = value('BOARD_DB_NAME') || 'flower';
  const dir = value('DBEAVER_CONFIG_DIR');
  return readMariaDbConfig({ ...(dir ? { dir } : {}), databaseName: database });
}

async function importJsonPosts(query, file) {
  const countRows = await query('SELECT COUNT(*) AS total FROM board_posts');
  if (Number(countRows?.[0]?.total ?? 0) > 0) return;
  let saved;
  try {
    saved = JSON.parse(await readFile(file, 'utf8'));
  }
  catch {
    return;
  }
  const posts = Array.isArray(saved?.posts) ? saved.posts : [];
  for (const post of posts) {
    if (!post || typeof post.id !== 'string' || typeof post.body !== 'string') continue;
    const name = typeof post.name === 'string' && post.name ? post.name.slice(0, 20) : '손님';
    await query(
      'INSERT IGNORE INTO board_posts (id, name, body, created_at) VALUES (?, ?, ?, ?)',
      [post.id.slice(0, 40), name, post.body.slice(0, 500), Number(post.createdAt) || Date.now()]
    );
  }
}

export function createLiveBoardStore(config = readBoardDbConfig(), jsonFile = path.join(root, 'data', 'board.json')) {
  let pool = null;
  let ready = null;
  const ensure = async () => {
    const base = {
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      connectTimeout: 5000,
      ssl: false,
      bigIntAsNumber: true
    };
    const admin = mariadb.createPool({ ...base, connectionLimit: 1 });
    try {
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    }
    finally {
      await admin.end();
    }
    pool = mariadb.createPool({ ...base, database: config.database, connectionLimit: 4, charset: 'utf8mb4' });
    await pool.query(CREATE_TABLE);
    await importJsonPosts((sql, values) => pool.query(sql, values), jsonFile);
  };
  const query = async (sql, values) => {
    if (!ready) ready = ensure().catch(error => { ready = null; throw error; });
    await ready;
    return pool.query(sql, values);
  };
  return createQueryBoardStore(query);
}
