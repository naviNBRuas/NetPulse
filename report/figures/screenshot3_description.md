# Wireshark Analysis: Screenshot 3 (`screenshot3.jpg`)

## Overview
This file shifts away from HTTP layer decoding to view raw, low-level TCP connection states over a different backend port (`4001`).

* **Display Filter:** `tcp.port == 4001`
* **Total Packets:** 172 | **Displayed Packets:** 40 (23.3%)

## Packet List Pane
A sequence of raw TCP flow steps (handshakes, transmissions, and connection terminations) is shown. The colored rows illustrate standard Wireshark conventions (e.g., dark grey/purple for control flags like SYN, FIN, or RST).

## Packet Details Pane (Frame 63 Selected)
**Frame 63** is selected, which is an inbound synchronization response from the server side of the connection:
* **Ports:** Source Port: `4001`, Destination Port: `51198`.
* **TCP Flags:** Explicitly expands `Flags: 0x012 (SYN, ACK)`. This tells us it is step 2 of the classic TCP 3-way handshake.
* **TCP Window Size:** Calculated window size is `65495`.

## Packet Bytes Pane
Because there is no application layer (like HTTP) present in this packet, the raw byte mapping is short, ending abruptly after the 32-byte TCP options headers.
