# Wireshark Analysis: Screenshot 4 (`screenshot4.jpg`)

## Overview
This file captures connectionless UDP streaming datagrams sent over port `4002`.

* **Display Filter:** `udp.port == 4002`
* **Total Packets:** 180 | **Displayed Packets:** 8 (4.4%)

## Packet List Pane
Lists 8 simple UDP items moving between port `4002` and various ephemeral ports (like `52943`, `42112`, `32937`, and `41288`).

## Packet Details Pane (Frame 83 Selected)
**Frame 83** is selected:
* **Layer Data:** User Datagram Protocol, Src Port: `4002`, Dst Port: `52943`, Payload Length: `519` bytes.
* The raw protocol parser stops at the generic "**Data**" type layer because Wireshark does not natively classify port `4002` as a structured application protocol.

## Packet Bytes Pane
Crucially, the ASCII dump on the right shows that the application payload is unencrypted JSON text. It details a status response stating that a telemetry record has been written:
* `"ok": true, "protocol": "UDP", "kind": "telemetry", "message": "telemetry stored"`
* The embedded record block reveals details about an object named `"Capture UDP Probe"`, checking a `"latency"` metric of value `1` with an `ingestChannel` labeled `"UDP"`. Timestamps show a date of `2026-05-27`.
