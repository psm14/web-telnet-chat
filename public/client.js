(() => {
  const socket = io();

  const els = {
    messages: document.getElementById('messages'),
    form: document.getElementById('chatForm'),
    input: document.getElementById('m'),
    name: document.getElementById('name'),
    saveName: document.getElementById('saveName')
  };

  let myName = 'Me';

  function fmtTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function addMessage({ name, text, ts }, self = false) {
    const row = document.createElement('div');
    row.className = `msg ${self ? 'self' : ''}`;
    row.innerHTML = `
      <div class="meta">${name} • ${fmtTime(ts)}</div>
      <div class="bubble">${escapeHtml(text)}</div>
    `;
    els.messages.appendChild(row);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function addSystem(text) {
    const row = document.createElement('div');
    row.className = 'msg system';
    row.innerHTML = `
      <div class="meta">System • ${fmtTime(Date.now())}</div>
      <div class="bubble">${escapeHtml(text)}</div>
    `;
    els.messages.appendChild(row);
    els.messages.scrollTop = els.messages.scrollHeight;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Socket events
  socket.on('system:welcome', ({ name, message }) => {
    myName = name;
    els.name.placeholder = name;
    addSystem(message);
  });

  socket.on('system:join', ({ message }) => addSystem(message));
  socket.on('system:leave', ({ message }) => addSystem(message));
  socket.on('system:rename', ({ message }) => addSystem(message));

  socket.on('chat:message', (payload) => {
    addMessage(payload, payload.name === myName);
  });

  // Form handlers
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (els.input.value || '').trim();
    if (!text) return;
    socket.emit('chat:message', text);
    els.input.value = '';
  });

  els.saveName.addEventListener('click', () => {
    const val = (els.name.value || '').trim();
    if (!val || val === myName) return;
    myName = val;
    socket.emit('user:rename', val);
    els.name.value = '';
    els.name.placeholder = val;
  });

  els.name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      els.saveName.click();
    }
  });
})();

