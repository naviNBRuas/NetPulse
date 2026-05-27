const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');

function createDefaultState() {
  return {
    users: [],
    tokens: {},
    telemetry: [],
    alerts: [],
    logs: [],
    metrics: {
      benchmarks: [],
      lastUpdated: null,
    },
    nextIds: {
      telemetry: 1,
      alerts: 1,
      logs: 1,
      benchmarks: 1,
    },
  };
}

function normalizeState(input) {
  const base = createDefaultState();
  if (!input || typeof input !== 'object') {
    return base;
  }

  if (Array.isArray(input.users)) base.users = input.users;
  if (input.tokens && typeof input.tokens === 'object') base.tokens = input.tokens;
  if (Array.isArray(input.telemetry)) base.telemetry = input.telemetry;
  if (Array.isArray(input.alerts)) base.alerts = input.alerts;
  if (Array.isArray(input.logs)) base.logs = input.logs;
  if (input.metrics && typeof input.metrics === 'object') {
    base.metrics = {
      benchmarks: Array.isArray(input.metrics.benchmarks) ? input.metrics.benchmarks : [],
      lastUpdated: input.metrics.lastUpdated || null,
    };
  }
  if (input.nextIds && typeof input.nextIds === 'object') {
    base.nextIds = {
      telemetry: Number.isInteger(input.nextIds.telemetry) ? input.nextIds.telemetry : 1,
      alerts: Number.isInteger(input.nextIds.alerts) ? input.nextIds.alerts : 1,
      logs: Number.isInteger(input.nextIds.logs) ? input.nextIds.logs : 1,
      benchmarks: Number.isInteger(input.nextIds.benchmarks) ? input.nextIds.benchmarks : 1,
    };
  }
  return base;
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = null;
    this.loadingPromise = null;
  }

  async load() {
    if (this.state) {
      return this.state;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = (async () => {
        try {
          const raw = await fs.readFile(this.filePath, 'utf8');
          this.state = normalizeState(JSON.parse(raw));
        } catch (error) {
          if (error.code === 'ENOENT') {
            this.state = createDefaultState();
            await this.save();
          } else {
            throw error;
          }
        }
        return this.state;
      })();
    }

    return this.loadingPromise;
  }

  async save() {
    if (!this.state) {
      this.state = createDefaultState();
    }

    await ensureParentDir(this.filePath);
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), 'utf8');
    await fs.rename(tempPath, this.filePath);
  }

  async mutate(mutator) {
    const state = await this.load();
    const result = await mutator(state);
    await this.save();
    return result;
  }
}

function createStateStore(filePath) {
  return new StateStore(filePath);
}

function nextId(state, scope) {
  const current = state.nextIds[scope] || 1;
  state.nextIds[scope] = current + 1;
  return current;
}

function buildLogEntry(state, level, message, context = {}) {
  return {
    id: nextId(state, 'logs'),
    level,
    message,
    context,
    createdAt: new Date().toISOString(),
  };
}

function buildAlertEntry(state, payload) {
  return {
    id: nextId(state, 'alerts'),
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

function buildTelemetryEntry(state, payload) {
  return {
    id: nextId(state, 'telemetry'),
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

function buildBenchmarkEntry(state, payload) {
  return {
    id: nextId(state, 'benchmarks'),
    createdAt: new Date().toISOString(),
    ...payload,
  };
}

function createToken() {
  return randomUUID();
}

module.exports = {
  buildAlertEntry,
  buildBenchmarkEntry,
  buildLogEntry,
  buildTelemetryEntry,
  createDefaultState,
  createStateStore,
  createToken,
  nextId,
  normalizeState,
};
