const state = {
  token: localStorage.getItem('netpulse-token') || '',
  user: null,
  dashboard: null,
  ws: null,
};

const elements = {
  connectionStatus: document.getElementById('connectionStatus'),
  currentUser: document.getElementById('currentUser'),
  statusMessage: document.getElementById('statusMessage'),
  authCard: document.getElementById('authCard'),
  dashboardArea: document.getElementById('dashboardArea'),
  registerForm: document.getElementById('registerForm'),
  loginForm: document.getElementById('loginForm'),
  httpTelemetryForm: document.getElementById('httpTelemetryForm'),
  transportForm: document.getElementById('transportForm'),
  benchmarkForm: document.getElementById('benchmarkForm'),
  benchmarkResult: document.getElementById('benchmarkResult'),
  telemetryFeed: document.getElementById('telemetryFeed'),
  alertFeed: document.getElementById('alertFeed'),
  logFeed: document.getElementById('logFeed'),
  protocolList: document.getElementById('protocolList'),
  statUsers: document.getElementById('statUsers'),
  statTelemetry: document.getElementById('statTelemetry'),
  statAlerts: document.getElementById('statAlerts'),
  statBenchmarks: document.getElementById('statBenchmarks'),
  statRtt: document.getElementById('statRtt'),
  statChannels: document.getElementById('statChannels'),
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function api(path, { method = 'GET', body = null, auth = true } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (auth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload;
}

function setConnectionStatus(online, message) {
  elements.connectionStatus.textContent = online ? 'Online' : 'Offline';
  elements.connectionStatus.className = `status-pill ${online ? 'status-online' : 'status-offline'}`;
  elements.statusMessage.textContent = message;
}

function renderProtocol(protocol) {
  if (!protocol) {
    return;
  }

  elements.protocolList.innerHTML = [
    `<li><strong>HTTP:</strong> /api routes for authentication, telemetry submission and benchmark orchestration.</li>`,
    `<li><strong>WebSocket:</strong> /ws path for live telemetry, alert and benchmark push updates.</li>`,
    `<li><strong>TCP:</strong> newline-delimited JSON relay on port ${window.__NETPULSE_TCP_PORT || 4001} for transport-layer captures.</li>`,
    `<li><strong>UDP:</strong> single-datagram JSON relay on port ${window.__NETPULSE_UDP_PORT || 4002} for comparison and loss analysis.</li>`,
  ].join('');
}

function renderDashboard(dashboard) {
  if (!dashboard) {
    return;
  }

  state.dashboard = dashboard;
  const counts = dashboard.counts || {};
  const byChannel = counts.byChannel || {};

  elements.statUsers.textContent = counts.users ?? 0;
  elements.statTelemetry.textContent = counts.telemetry ?? 0;
  elements.statAlerts.textContent = counts.alerts ?? 0;
  elements.statBenchmarks.textContent = counts.benchmarks ?? 0;
  elements.statRtt.textContent = `${dashboard.averageRttMs ?? 0} ms`;
  elements.statChannels.textContent = `${byChannel.HTTP ?? 0} / ${byChannel.TCP ?? 0} / ${byChannel.UDP ?? 0}`;

  renderProtocol(dashboard.protocol);
  renderFeed(elements.telemetryFeed, dashboard.telemetry || [], (item) => ({
    title: `${item.ingestChannel || 'HTTP'} · ${item.deviceName} · ${item.metricName}`,
    body: `${item.value}${item.unit ? ` ${item.unit}` : ''} · RTT ${item.rttMs ?? 'n/a'} ms · ${new Date(item.createdAt).toLocaleString()}`,
    tone: item.transportProtocol === 'UDP' ? 'warning' : '',
  }));
  renderFeed(elements.alertFeed, dashboard.alerts || [], (item) => ({
    title: `Alert · ${item.metricName}`,
    body: `${item.message} · Threshold ${item.threshold} · ${new Date(item.createdAt).toLocaleString()}`,
    tone: 'warning',
  }));
  renderFeed(elements.logFeed, dashboard.logs || [], (item) => ({
    title: `${item.level.toUpperCase()} · ${item.message}`,
    body: `${new Date(item.createdAt).toLocaleString()} · ${JSON.stringify(item.context || {})}`,
    tone: item.level === 'warning' ? 'warning' : '',
  }));
}

function renderFeed(container, items, mapper) {
  container.innerHTML = items
    .map((item) => {
      const view = mapper(item);
      return `
        <article class="feed-item ${view.tone || ''}">
          <strong>${escapeHtml(view.title)}</strong>
          <small>${escapeHtml(view.body)}</small>
        </article>
      `;
    })
    .join('');

  if (items.length === 0) {
    container.innerHTML = '<article class="feed-item"><strong>No records yet</strong><small>Send a sample to populate this panel.</small></article>';
  }
}

function renderBenchmark(result) {
  if (!result) {
    elements.benchmarkResult.textContent = 'No benchmark yet.';
    return;
  }

  elements.benchmarkResult.textContent = [
    `TCP: ${result.tcp.averageRttMs} ms average RTT | ${result.tcp.throughputMbps} Mbps | payload ${result.tcp.payloadBytes} bytes`,
    `UDP: ${result.udp.averageRttMs} ms average RTT | ${result.udp.throughputMbps} Mbps | payload ${result.udp.payloadBytes} bytes`,
  ].join('\n');
}

function toggleDashboard(visible) {
  elements.dashboardArea.classList.toggle('hidden', !visible);
  elements.authCard.classList.toggle('hidden', visible);
}

function websocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(state.token)}`;
}

function connectWebSocket() {
  if (!state.token) {
    return;
  }

  if (state.ws) {
    state.ws.close();
  }

  const socket = new WebSocket(websocketUrl());
  state.ws = socket;

  socket.addEventListener('open', () => {
    setConnectionStatus(true, 'Connected to the live dashboard.');
  });

  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data);
    if (payload.event === 'dashboard') {
      renderDashboard(payload.payload);
    }
    if (payload.event === 'telemetry' && state.dashboard) {
      state.dashboard.telemetry = [payload.payload, ...(state.dashboard.telemetry || [])].slice(0, 25);
      renderDashboard(state.dashboard);
    }
    if (payload.event === 'alert' && state.dashboard) {
      state.dashboard.alerts = [payload.payload, ...(state.dashboard.alerts || [])].slice(0, 10);
      renderDashboard(state.dashboard);
    }
    if (payload.event === 'benchmark' && state.dashboard) {
      state.dashboard.benchmarks = [payload.payload, ...(state.dashboard.benchmarks || [])].slice(0, 10);
      renderDashboard(state.dashboard);
    }
  });

  socket.addEventListener('close', () => {
    setConnectionStatus(false, 'Connection closed. Reconnecting when you log in again.');
  });

  socket.addEventListener('error', () => {
    setConnectionStatus(false, 'WebSocket error encountered.');
  });
}

async function loadDashboard() {
  const payload = await api('/api/dashboard');
  renderDashboard(payload.dashboard);
}

async function bootstrap() {
  renderBenchmark(null);
  toggleDashboard(false);

  if (state.token) {
    try {
      const me = await api('/api/me');
      state.user = me.user;
      elements.currentUser.textContent = state.user.name;
      toggleDashboard(true);
      connectWebSocket();
      await loadDashboard();
      setConnectionStatus(true, 'Authentication restored from local storage.');
    } catch (error) {
      localStorage.removeItem('netpulse-token');
      state.token = '';
      setConnectionStatus(false, 'Stored session expired. Please log in again.');
    }
  } else {
    setConnectionStatus(false, 'Sign in to start monitoring.');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const body = Object.fromEntries(formData.entries());
  await api('/api/auth/register', { method: 'POST', body, auth: false });
  elements.statusMessage.textContent = 'Registration completed. You can log in now.';
  form.reset();
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData.entries());
  const payload = await api('/api/auth/login', { method: 'POST', body, auth: false });
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem('netpulse-token', state.token);
  elements.currentUser.textContent = state.user.name;
  toggleDashboard(true);
  connectWebSocket();
  await loadDashboard();
}

async function handleHttpTelemetry(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData.entries());
  body.value = Number(body.value);
  body.threshold = body.threshold ? Number(body.threshold) : null;
  const payload = await api('/api/telemetry/http', { method: 'POST', body });
  renderBenchmark(state.dashboard ? {
    tcp: state.dashboard.benchmarks?.[0] || { averageRttMs: 0, throughputMbps: 0, payloadBytes: 0 },
    udp: state.dashboard.benchmarks?.[0] || { averageRttMs: 0, throughputMbps: 0, payloadBytes: 0 },
  } : null);
  elements.statusMessage.textContent = payload.message;
  await loadDashboard();
}

async function handleTransport(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData.entries());
  body.value = Number(body.value);
  body.padding = Number(body.padding);
  body.threshold = null;
  const payload = await api('/api/transport/send', { method: 'POST', body });
  elements.benchmarkResult.textContent = `${payload.transport} relay completed in ${payload.rttMs} ms.`;
  elements.statusMessage.textContent = payload.message;
  await loadDashboard();
}

async function handleBenchmark(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const body = Object.fromEntries(formData.entries());
  body.iterations = Number(body.iterations);
  body.payloadSize = Number(body.payloadSize);
  const payload = await api('/api/benchmark/run', { method: 'POST', body });
  renderBenchmark(payload);
  elements.statusMessage.textContent = payload.message;
  await loadDashboard();
}

elements.registerForm.addEventListener('submit', (event) => {
  handleRegister(event).catch((error) => {
    elements.statusMessage.textContent = error.message;
  });
});

elements.loginForm.addEventListener('submit', (event) => {
  handleLogin(event).catch((error) => {
    elements.statusMessage.textContent = error.message;
  });
});

elements.httpTelemetryForm.addEventListener('submit', (event) => {
  handleHttpTelemetry(event).catch((error) => {
    elements.statusMessage.textContent = error.message;
  });
});

elements.transportForm.addEventListener('submit', (event) => {
  handleTransport(event).catch((error) => {
    elements.statusMessage.textContent = error.message;
  });
});

elements.benchmarkForm.addEventListener('submit', (event) => {
  handleBenchmark(event).catch((error) => {
    elements.statusMessage.textContent = error.message;
  });
});

bootstrap().catch((error) => {
  setConnectionStatus(false, error.message);
});
