const express = require('express');
const http = require('http');
const path = require('path');
const net = require('net');
const dgram = require('dgram');
const bcrypt = require('bcryptjs');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');

const {
  buildAlertEntry,
  buildBenchmarkEntry,
  buildLogEntry,
  buildTelemetryEntry,
  createStateStore,
  createToken,
} = require('./state');
const {
  buildAck,
  decodeLines,
  encodeLine,
  normalizeTelemetryPayload,
  safeJsonParse,
  summarizeProtocol,
} = require('./protocol');

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const TCP_PORT = Number.parseInt(process.env.TCP_PORT || '4001', 10);
const UDP_PORT = Number.parseInt(process.env.UDP_PORT || '4002', 10);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_FILE = process.env.NETPULSE_DATA_FILE || path.join(__dirname, '..', 'data', 'state.json');

const store = createStateStore(DATA_FILE);
const app = express();
const httpServer = http.createServer(app);
const wsServer = new WebSocket.Server({ server: httpServer, path: '/ws' });
const wsClients = new Set();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

function sendJson(res, statusCode, payload) {
  return res.status(statusCode).json(payload);
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function getState() {
  return store.load();
}

async function writeLog(level, message, context = {}) {
  await store.mutate((state) => {
    state.logs.push(buildLogEntry(state, level, message, context));
    if (state.logs.length > 300) {
      state.logs.splice(0, state.logs.length - 300);
    }
    state.metrics.lastUpdated = new Date().toISOString();
  });
}

function broadcast(event, payload) {
  const message = JSON.stringify({ event, payload });
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function getTokenFromRequest(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }

  const headerToken = req.headers['x-auth-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  return null;
}

async function getAuthContext(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const state = await getState();
  const session = state.tokens[token];
  if (!session) {
    return null;
  }

  const user = state.users.find((candidate) => candidate.id === session.userId);
  if (!user) {
    return null;
  }

  return { token, user };
}

async function requireAuth(req, res, next) {
  const context = await getAuthContext(req);
  if (!context) {
    return sendJson(res, 401, {
      ok: false,
      message: 'Authentication required.',
    });
  }

  req.auth = context;
  return next();
}

function summarizeDashboard(state, currentUser = null) {
  const telemetry = [...state.telemetry].slice(-25).reverse();
  const alerts = [...state.alerts].slice(-10).reverse();
  const logs = [...state.logs].slice(-12).reverse();
  const benchmarks = [...state.metrics.benchmarks].slice(-10).reverse();

  const countsByChannel = state.telemetry.reduce(
    (accumulator, entry) => {
      const key = entry.ingestChannel || 'HTTP';
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    },
    { HTTP: 0, TCP: 0, UDP: 0 }
  );

  const averageRttMs =
    state.metrics.benchmarks.length === 0
      ? 0
      : Number(
          (
            state.metrics.benchmarks.reduce((sum, entry) => sum + Number(entry.averageRttMs || 0), 0) /
            state.metrics.benchmarks.length
          ).toFixed(2)
        );

  return {
    user: sanitizeUser(currentUser),
    counts: {
      users: state.users.length,
      telemetry: state.telemetry.length,
      alerts: state.alerts.length,
      logs: state.logs.length,
      benchmarks: state.metrics.benchmarks.length,
      byChannel: countsByChannel,
    },
    averageRttMs,
    telemetry,
    alerts,
    logs,
    benchmarks,
    protocol: summarizeProtocol(),
  };
}

async function registerTelemetryRecord({
  ingestChannel,
  transportProtocol = null,
  user,
  payload,
  remoteAddress = null,
  remotePort = null,
  rttMs = null,
  source = 'browser',
}) {
  const normalized = normalizeTelemetryPayload(payload);
  const rawBytes = Buffer.byteLength(JSON.stringify(payload || {}), 'utf8');
  let createdRecord = null;
  let createdAlert = null;

  await store.mutate((state) => {
    createdRecord = buildTelemetryEntry(state, {
      userId: user ? user.id : null,
      userName: user ? user.name : 'Unknown User',
      ingestChannel,
      transportProtocol,
      source,
      remoteAddress,
      remotePort,
      payloadBytes: rawBytes,
      rttMs: Number.isFinite(Number(rttMs)) ? Number(rttMs) : null,
      ...normalized,
    });

    state.telemetry.push(createdRecord);
    state.metrics.lastUpdated = new Date().toISOString();

    if (normalized.threshold !== null && normalized.value >= normalized.threshold) {
      createdAlert = buildAlertEntry(state, {
        telemetryId: createdRecord.id,
        level: 'warning',
        metricName: normalized.metricName,
        message: `${normalized.metricName} reached ${normalized.value}${normalized.unit ? ` ${normalized.unit}` : ''}.`,
        threshold: normalized.threshold,
        value: normalized.value,
        deviceName: normalized.deviceName,
        ingestChannel,
      });
      state.alerts.push(createdAlert);
      state.logs.push(buildLogEntry(state, 'warning', 'Alert created from telemetry value.', {
        telemetryId: createdRecord.id,
        alertId: createdAlert.id,
      }));
    } else {
      state.logs.push(buildLogEntry(state, 'info', 'Telemetry stored successfully.', {
        telemetryId: createdRecord.id,
        channel: ingestChannel,
      }));
    }

    if (state.telemetry.length > 500) {
      state.telemetry.splice(0, state.telemetry.length - 500);
    }
    if (state.alerts.length > 200) {
      state.alerts.splice(0, state.alerts.length - 200);
    }
    if (state.logs.length > 300) {
      state.logs.splice(0, state.logs.length - 300);
    }
  });

  return { record: createdRecord, alert: createdAlert };
}

function createBenchmarkSummary(protocol, samples, payloadBytes) {
  if (samples.length === 0) {
    return {
      protocol,
      iterations: 0,
      averageRttMs: 0,
      minRttMs: 0,
      maxRttMs: 0,
      throughputMbps: 0,
      payloadBytes,
    };
  }

  const totalRtt = samples.reduce((sum, sample) => sum + sample.rttMs, 0);
  const averageRttMs = totalRtt / samples.length;
  const minRttMs = Math.min(...samples.map((sample) => sample.rttMs));
  const maxRttMs = Math.max(...samples.map((sample) => sample.rttMs));
  const elapsedMs = samples.reduce((sum, sample) => sum + sample.rttMs, 0);
  const throughputMbps = elapsedMs > 0 ? ((samples.length * payloadBytes * 8) / elapsedMs / 1000) : 0;

  return {
    protocol,
    iterations: samples.length,
    averageRttMs: Number(averageRttMs.toFixed(2)),
    minRttMs: Number(minRttMs.toFixed(2)),
    maxRttMs: Number(maxRttMs.toFixed(2)),
    throughputMbps: Number(throughputMbps.toFixed(3)),
    payloadBytes,
  };
}

function sendTcpEnvelope(envelope, port = TCP_PORT, host = HOST, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ port, host });
    let buffer = '';
    let settled = false;

    const finish = (error, result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish(new Error('TCP request timed out.'));
    }, timeoutMs);

    socket.on('connect', () => {
      socket.write(encodeLine(envelope));
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const messages = decodeLines(buffer);
      if (messages.length > 0) {
        const parsed = messages[0];
        finish(null, parsed);
      }
    });

    socket.on('error', (error) => finish(error));
  });
}

