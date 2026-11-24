import { createCipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptDbeaverCredentials, mariaConfigFromDocuments } from './dbeaverConfig.mjs';

const KEY = Buffer.from([0xba, 0xbb, 0x4a, 0x9f, 0x77, 0x4a, 0xb8, 0x53, 0xc9, 0x6c, 0x2d, 0x65, 0x3d, 0xfe, 0x54, 0x4a]);

function encrypt(value) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-128-cbc', KEY, iv);
  return Buffer.concat([iv, cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
}

const sources = {
  connections: {
    'mariaDB-local': {
      driver: 'mariaDB',
      configuration: {
        host: 'localhost',
        port: '3306',
        url: 'jdbc:mariadb://localhost:3306/'
      }
    },
    'postgres-local': {
      driver: 'postgres-jdbc',
      configuration: { host: 'localhost', port: '5432', url: 'jdbc:postgresql://localhost:5432/postgres' }
    }
  }
};

describe('dbeaver maria config', () => {
  it('reads the maria connection and leaves the database name to the app', () => {
    const credentials = decryptDbeaverCredentials(encrypt({
      'mariaDB-local': { '#connection': { user: 'root', password: 'secret' } },
      'postgres-local': { '#connection': { user: 'postgres', password: 'other' } }
    }));
    expect(mariaConfigFromDocuments(sources, credentials, 'flower')).toEqual({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'secret',
      database: 'flower'
    });
  });

  it('uses the database named in the jdbc url', () => {
    const withDatabase = {
      connections: {
        maria: {
          driver: 'mariaDB',
          configuration: { url: 'jdbc:mariadb://db.example:3307/reports' }
        }
      }
    };
    const credentials = { maria: { '#connection': { user: 'app', password: 'pw' } } };
    expect(mariaConfigFromDocuments(withDatabase, credentials, 'flower')).toMatchObject({
      host: 'db.example',
      port: 3307,
      database: 'reports',
      user: 'app'
    });
  });
});
