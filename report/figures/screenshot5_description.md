# Wireshark Analysis: Screenshot 5 (`screenshot5.jpg`)

## Overview
This file merges traffic analysis by tracking concurrent transmissions arriving over both custom backend communication channels (TCP port `4001` and UDP port `4002`).

* **Display Filter:** `tcp.port == 4001 || udp.port == 4002`
* **Total Packets:** 186 | **Displayed Packets:** 48 (25.8%)

## Packet List Pane
The pane interweaves the raw TCP rows noticed in Screenshot 3 with the data updates. **Frame 71** is highlighted.

## Packet Details Pane (Frame 71 Selected)
**Frame 71** is expanded to dissect metadata details:
* **Frame Metadata:** Arrival time is logged precisely as `May 27, 2026 07:18:57.888060187 UTC`.
* **Transport Parameters:** TCP packet from Source Port `4001` to Destination Port `51180`. Control flags are set to `0x018 (PSH, ACK)`, indicating an active push of data payload (520 bytes) to the client.

## Packet Bytes Pane
Similar to the UDP text structure in Screenshot 4, the raw text area reveals that port `4001` serves a mirrored TCP backend storage function. It outputs a confirmation string:
* `"ok": true, "protocol": "TCP", "kind": "telemetry", "message": "telemetry stored"`
* The metadata records an object titled `"Capture TCP Probe"` tracking `"latency"` metrics over the `"TCP"` ingest channel.