function sendUdpEnvelope(envelope, port = UDP_PORT, host = HOST, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;

    const finish = (error, result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish(new Error('UDP request timed out.'));
    }, timeoutMs);

    socket.once('message', (message) => {
      const parsed = safeJsonParse(message.toString('utf8'));
      if (!parsed.ok) {
        finish(new Error(parsed.error));
        return;
      }
      finish(null, parsed.value);
    });

    socket.once('error', (error) => finish(error));
    socket.send(Buffer.from(JSON.stringify(envelope), 'utf8'), port, host, (error) => {
      if (error) {
        finish(error);
      }
    });
  });
}

async function handleTransportEnvelope({ protocol, envelope, remoteAddress, remotePort }) {
  const receivedAt = Date.now();
  const kind = envelope && envelope.kind ? envelope.kind : 'unknown';

  if (kind === 'telemetry') {
    const user = envelope.meta && envelope.meta.userId
      ? { id: envelope.meta.userId, name: envelope.meta.userName || 'Network Client' }
      : null;
    const result = await registerTelemetryRecord({
      ingestChannel: protocol,
      transportProtocol: protocol,
      user,
      payload: envelope.payload || {},
      remoteAddress,
      remotePort,
      rttMs: envelope.meta && envelope.meta.sentAt ? receivedAt - new Date(envelope.meta.sentAt).getTime() : null,
      source: 'transport',
    });

    const ack = buildAck({
      protocol,
      kind,
      record: result.record,
      message: 'telemetry stored',
      extra: {
        receivedAt: new Date(receivedAt).toISOString(),
      },
    });

    broadcast('telemetry', result.record);
    if (result.alert) {
      broadcast('alert', result.alert);
    }
    broadcast('dashboard', summarizeDashboard(await getState()));
    return ack;
  }

  if (kind === 'ping') {
    return buildAck({
      protocol,
      kind,
      message: 'pong',
      extra: {
        receivedAt: new Date(receivedAt).toISOString(),
      },
    });
  }

  if (kind === 'benchmark') {
    return buildAck({
      protocol,
      kind,
      message: 'benchmark echo',
      extra: {
        receivedAt: new Date(receivedAt).toISOString(),
        payloadBytes: Buffer.byteLength(JSON.stringify(envelope.payload || {}), 'utf8'),
      },
    });
  }

  return {
    ok: false,
    protocol,
    kind,
    message: 'unsupported transport message',
  };
}

