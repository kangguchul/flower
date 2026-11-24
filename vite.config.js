import os from 'node:os';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { attachMultiplayer } from './server/multiplayer.mjs';
import { handleBoardRequest } from './server/board.mjs';
import { createLiveBoardStore } from './server/boardDb.mjs';
import { createAccessRecorder } from './server/accessDb.mjs';
import { buildAccessReport } from './server/accessStats.mjs';
import { createVisitStore, handleVisitPresence, handleVisitRequest, handleVisitStats } from './server/visits.mjs';

const accessSessions = [];
const accessRecorder = createAccessRecorder();
const visitStore = createVisitStore(path.resolve('data/visits.json'), path.resolve('count.ini'), {
  sessions: accessSessions,
  onVisit: event => Promise.all([accessRecorder.record(event.now), accessRecorder.note(event)]),
  onSession: event => accessRecorder.note(event),
  loadToday: now => accessRecorder.countToday(now)
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
    transform(code, id) {
      const clean = id.split('?')[0].replaceAll('\\', '/');
      if (!clean.endsWith('/vite/dist/client/client.mjs')) return null;
      const next = code.replace(
        /await waitForSuccessfulPing\(url\.href\);\s*location\.reload\(\);/,
        'await waitForSuccessfulPing(url.href);'
      );
      return next === code ? null : next;
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
      server.middlewares.use('/visits', (request, response, next) => {
        const pathname = request.url?.split('?')[0] ?? '/';
        if (pathname === '/stats' && request.method === 'GET') {
          handleVisitStats(visitStore, response);
          return;
        }
        if (pathname === '/report' && request.method === 'GET') {
          const now = Date.now();
          const memory = { ...buildAccessReport(visitStore.sessions(), [], now), source: 'memory' };
          accessRecorder.report(now).then(report => {
            const hasDatabase = report.people.length > 0 || report.series.some(point => point.current > 0);
            sendJson(response, 200, hasDatabase ? report : memory);
          }).catch(() => sendJson(response, 200, memory));
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
  plugins: [react(), keepGameWhenDevSocketDrops(), multiplayerPlugin()],
  server: {
    host: true,
    port: 5234,
    strictPort: true,
    allowedHosts: ['generaltopics.net', 'www.generaltopics.net'],
    hmr: {
      protocol: 'wss',
      clientPort: 443
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
