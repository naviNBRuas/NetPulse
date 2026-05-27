# Wireshark Analysis: Screenshot 1 (`screenshot1.jpg`)

## Overview
This file details the Wireshark interface displaying a list of intercepted HTTP POST requests targeted at a local server running on port `3000`.

* **Display Filter:** `http.request.method == "POST" && tcp.port == 3000`
* **Total Packets:** 160 | **Displayed Packets:** 6 (3.8%)
* **Active Capture File:** `wireshark_LoopbackDNC3P3.pcapng`

## Packet List Pane
Six HTTP POST packets are displayed in the top list, all traveling locally from `127.0.0.1` to `127.0.0.1` via the `HTTP/JSON` protocol:
1. **Frame 39:** `POST /api/auth/register HTTP/1.1`
2. **Frame 46:** `POST /api/auth/login HTTP/1.1`
3. **Frame 53:** `POST /api/telemetry/http HTTP/1.1`
4. **Frame 63:** `POST /api/transport/send HTTP/1.1`
5. **Frame 77:** `POST /api/transport/send HTTP/1.1`
6. **Frame 85:** `POST /api/benchmark/run HTTP/1.1`

## Packet Details Pane (Frame 39 Selected)
The details view focuses on **Frame 39**, expanding the network layers down to the application payload:
* **Transport Layer:** Transmission Control Protocol (TCP), Source Port: `51656`, Destination Port: `3000`.
* **Application Layer:** JavaScript Object Notation (`application/json`) is parsed, revealing a cleartext user registration payload:
  * `name`: `"Capture User"`
  * `email`: `"capture.1779866337591@example.com"`
  * `password`: `"netpulse123"`

## Packet Bytes Pane
The raw hex and text interpretation section on the right shows the standard HTTP header layout, ending with the raw JSON string:
`{"name":"Capture User","email":"capture.1779866337591@example.com","password":"netpulse123"}`