function startTcpServer() {
  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const parsed = safeJsonParse(line.trim());
        if (!parsed.ok) {
          socket.write(encodeLine({ ok: false, message: parsed.error }));
          continue;
        }

        const response = await handleTransportEnvelope({
          protocol: 'TCP',
          envelope: parsed.value,
          remoteAddress: socket.remoteAddress,
          remotePort: socket.remotePort,
        });
        socket.write(encodeLine(response));
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(TCP_PORT, HOST, () => resolve(server));
  });
}

function startUdpServer() {
  const socket = dgram.createSocket('udp4');

  socket.on('message', async (message, rinfo) => {
    const parsed = safeJsonParse(message.toString('utf8'));
    let response;
    if (!parsed.ok) {
      response = { ok: false, protocol: 'UDP', message: parsed.error };
    } else {
      response = await handleTransportEnvelope({
        protocol: 'UDP',
        envelope: parsed.value,
        remoteAddress: rinfo.address,
        remotePort: rinfo.port,
      });
    }

    socket.send(Buffer.from(JSON.stringify(response), 'utf8'), rinfo.port, rinfo.address);
  });

  return new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(UDP_PORT, HOST, () => resolve(socket));
  });
}

async function runTransportBenchmark(protocol, iterations = 5, payloadSize = 128) {
  const messagePayload = {
    deviceName: `${protocol}-probe`,
    metricName: 'latency',
    value: 1,
    unit: 'probe',
    notes: 'benchmark measurement',
    threshold: null,
    padding: 'x'.repeat(Math.max(0, payloadSize)),
  };

  const samples = [];

  for (let index = 0; index < iterations; index += 1) {
    const sentAt = Date.now();
    const envelope = {
      kind: 'ping',
      payload: messagePayload,
      meta: {
        sentAt: new Date(sentAt).toISOString(),
        sequence: index + 1,
      },
    };

    const response = protocol === 'TCP'
      ? await sendTcpEnvelope(envelope)
      : await sendUdpEnvelope(envelope);

    const rttMs = Date.now() - sentAt;
    samples.push({
      sequence: index + 1,
      rttMs,
      response,
    });
  }

  const summary = createBenchmarkSummary(protocol, samples, Buffer.byteLength(JSON.stringify(messagePayload), 'utf8'));
  let record = null;

  await store.mutate((state) => {
    record = buildBenchmarkEntry(state, {
      protocol,
      iterations: summary.iterations,
      averageRttMs: summary.averageRttMs,
      minRttMs: summary.minRttMs,
      maxRttMs: summary.maxRttMs,
      throughputMbps: summary.throughputMbps,
      payloadBytes: summary.payloadBytes,
    });

    state.metrics.benchmarks.push(record);
    state.metrics.lastUpdated = new Date().toISOString();
    if (state.metrics.benchmarks.length > 50) {
      state.metrics.benchmarks.splice(0, state.metrics.benchmarks.length - 50);
    }
    state.logs.push(buildLogEntry(state, 'info', `${protocol} benchmark completed.`, {
      benchmarkId: record.id,
      averageRttMs: summary.averageRttMs,
    }));
    if (state.logs.length > 300) {
      state.logs.splice(0, state.logs.length - 300);
    }
  });

  broadcast('benchmark', record);
  broadcast('dashboard', summarizeDashboard(await getState()));

  return { summary, record, samples };
}

