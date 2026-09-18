import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

const server = createServer();
const wss = new WebSocketServer({ server });

function cleanRoom(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}
function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function broadcast(room, data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.room === room) client.send(text);
  }
}

wss.on('connection', (ws) => {
  send(ws, { type: 'relay-ready' });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'ping') {
      send(ws, { type: 'pong', at: msg.at || Date.now() });
      return;
    }

    if (msg.type === 'relay-join') {
      const room = cleanRoom(msg.room);
      if (!room) return;
      ws.room = room;
      ws.clientId = String(msg.clientId || '');
      ws.role = msg.role === 'host' ? 'host' : 'guest';
      send(ws, { type: 'relay-joined', room });
      broadcast(room, { type: 'presence', event: 'joined', room, clientId: ws.clientId, role: ws.role, at: Date.now() });
      return;
    }

    const room = cleanRoom(msg.room || ws.room);
    if (!room || room !== ws.room) return;
    broadcast(room, raw.toString());
  });

  ws.on('close', () => {
    if (!ws.room) return;
    broadcast(ws.room, { type: 'presence', event: 'left', room: ws.room, clientId: ws.clientId || '', role: ws.role || 'guest', at: Date.now() });
  });
});

export default server;
