# Shelly Plus UNI - Smart Water Meter & Leak Detection Script

An **mJS script** for the **Shelly Plus UNI** (Gen2/Gen3) configured as a pulse water meter (1 pulse = 1 Liter). It provides real-time LED visual indicators, continuous flow leak detection, and multi-channel Telegram notifications (Alert & Info).

---

## English Documentation

### Overview & Role of Shelly Plus UNI

The **Shelly Plus UNI** is a tiny, versatile Wi-Fi smart module operating on low voltage (AC/DC). In this setup, it acts as an edge water monitoring system:
- **Pulse Counting:** Reads hardware pulse inputs from a water meter using its dedicated pulse counter component (`input:2`).
- **Visual Output:** Controls two solid-state relay outputs (Relay 0 and Relay 1) connected to indicator LEDs.
- **Embedded Scripting:** Runs the embedded mJS engine locally without relying on an external home automation server.

### Features
- **Pulse Counter Synchronization:** Reads `input:2` on boot (`Shelly.GetStatus`) to match the hardware pulse counter.
- **Status Event Handling:** Uses `Shelly.addStatusHandler` to intercept every pulse increment on `input:2`.
- **Inverted Liter Pulse LED (Yellow / Relay 0):** Yellow light stays **ON** by default and blinks **OFF for 2 seconds** per liter consumed.
- **Milestone Indicator LED (Blue / Relay 1):** Blue light turns **ON for 5 seconds** every **10 Liters**.
- **Leak & High-Flow Detection:** Detects continuous water flow (pulse gap < 60s). Triggers an alert if flow exceeds **5 minutes**, repeating every **10 minutes** until water stops.
- **Multi-Channel Telegram System:**
  - **Alert Channel:** Receives leak and continuous high-flow warning notifications.
  - **Info Channel:** Receives boot status (Device Name, Device ID, IP address, system time, initial index) and hourly usage reports (only if water was consumed during that hour, showing 60-min volume, daily total, and current meter index).
- **JSON KVS Configuration:** Stores Telegram bot token and chat IDs securely in the device's internal Key-Value Store.

---

### Hardware Wiring

| Device Pin | Connection Target | Function |
|---|---|---|
| **COUNT IN / IN-1 / IN-2** | Pulse Water Meter Output | Hardware Pulse Input (`input:2`) |
| **OUT-1 (Relay 0)** | Yellow LED Indicator | Inverted Pulse Flash (Normally ON) |
| **OUT-2 (Relay 1)** | Blue LED Indicator | Milestone Indicator (10 L) |

> **Warning:** Relays on the Shelly Plus UNI support a maximum load of **250 mA** (30VDC / 24VAC). Ensure LED indicators do not exceed this threshold.

---

### Configuration

#### 1. Setting up Telegram Credentials in KVS
Store your Telegram configuration as a JSON string inside the Shelly KVS under the key `telegram_config`:

```json
{
  "bot_token": "YOUR_TELEGRAM_BOT_TOKEN",
  "alert_chat_id": "YOUR_ALERT_CHAT_ID",
  "info_chat_id": "YOUR_INFO_CHAT_ID"
}
