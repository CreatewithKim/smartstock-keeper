# SmartStock POS – Scale Integration

## Overview

SmartStock is an offline-first PWA POS system with direct **Web Serial API** integration for the ACLAS PS6X weighing scale. No middleware, no Python service — the browser talks to the serial port directly.

## Architecture

```
┌─────────────────┐    RS-232 / USB-Serial    ┌──────────────────────┐
│  ACLAS PS6X     │ ────────────────────────► │  Chrome / Edge PWA   │
│  Scale (COM3)   │    Web Serial API         │  (SmartStock POS)    │
└─────────────────┘                           └──────────────────────┘
```

## Prerequisites

- **HTTPS** (or `localhost` for development)
- **Chrome / Edge** browser (Web Serial API support)
- Physical serial device connected (USB-to-Serial adapter or native RS-232)

## How the Serial Connection Works

### 1. Feature Detection

```ts
if (!('serial' in navigator)) {
  // Web Serial API not available – show error
}
```

### 2. Request Port Access (first-time)

The user must click **Connect Scale** once to grant browser permission:

```ts
const port = await navigator.serial.requestPort();
await port.open({ baudRate: 9600, dataBits: 8, parity: 'none', stopBits: 1 });
```

### 3. Auto-Detect on Startup

After the initial grant, previously authorized ports are remembered. On every page load the app calls:

```ts
const ports = await navigator.serial.getPorts();
if (ports.length > 0) {
  await ports[0].open({ baudRate: 9600 });
  // Start reading immediately
}
```

### 4. Read Serial Data (Live Weight)

```ts
const textDecoder = new TextDecoderStream();
port.readable.pipeTo(textDecoder.writable);
const reader = textDecoder.readable.getReader();

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  displayWeight(parseScaleData(value));
}
```

### 5. Display on Screen

Weight values are parsed from raw serial text and rendered in the **Live Weight Display** component in real-time. The UI shows:

- Live fluctuating weight (WEIGHING state)
- Locked stable weight (STABLE state) after 3 consecutive readings within ±0.01 kg

### 6. Error Handling

- `'serial' in navigator` check on startup
- All port operations wrapped in `try/catch`
- Disconnect events monitored via `navigator.serial.addEventListener('disconnect', ...)`

### 7. Cleanup

```ts
window.addEventListener('beforeunload', async () => {
  await reader.cancel();
  await port.close();
});
```

## Supported Scale Data Formats

The parser handles multiple ACLAS PS6X output formats:

| Format | Example | Fields |
|--------|---------|--------|
| Full ACLAS | `P0001W+001.234U0850.00T1048.90` | PLU, Weight, Unit Price, Total |
| PLU + Weight | `P0001W+001.234` | PLU, Weight |
| Weight prefix | `W1.234` or `w1.234` | Weight |
| With unit | `1.234 kg` | Weight |
| Stable prefix | `ST, 1.234` | Weight |
| Bare number | `1.234` | Weight |

> **Note:** The parser and stability detection go beyond the basic checklist because a POS system needs to extract numeric values from raw serial text and lock a stable weight before confirming a sale.

## Scale Configuration

Configurable via Settings → Scale Configuration:

| Setting | Default | Options |
|---------|---------|---------|
| Baud Rate | 9600 | 4800, 9600, 19200, 38400, 57600, 115200 |
| Parity | None | None, Even, Odd |
| Stop Bits | 1 | 1, 2 |
| Data Bits | 8 | Fixed |

## State Machine

```
DISCONNECTED → CONNECTED → WEIGHING → STABLE
     ↑              ↑          ↑         │
     └──────────────┴──────────┴─────────┘
```

- **DISCONNECTED**: No serial port open
- **CONNECTED**: Port open, waiting for data
- **WEIGHING**: Live weight data incoming (fluctuating)
- **STABLE**: 3+ consecutive readings within ±0.01 kg — sale can be confirmed

## Testing

> ⚠️ Web Serial API does **not** work inside iframes (Lovable preview). You must open the app in a **standalone browser tab** or use the **published URL** to test hardware connectivity.

1. Open the app in Chrome/Edge (standalone tab)
2. Navigate to Scale Integration
3. Click **Connect Scale** → select your COM port
4. Place an item on the scale
5. Watch the live weight update in real-time
6. Check browser console (F12) for `[Scale raw]` debug lines

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- IndexedDB (via `idb`) for offline data
- Web Serial API for hardware communication
- PWA with service worker for offline support

## Deployment

Open [Lovable](https://lovable.dev/projects/c10e6e0f-8229-49f4-995a-2219f83a8f1a) → Share → Publish.

Custom domain: Project → Settings → Domains → Connect Domain.
