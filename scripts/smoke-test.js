const assert = require('assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');

const ROOT = path.join(__dirname, '..');
const SERVER_ENTRY = path.join(ROOT, 'server', 'app.js');

async function waitForHealth(baseUrl, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // keep trying until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server did not become healthy in time.');
}

async function requestJson(url, options = {}) {
  const { headers: customHeaders = {}, ...rest } = options;
  const response = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
  });

  const payload = await response.json();
  assert.ok(response.ok, payload.message || `Request failed: ${response.status}`);
  return payload;
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'netpulse-'));
  const dataFile = path.join(tempDir, 'state.json');
  const env = {
    ...process.env,
    PORT: '3100',
    TCP_PORT: '4101',
    UDP_PORT: '4102',
    HOST: '127.0.0.1',
    NETPULSE_DATA_FILE: dataFile,
  };

  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  try {
    const baseUrl = 'http://127.0.0.1:3100';
    await waitForHealth(baseUrl);

    const email = `student-${randomUUID()}@example.com`;
    const password = 'netpulse123';

    const register = await requestJson(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'NetPulse Tester',
        email,
        password,
      }),
    });
    assert.equal(register.ok, true);

    const login = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.ok, true);
    assert.ok(login.token);

    const authHeaders = {
      Authorization: `Bearer ${login.token}`,
    };

    const httpTelemetry = await requestJson(`${baseUrl}/api/telemetry/http`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        deviceName: 'Smoke Sensor',
        metricName: 'temperature',
        value: 25.2,
        unit: '°C',
        threshold: 30,
        notes: 'Smoke test reading',
      }),
    });
    assert.equal(httpTelemetry.record.ingestChannel, 'HTTP');

    const relayTcp = await requestJson(`${baseUrl}/api/transport/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        protocol: 'TCP',
        deviceName: 'TCP Probe',
        metricName: 'latency',
        value: 1,
        unit: 'probe',
        notes: 'TCP relay',
      }),
    });
    assert.equal(relayTcp.transport, 'TCP');

    const relayUdp = await requestJson(`${baseUrl}/api/transport/send`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        protocol: 'UDP',
        deviceName: 'UDP Probe',
        metricName: 'latency',
        value: 1,
        unit: 'probe',
        notes: 'UDP relay',
      }),
    });
    assert.equal(relayUdp.transport, 'UDP');

    const benchmark = await requestJson(`${baseUrl}/api/benchmark/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ iterations: 2, payloadSize: 64 }),
    });
    assert.ok(benchmark.tcp.averageRttMs >= 0);
    assert.ok(benchmark.udp.averageRttMs >= 0);

    const dashboard = await requestJson(`${baseUrl}/api/dashboard`, {
      method: 'GET',
      headers: authHeaders,
    });
    assert.ok(dashboard.dashboard.counts.telemetry >= 3);
    assert.ok(dashboard.dashboard.counts.benchmarks >= 2);

    console.log('Smoke test passed.');
  } finally {
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
