import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DBEAVER_KEY = Buffer.from([0xba, 0xbb, 0x4a, 0x9f, 0x77, 0x4a, 0xb8, 0x53, 0xc9, 0x6c, 0x2d, 0x65, 0x3d, 0xfe, 0x54, 0x4a]);

export function defaultDbeaverDir() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return path.join(appData, 'DBeaverData', 'workspace6', 'General', '.dbeaver');
}

export function decryptDbeaverCredentials(bytes) {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const iv = data.subarray(0, 16);
  const decipher = createDecipheriv('aes-128-cbc', DBEAVER_KEY, iv);
  const text = Buffer.concat([decipher.update(data.subarray(16)), decipher.final()]).toString('utf8');
  return JSON.parse(text);
}

function jdbcParts(url) {
  const match = /^jdbc:mariadb:\/\/([^/:?#]+)(?::(\d+))?(?:\/([^?#]*))?/i.exec(String(url ?? ''));
  if (!match) return { host: '', port: 0, database: '' };
  return { host: match[1], port: match[2] ? Number(match[2]) : 0, database: match[3] || '' };
}

function ipv4Host(host) {
  if (!host || host === 'localhost') return '127.0.0.1';
  return host;
}

export function mariaConfigFromDocuments(dataSources, credentials, fallbackDatabase = 'flower') {
  const matches = Object.entries(dataSources?.connections ?? {}).filter(([, item]) => {
    const url = String(item?.configuration?.url ?? '');
    return item?.driver === 'mariaDB' || url.startsWith('jdbc:mariadb:');
  });
  if (matches.length === 0) throw new Error('DBeaver에 MariaDB 연결이 없습니다.');
  if (matches.length > 1) throw new Error('DBeaver MariaDB 연결이 둘 이상입니다.');
  const [id, item] = matches[0];
  const configuration = item.configuration ?? {};
  const fromUrl = jdbcParts(configuration.url);
  const saved = credentials?.[id]?.['#connection'] ?? {};
  const user = saved.user || configuration.user || '';
  if (!user) throw new Error('DBeaver MariaDB 연결에 사용자가 없습니다.');
  const database = fromUrl.database || fallbackDatabase;
  if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error('invalid database name');
  return {
    host: ipv4Host(configuration.host || fromUrl.host),
    port: Number(configuration.port || fromUrl.port || 3306),
    user,
    password: saved.password ?? '',
    database
  };
}

export function readMariaDbConfig({ dir = defaultDbeaverDir(), databaseName = 'flower' } = {}) {
  const sources = JSON.parse(readFileSync(path.join(dir, 'data-sources.json'), 'utf8'));
  const credentials = decryptDbeaverCredentials(readFileSync(path.join(dir, 'credentials-config.json')));
  return mariaConfigFromDocuments(sources, credentials, databaseName);
}
