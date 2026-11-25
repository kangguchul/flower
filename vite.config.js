import os from 'node:os';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { attachMultiplayer } from './server/multiplayer.mjs';
import { handleBoardRequest } from './server/board.mjs';
import { createLiveBoardStore } from './server/boardDb.mjs';
import { createAccessRecorder } from './server/accessDb.mjs';
import { createVisitStore, handleVisitPresence, handleVisitRequest, handleVisitStats } from './server/visits.mjs';
import { handleBotCallback } from './server/botCallback.mjs';

const accessSessions = [];
const accessRecorder = createAccessRecorder();
const visitStore = createVisitStore(path.resolve('data/visits.json'), path.resolve('count.ini'), {
  sessions: accessSessions,
  onVisit: event => Promise.all([accessRecorder.record(event.now), accessRecorder.note(event)]),
  onSession: event => accessRecorder.note(event),
  loadToday: now => accessRecorder.countToday(now),
  seedTotal: total => accessRecorder.ensureTotal(total),
  summary: now => accessRecorder.summary(now)
});

function sendJson(response, status, body) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  response.end(JSON.stringify(body));
}
const boardStore = createLiveBoardStore();

function keepGameWhenDevSocketDrops() {
  return {
    name: 'hwatu-keep-game',
    enforce: 'pre',
    transform(code, id) {
      const clean = id.split('?')[0].replaceAll('\\', '/');
      if (!clean.endsWith('/vite/dist/client/client.mjs')) return null;
      const next = code
        .replace(
          /await waitForSuccessfulPing\(url\.href\);\s*location\.reload\(\);/,
          'await waitForSuccessfulPing(url.href);'
        )
        .replace(
          'const socketHost = `${__HMR_HOSTNAME__ || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port}${__HMR_BASE__}`;',
          'const socketHost = `${__HMR_HOSTNAME__ || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port || (socketProtocol === "wss" ? "443" : "80")}${__HMR_BASE__}`;'
        );
      return next === code ? null : next;
    }
  };
}

function reloadStaticFiles() {
  return {
    name: 'hwatu-static-reload',
    configureServer(server) {
      const root = server.config.root.replaceAll('\\', '/');
      const notify = (file) => {
        const normalized = file.replaceAll('\\', '/');
        if (normalized !== `${root}/index.html` && !normalized.startsWith(`${root}/public/`)) return;
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', notify);
      server.watcher.on('add', notify);
      server.watcher.on('unlink', notify);
    }
  };
}

function multiplayerPlugin() {
  return {
    name: 'hwatu-multiplayer',
    configureServer(server) {
      server.middlewares.use('/board/posts', (request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? '/';
        if (pathname !== '/' && pathname !== '') return next();
        handleBoardRequest(boardStore, request, response);
      });
      server.middlewares.use('/bot', (request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? '/';
        if (request.method !== 'POST' || (pathname !== '/' && pathname !== '')) return next();
        handleBotCallback(request, response);
      });
      server.middlewares.use('/visits', (request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? '/';
        if (pathname === '/stats' && request.method === 'GET') {
          handleVisitStats(visitStore, response);
          return;
        }
        if (pathname === '/report' && request.method === 'GET') {
          Promise.resolve(visitStore.stats()).catch(() => null).then(() => accessRecorder.report(Date.now())).then(report => {
            sendJson(response, 200, report);
          }).catch(() => {
            if (response.writableEnded) return;
            response.statusCode = 503;
            response.end();
          });
          return;
        }
        if (pathname === '/presence') {
          handleVisitPresence(visitStore, request, response);
          return;
        }
        if (pathname !== '/' && pathname !== '') return next();
        handleVisitRequest(visitStore, request, response);
      });
      const sockets = new WebSocketServer({ noServer: true });
      attachMultiplayer(sockets);
      server.httpServer?.on('upgrade', (request, socket, head) => {
        const path = request.url?.split('?')[0];
        if (path !== '/multiplayer') return;
        sockets.handleUpgrade(request, socket, head, client => {
          sockets.emit('connection', client, request);
        });
      });
      server.middlewares.use('/multiplayer/host', (_request, response) => {
        const ips = Object.values(os.networkInterfaces())
          .flat()
          .filter(entry => entry && (entry.family === 'IPv4' || entry.family === 4) && !entry.internal)
          .map(entry => entry.address);
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ips }));
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), keepGameWhenDevSocketDrops(), reloadStaticFiles(), multiplayerPlugin()],
  server: {
    host: true,
    port: 5234,
    strictPort: true,
    allowedHosts: ['generaltopics.net', 'www.generaltopics.net'],
    headers: {
      'Cache-Control': 'no-store'
    },
    watch: {
      usePolling: true,
      interval: 200
    },
    proxy: {
      '/api': 'http://127.0.0.1:5233'
    }
  },
  build: {
    outDir: '../../services/api/wwwroot',
    emptyOutDir: true,
    sourcemap: false
  }
});
