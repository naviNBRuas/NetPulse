function safeJsonParse(text) {
  if (typeof text !== 'string') {
    return { ok: false, error: 'payload must be a string' };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: 'invalid JSON payload' };
  }
}

function encodeLine(message) {
  return `${JSON.stringify(message)}\n`;
}

function decodeLines(bufferText) {
  if (!bufferText) {
    return [];
  }

  return bufferText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => safeJsonParse(line))
    .filter((result) => result.ok)
    .map((result) => result.value);
}

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeTelemetryPayload(input = {}) {
  const deviceName = String(input.deviceName || 'Unknown Device').trim() || 'Unknown Device';
  const metricName = String(input.metricName || 'metric').trim() || 'metric';
  const value = toNumber(input.value, 0);
  const unit = String(input.unit || '').trim();
  const notes = String(input.notes || '').trim();
  const threshold = input.threshold === undefined || input.threshold === null || input.threshold === ''
    ? null
    : toNumber(input.threshold, null);

  return {
    deviceName,
    metricName,
    value,
    unit,
    notes,
    threshold,
  };
}

function createEnvelope(kind, payload, meta = {}) {
  return {
    kind,
    payload,
    meta: {
      sentAt: new Date().toISOString(),
      ...meta,
    },
  };
}

function buildAck({ protocol, kind, record = null, message = 'ok', extra = {} }) {
  return {
    ok: true,
    protocol,
    kind,
    message,
    record,
    ...extra,
  };
}

function summarizeProtocol() {
  return {
    application: 'NetPulse',
    http: {
      baseRoute: '/api',
      contentType: 'application/json',
      auth: 'Bearer token issued at login',
    },
    websocket: {
      path: '/ws',
      purpose: 'live dashboard updates, alerts and counters',
    },
    tcp: {
      portRole: 'transport relay and benchmark channel',
      framing: 'newline-delimited JSON',
    },
    udp: {
      portRole: 'transport relay and benchmark channel',
      framing: 'single JSON datagram',
    },
  };
}

module.exports = {
  buildAck,
  createEnvelope,
  decodeLines,
  encodeLine,
  normalizeTelemetryPayload,
  safeJsonParse,
  summarizeProtocol,
};