app.get('/api/health', async (_req, res) => {
  const state = await getState();
  return sendJson(res, 200, {
    ok: true,
    service: 'NetPulse',
    message: 'Server is healthy.',
    protocol: summarizeProtocol(),
    counts: {
      users: state.users.length,
      telemetry: state.telemetry.length,
      alerts: state.alerts.length,
      benchmarks: state.metrics.benchmarks.length,
    },
  });
});

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return sendJson(res, 400, {
      ok: false,
      message: 'Provide a name, a valid email and a password with at least 6 characters.',
    });
  }

  const state = await getState();
  const duplicate = state.users.find((user) => user.email === email);
  if (duplicate) {
    return sendJson(res, 409, {
      ok: false,
      message: 'This email is already registered.',
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: randomUUID(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await store.mutate((currentState) => {
    currentState.users.push(user);
    currentState.logs.push(buildLogEntry(currentState, 'info', 'New user registered.', { email }));
    if (currentState.users.length > 100) {
      currentState.users.splice(0, currentState.users.length - 100);
    }
  });

  await writeLog('info', 'Registration completed.', { email });
  return sendJson(res, 201, {
    ok: true,
    message: 'Registration completed.',
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return sendJson(res, 400, {
      ok: false,
      message: 'Email and password are required.',
    });
  }

  const state = await getState();
  const user = state.users.find((candidate) => candidate.email === email);
  if (!user) {
    return sendJson(res, 401, {
      ok: false,
      message: 'Invalid credentials.',
    });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return sendJson(res, 401, {
      ok: false,
      message: 'Invalid credentials.',
    });
  }

  const token = createToken();
  await store.mutate((currentState) => {
    currentState.tokens[token] = {
      userId: user.id,
      createdAt: new Date().toISOString(),
    };
    currentState.logs.push(buildLogEntry(currentState, 'info', 'User logged in.', { userId: user.id }));
  });

  return sendJson(res, 200, {
    ok: true,
    message: 'Login successful.',
    token,
    user: sanitizeUser(user),
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await store.mutate((state) => {
    delete state.tokens[req.auth.token];
    state.logs.push(buildLogEntry(state, 'info', 'User logged out.', { userId: req.auth.user.id }));
  });

  return sendJson(res, 200, {
    ok: true,
    message: 'Logout successful.',
  });
});

app.get('/api/me', requireAuth, async (req, res) => {
  return sendJson(res, 200, {
    ok: true,
    user: sanitizeUser(req.auth.user),
  });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const state = await getState();
  return sendJson(res, 200, {
    ok: true,
    dashboard: summarizeDashboard(state, req.auth.user),
  });
});

app.get('/api/telemetry', requireAuth, async (req, res) => {
  const state = await getState();
  const limit = Math.min(Number.parseInt(req.query.limit || '25', 10) || 25, 100);
  const telemetry = [...state.telemetry].slice(-limit).reverse();
  return sendJson(res, 200, {
    ok: true,
    telemetry,
  });
});

app.get('/api/alerts', requireAuth, async (req, res) => {
  const state = await getState();
  const limit = Math.min(Number.parseInt(req.query.limit || '25', 10) || 25, 100);
  const alerts = [...state.alerts].slice(-limit).reverse();
  return sendJson(res, 200, {
    ok: true,
    alerts,
  });
});

app.get('/api/logs', requireAuth, async (req, res) => {
  const state = await getState();
  const limit = Math.min(Number.parseInt(req.query.limit || '25', 10) || 25, 100);
  const logs = [...state.logs].slice(-limit).reverse();
  return sendJson(res, 200, {
    ok: true,
    logs,
  });
});

app.get('/api/protocol', async (_req, res) => {
  return sendJson(res, 200, {
    ok: true,
    protocol: summarizeProtocol(),
  });
});

app.post('/api/telemetry/http', requireAuth, async (req, res) => {
  const startedAt = Date.now();
  const result = await registerTelemetryRecord({
    ingestChannel: 'HTTP',
    transportProtocol: null,
    user: req.auth.user,
    payload: req.body || {},
    source: 'browser',
    rttMs: Date.now() - startedAt,
  });

  broadcast('telemetry', result.record);
  if (result.alert) {
    broadcast('alert', result.alert);
  }
  broadcast('dashboard', summarizeDashboard(await getState(), req.auth.user));

  return sendJson(res, 201, {
    ok: true,
    message: 'HTTP telemetry stored.',
    record: result.record,
    alert: result.alert,
  });
});

app.post('/api/transport/send', requireAuth, async (req, res) => {
  const protocol = String(req.body.protocol || '').trim().toUpperCase();
  if (!['TCP', 'UDP'].includes(protocol)) {
    return sendJson(res, 400, {
      ok: false,
      message: 'protocol must be TCP or UDP',
    });
  }

  const payload = normalizeTelemetryPayload(req.body);
  const paddingSize = Math.min(Math.max(Number.parseInt(req.body.padding || '0', 10) || 0, 0), 2048);
  if (paddingSize > 0) {
    payload.padding = 'x'.repeat(paddingSize);
  }
  const envelope = {
    kind: 'telemetry',
    payload,
    meta: {
      userId: req.auth.user.id,
      userName: req.auth.user.name,
      sentAt: new Date().toISOString(),
    },
  };

  const startedAt = Date.now();
  const response = protocol === 'TCP'
    ? await sendTcpEnvelope(envelope)
    : await sendUdpEnvelope(envelope);

  return sendJson(res, 200, {
    ok: true,
    message: `${protocol} transport relay completed.`,
    transport: protocol,
    rttMs: Date.now() - startedAt,
    response,
  });
});

app.post('/api/benchmark/run', requireAuth, async (req, res) => {
  const iterations = Math.min(Math.max(Number.parseInt(req.body.iterations || '5', 10) || 5, 1), 20);
  const payloadSize = Math.min(Math.max(Number.parseInt(req.body.payloadSize || '128', 10) || 128, 16), 2048);

  const tcp = await runTransportBenchmark('TCP', iterations, payloadSize);
  const udp = await runTransportBenchmark('UDP', iterations, payloadSize);

  return sendJson(res, 200, {
    ok: true,
    message: 'Benchmarks completed.',
    tcp: tcp.summary,
    udp: udp.summary,
  });
});

app.get('/api/metrics', requireAuth, async (_req, res) => {
  const state = await getState();
  return sendJson(res, 200, {
    ok: true,
    metrics: state.metrics,
  });
});

app.get('/', (_req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('*', (_req, res) => {
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

wsServer.on('connection', async (socket, request) => {
  wsClients.add(socket);

  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const token = requestUrl.searchParams.get('token');
  let user = null;
  if (token) {
    const state = await getState();
    const session = state.tokens[token];
    if (session) {
      user = sanitizeUser(state.users.find((candidate) => candidate.id === session.userId));
    }
  }

  socket.send(JSON.stringify({
    event: 'connected',
    payload: {
      message: 'Live dashboard connected.',
      user,
      timestamp: new Date().toISOString(),
    },
  }));

  socket.on('close', () => {
    wsClients.delete(socket);
  });

  socket.on('error', () => {
    wsClients.delete(socket);
  });
});

async function start() {
  await store.load();
  const tcpServer = await startTcpServer();
  const udpServer = await startUdpServer();

  await new Promise((resolve) => {
    httpServer.listen(PORT, HOST, resolve);
  });

  await writeLog('info', 'NetPulse server started.', {
    host: HOST,
    httpPort: PORT,
    tcpPort: TCP_PORT,
    udpPort: UDP_PORT,
  });

  console.log(`NetPulse ready on http://${HOST}:${PORT}`);
  console.log(`TCP transport on ${HOST}:${TCP_PORT}`);
  console.log(`UDP transport on ${HOST}:${UDP_PORT}`);

  const shutdown = async () => {
    tcpServer.close();
    udpServer.close();
    wsServer.close();
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start NetPulse:', error);
    process.exit(1);
  });
}

module.exports = {
  app,
  buildAck,
  createBenchmarkSummary,
  handleTransportEnvelope,
  normalizeTelemetryPayload,
  registerTelemetryRecord,
  runTransportBenchmark,
  sendTcpEnvelope,
  sendUdpEnvelope,
  start,
  startTcpServer,
  startUdpServer,
  store,
  summarizeDashboard,
};
