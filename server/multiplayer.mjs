const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function roomCode() {
  let value = '';
  for (let index = 0; index < 4; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return rooms.has(value) ? roomCode() : value;
}

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function closeRoom(room, message) {
  for (const socket of [room.host, room.guest]) {
    if (!socket) continue;
    send(socket, { type: 'closed', message });
    socket.room = null;
  }
  rooms.delete(room.code);
}

export function attachMultiplayer(webSocketServer) {
  webSocketServer.on('connection', socket => {
    socket.on('message', raw => {
      let message;
      try { message = JSON.parse(raw.toString()); }
      catch { return; }
      if (!message || typeof message !== 'object') return;

      if (message.type === 'create') {
        const code = roomCode();
        const room = {
          code,
          host: socket,
          guest: null,
          hostName: String(message.name || '나').slice(0, 12),
          guestName: ''
        };
        rooms.set(code, room);
        socket.room = room;
        socket.seat = 'host';
        send(socket, { type: 'created', code, seat: 'host', hostName: room.hostName });
        return;
      }

      if (message.type === 'join') {
        const room = rooms.get(String(message.code || '').trim().toUpperCase());
        if (!room || room.guest || socket === room.host) {
          send(socket, { type: 'error', message: '방을 찾을 수 없거나 이미 두 사람이 들어왔습니다.' });
          return;
        }
        room.guest = socket;
        room.guestName = String(message.name || '상대').slice(0, 12);
        socket.room = room;
        socket.seat = 'guest';
        const joined = { type: 'joined', code: room.code, hostName: room.hostName, guestName: room.guestName };
        send(room.host, { ...joined, seat: 'host' });
        send(room.guest, { ...joined, seat: 'guest' });
        return;
      }

      const room = socket.room;
      if (!room) return;
      if (message.type === 'state' && socket.seat === 'host') {
        room.revision = Number(message.revision) || 0;
        if (room.guest) send(room.guest, { type: 'state', revision: room.revision, state: message.guestView });
        return;
      }
      if (message.type === 'action' && socket.seat === 'guest' && room.host) {
        send(room.host, { type: 'action', id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, action: message.action });
        return;
      }
      if (message.type === 'choice' && socket.seat === 'host' && room.guest) {
        send(room.guest, { type: 'choice', choice: message.choice });
      }
    });

    socket.on('close', () => {
      const room = socket.room;
      if (!room || !rooms.has(room.code)) return;
      closeRoom(room, '상대가 나갔습니다. 같이 하기를 다시 시작해 주세요.');
    });
  });
}
