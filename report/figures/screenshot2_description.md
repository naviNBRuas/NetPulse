# Wireshark Analysis: Screenshot 2 (`screenshot2.jpg`)

## Overview
This file isolates HTTP traffic relating explicitly to a telemetry endpoint on port `3000`, focusing on a specific sensor submission transaction.

* **Display Filter:** `http.request.uri contains "/api/telemetry/http"`
* **Total Packets:** 166 | **Displayed Packets:** 2 (1.2%)

## Packet List Pane
Two packets matching the filter are shown:
1. **Frame 53:** `POST /api/telemetry/http HTTP/1.1` (Length: 484)
2. **Frame 58:** `HTTP/1.1 201 Created` (Length: 976) — The server's successful response payload.

## Packet Details Pane (Frame 53 Selected)
**Frame 53** is selected, highlighting its underlying HTTP headers and structured data:
* **HTTP Request Headers:** Includes an authentication header: `Authorization: Bearer 0e7db222-bf70-475b-a580-a772b5a018af`.
* **JSON Object Breakdown:** The application payload transmits structured metrics data:
  * `deviceName`: `"Capture Sensor"`
  * `metricName`: `"temperature"`
  * `value`: `31.2`
  * `unit`: `"°C"`
  * `threshold`: `30`
  * `notes`: `"capture http sample"`

## Packet Bytes Pane
The ASCII text view on the right side highlights the exact text layout of the bearer token authorization string and reveals how the custom degree character (`°`) is formatted inside the hex data.
