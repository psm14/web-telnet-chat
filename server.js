const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const net = require('net');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;
const TELNET_PORT = process.env.TELNET_PORT || 2323;

// Serve static assets
app.use(express.static(path.join(__dirname, 'public')));

// Simple health route
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// In-memory user maps
const users = new Map(); // socket.id -> { name }
const telnetClients = new Map(); // id -> { socket, name }

function genName() {
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `User-${id}`;
}

function genTTYName() {
  const id = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TTY-${id}`;
}

function nowHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function telnetBroadcast(line) {
  for (const { socket } of telnetClients.values()) {
    if (!socket.destroyed) {
      try { socket.write(line + '\r\n'); } catch (_) {}
    }
  }
}

io.on('connection', (socket) => {
  const name = genName();
  users.set(socket.id, { name });

  socket.emit('system:welcome', {
    name,
    message: `Welcome ${name}!`
  });

  socket.broadcast.emit('system:join', {
    name,
    message: `${name} joined the chat`
  });
  // Mirror to telnet clients
  telnetBroadcast(`-- ${name} joined the chat --`);

  socket.on('chat:message', (text) => {
    const user = users.get(socket.id);
    if (!user || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const payload = {
      name: user.name,
      text: trimmed,
      ts: Date.now()
    };
    io.emit('chat:message', payload);
    // Mirror to telnet clients
    telnetBroadcast(`[${nowHHMM()}] ${payload.name}> ${payload.text}`);
  });

  socket.on('user:rename', (newName) => {
    const user = users.get(socket.id);
    if (!user || typeof newName !== 'string') return;
    const prev = user.name;
    const cleaned = newName.trim().slice(0, 24) || prev;
    user.name = cleaned;
    users.set(socket.id, user);
    io.emit('system:rename', {
      from: prev,
      to: cleaned,
      message: `${prev} is now ${cleaned}`
    });
    telnetBroadcast(`-- ${prev} is now ${cleaned} --`);
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    users.delete(socket.id);
    if (user) {
      socket.broadcast.emit('system:leave', {
        name: user.name,
        message: `${user.name} left`
      });
      telnetBroadcast(`-- ${user.name} left --`);
    }
  });
});

// --- Telnet server ---
function stripTelnet(buf) {
  // Remove telnet IAC negotiation sequences; return UTF-8 string
  const IAC = 255, SE = 240, SB = 250;
  let out = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === IAC) {
      const cmd = buf[i + 1];
      if (cmd === IAC) { // escaped 0xFF
        out.push(IAC);
        i += 1;
        continue;
      }
      if (cmd === SB) {
        // subnegotiation: skip until IAC SE
        i += 2;
        while (i < buf.length) {
          if (buf[i] === IAC && buf[i + 1] === SE) { i += 1; break; }
          i++;
        }
        continue;
      }
      // IAC <verb> <option>
      i += 2;
      continue;
    }
    out.push(b);
  }
  return Buffer.from(out).toString('utf8');
}

const telnetServer = net.createServer((socket) => {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`;
  const client = { id, socket, name: genTTYName() };
  telnetClients.set(id, client);

  const write = (line) => {
    try { socket.write(line + '\r\n'); } catch (_) {}
  };

  // Welcome banner
  write('############################################');
  write('#        NEON NODE // CHAT TERMINAL        #');
  write('############################################');
  write(`Connected ${nowHHMM()} — your callsign is ${client.name}`);
  write('Commands: /name <callsign>');
  write('Type your message and press Enter.');
  write('');

  // Announce join to web + telnet
  io.emit('system:join', { name: client.name, message: `${client.name} joined the chat` });
  telnetBroadcast(`-- ${client.name} joined the chat --`);

  let buf = '';
  socket.on('data', (chunk) => {
    const cleaned = stripTelnet(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    buf += cleaned;
    const parts = buf.split(/\r?\n/);
    buf = parts.pop() || '';
    for (const raw of parts) {
      const line = raw.trim();
      if (!line) continue;
      if (line.toLowerCase().startsWith('/name ')) {
        const newName = line.slice(6).trim().slice(0, 24) || client.name;
        if (newName !== client.name) {
          const prev = client.name;
          client.name = newName;
          telnetClients.set(id, client);
          io.emit('system:rename', { from: prev, to: newName, message: `${prev} is now ${newName}` });
          telnetBroadcast(`-- ${prev} is now ${newName} --`);
        } else {
          write(`No change — callsign remains ${client.name}`);
        }
        continue;
      }
      const payload = { name: client.name, text: line, ts: Date.now() };
      io.emit('chat:message', payload);
      telnetBroadcast(`[${nowHHMM()}] ${client.name}> ${line}`);
    }
  });

  socket.on('close', () => {
    telnetClients.delete(id);
    io.emit('system:leave', { name: client.name, message: `${client.name} left` });
    telnetBroadcast(`-- ${client.name} left --`);
  });
  socket.on('error', () => {
    // Treat like close
    try { socket.destroy(); } catch (_) {}
  });
});

telnetServer.listen(TELNET_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Telnet chat listening on tcp://0.0.0.0:${TELNET_PORT}`);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Chat server listening on http://localhost:${PORT}`);
});
