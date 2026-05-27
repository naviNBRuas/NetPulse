# NetPulse application protocol

NetPulse uses a small, explicit protocol so the project can be demonstrated over HTTP, WebSocket, TCP and UDP.

## 1. HTTP

HTTP is the main browser-facing protocol.

### Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/dashboard`
- `GET /api/telemetry`
- `GET /api/alerts`
- `GET /api/logs`
- `POST /api/telemetry/http`
- `POST /api/transport/send`
- `POST /api/benchmark/run`
- `GET /api/protocol`
- `GET /api/metrics`

### Message format

All write operations use JSON:

```json
{
  "deviceName": "Lab Sensor",
  "metricName": "temperature",
  "value": 24.1,
  "unit": "°C",
  "threshold": 30,
  "notes": "Periodic reading"
}
```

Authentication uses a bearer token returned by login.

## 2. WebSocket

WebSocket is used for live dashboard updates.

- Path: `/ws`
- Purpose: push new telemetry, alerts and benchmark results without polling
- Payload: JSON object with `event` and `payload`

Example:

```json
{
  "event": "telemetry",
  "payload": {
    "id": 1,
    "deviceName": "Lab Sensor",
    "metricName": "temperature",
    "value": 24.1
  }
}
```

## 3. TCP

TCP uses newline-delimited JSON frames on port `4001` by default.

### Envelope

```json
{
  "kind": "telemetry",
  "payload": {
    "deviceName": "TCP Probe",
    "metricName": "latency",
    "value": 1,
    "unit": "probe"
  },
  "meta": {
    "sentAt": "2026-05-27T12:00:00.000Z",
    "userId": "...",
    "userName": "..."
  }
}
```

### Framing

- Each message ends with `\n`
- The server replies with one JSON line per request
- Used to demonstrate connection-oriented behavior and TCP handshake in Wireshark

## 4. UDP

UDP uses one JSON datagram per message on port `4002` by default.

### Framing

- One datagram per request
- The response is a single datagram
- Good for showing lower overhead and the possibility of packet loss or reordering

## 5. Benchmark and RTT measurement

The benchmark endpoint sends several `ping` envelopes through TCP and UDP.

Each response contains:

- `rttMs`
- `averageRttMs`
- `minRttMs`
- `maxRttMs`
- `throughputMbps`

These metrics are stored in the application state and shown in the dashboard.

## 6. Wireshark capture tips

Recommended filters:

- `http`
- `websocket`
- `tcp.port == 4001`
- `udp.port == 4002`

Recommended items to document:

- source and destination IP addresses
- ports
- TCP handshake
- UDP datagrams
- RTT
- packet sizes
- retransmissions, if any
