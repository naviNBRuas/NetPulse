# NetPulse

NetPulse is a compact real-time monitoring platform built for the CIC0124 Computer Networks project at the University of Brasília. It demonstrates:

- browser-based client interface
- HTTP authentication and telemetry submission
- WebSocket live updates
- TCP and UDP transport relays
- RTT and throughput benchmarking
- persistent local storage
- logs and automatic alerts

## Project goals covered

- client-server architecture using sockets
- simple application protocol
- HTTP communication
- TCP vs UDP comparison
- delay, throughput and response time measurement
- scalability and performance discussion
- protocol analysis with Wireshark

## Tech stack

- Node.js
- Express
- WebSocket (`ws`)
- bcryptjs
- local JSON persistence
- plain HTML/CSS/JavaScript frontend

## Quick start

1. Install dependencies.
1. Start the server.
1. Open the browser interface.
1. Register a user and log in.
1. Send HTTP telemetry, transport relays and benchmark runs.

## Reproducibility (step-by-step)

Prerequisites:

- Node.js (16+ recommended)
- npm
- TeX Live (for building the report: `pdflatex` available)
- Wireshark (for packet captures)

1. Clone the repository and install dependencies:

```bash
git clone <repo-url> netpulse
cd netpulse
npm install
```

1. Start the server (runs HTTP, WebSocket, TCP and UDP relays):

```bash
npm start
# or for development with NODE_ENV=development
npm run dev
```

1. Open the web UI at <http://localhost:3000>, register a user and log in.

1. Capture packets in Wireshark on the loopback interface (`lo`). Useful display filters:

- `http` (all HTTP traffic)
- `tcp.port == 4001` (TCP relay)
- `udp.port == 4002` (UDP relay)

Start the capture first, then interact with the UI (register, send telemetry, run benchmark). If you prefer automated traffic, run the smoke test below while capturing.

1. Automated traffic generation (recommended for reproducible captures):

```bash
# run the smoke-test which registers a user, logs in, posts telemetry and triggers TCP/UDP relay traffic
npm test
```

When the smoke-test finishes, stop the capture and inspect the pcap in Wireshark.

1. Build the report (PDF):

```bash
npm run report:build
# the PDF is generated at report/main.pdf
```

1. Optional: generate traffic only (alias to the smoke-test):

```bash
npm run traffic:generate
```

Environment variables (optional):

- `PORT` — HTTP port (default 3000)
- `TCP_PORT` — TCP relay (default 4001)
- `UDP_PORT` — UDP relay (default 4002)
- `NETPULSE_DATA_FILE` — path to JSON data file used for persistence (default `data/state.json`)

Notes on captures:

- For clean demonstrations, start Wireshark capture, then start the server and execute the actions you want to record (or run `npm test`).
- If you need to isolate a single flow (e.g., a TCP handshake), use the TCP/UDP port filters above and start/stop the capture around the operation.
- On Linux, capturing loopback often requires root privileges (run Wireshark as root or use `dumpcap` with capabilities).

## Commands

- `npm install`
- `npm start`
- `npm test`
- `npm run report:build`

## Default ports

- HTTP/Web UI: `3000`
- TCP relay: `4001`
- UDP relay: `4002`

You can override them with environment variables:

- `PORT`
- `TCP_PORT`
- `UDP_PORT`
- `HOST`
- `NETPULSE_DATA_FILE`

## Repository layout

- `server/` — application server, persistence and transport relays
- `public/` — browser client
- `docs/` — protocol documentation
- `report/` — IEEE LaTeX report and PDF output
- `scripts/` — smoke test and automation helpers

## Report

The report is written in Portuguese in IEEE format and is stored under `report/main.tex`. After compiling, the PDF is generated in the same folder.

## Wireshark notes

Use loopback capture when testing locally. Helpful filters:

- `http`
- `tcp.port == 4001`
- `udp.port == 4002`

The transport relay and benchmark routes were created specifically so the project produces real traffic that is easy to inspect in Wireshark.

## License

This repository is intended for academic use in the networking project.

---
Files of this project are provided under the terms of the included `LICENSE` file (MIT by default). See `LICENSE` for details.
