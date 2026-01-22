# ACLAS PS6X Scale Middleware

A production-ready Python middleware service that integrates an ACLAS PS6X weighing scale with the SmartStock PWA POS system.

## Architecture

```
┌─────────────────┐     RS-232/USB     ┌─────────────────────┐     WebSocket     ┌─────────────────┐
│  ACLAS PS6X     │ ─────────────────► │  Python Middleware  │ ───────────────► │   PWA POS       │
│  Scale          │                    │  (scale_middleware) │                   │   (Browser)     │
└─────────────────┘                    └─────────────────────┘                   └─────────────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │ Transaction Log │
                                       │ (JSON Lines)    │
                                       └─────────────────┘
```

## Requirements

- Python 3.10 or higher
- ACLAS PS6X scale connected via RS-232 or USB-to-Serial adapter
- Windows or Linux operating system

## Installation

### 1. Install Python Dependencies

```bash
pip install pyserial websockets
```

Or use the requirements file:

```bash
pip install -r requirements.txt
```

### 2. Configure the Middleware

Edit `config.json` to match your setup:

```json
{
  "serial": {
    "port": "COM3",        // Windows: COM3, Linux: /dev/ttyUSB0
    "baud_rate": 9600,
    "data_bits": 8,
    "parity": "N",         // N=None, E=Even, O=Odd
    "stop_bits": 1,
    "timeout": 1.0
  },
  "websocket": {
    "host": "localhost",
    "port": 8765
  },
  "plu_prices": {
    "0001": 850.00,        // PLU code -> price per kg (KSh)
    "0002": 1200.00
  }
}
```

### 3. Find Your Serial Port

**Windows:**
- Open Device Manager
- Look under "Ports (COM & LPT)"
- Note the COM port number (e.g., COM3)

**Linux:**
- Run: `ls /dev/ttyUSB*` or `ls /dev/ttyACM*`
- Note the device path (e.g., /dev/ttyUSB0)

**Using Python:**
```python
import serial.tools.list_ports
ports = serial.tools.list_ports.comports()
for port in ports:
    print(f"{port.device}: {port.description}")
```

## Running the Middleware

### Basic Usage

```bash
python scale_middleware.py
```

### Running as a Background Service

**Windows (PowerShell):**
```powershell
Start-Process python -ArgumentList "scale_middleware.py" -WindowStyle Hidden
```

**Linux (systemd):**

Create `/etc/systemd/system/scale-middleware.service`:

```ini
[Unit]
Description=ACLAS PS6X Scale Middleware
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/middleware
ExecStart=/usr/bin/python3 scale_middleware.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable scale-middleware
sudo systemctl start scale-middleware
```

## WebSocket Protocol

### Connection

Connect to: `ws://localhost:8765`

### Messages from Middleware

**Connection Confirmation:**
```json
{
  "type": "connected",
  "message": "Connected to ACLAS PS6X Scale Middleware",
  "timestamp": "2024-01-15T10:30:00.000000"
}
```

**Scale Reading:**
```json
{
  "product_id": "0001",
  "weight": 1.234,
  "unit_price": 850.00,
  "total_price": 1048.90,
  "timestamp": "2024-01-15T10:30:15.123456"
}
```

### Messages to Middleware

**Ping/Pong:**
```json
{"type": "ping"}
```
Response:
```json
{"type": "pong"}
```

## ACLAS PS6X Protocol Notes

The middleware supports multiple ACLAS output formats:

1. **Full Format:** `P0001W+001.234U0850.00T1048.90`
   - P = PLU code
   - W = Weight (with sign)
   - U = Unit price
   - T = Total price

2. **PLU + Weight:** `P0001W+001.234`
   - Unit price looked up from config

3. **Weight Only:** `W+001.234`
   - Uses default PLU "0000"

4. **Simple Format:** `1.234kg`
   - Basic weight output

## Stability Filtering

The middleware filters readings to ensure accuracy:

1. **Stability Threshold:** Ignores weight changes < 0.01 kg
2. **Consecutive Readings:** Requires 3 stable readings
3. **Duplicate Prevention:** Won't re-send same weight within 2 seconds

## Transaction Logging

All transactions are logged to `transactions.log` in JSON Lines format:

```json
{"product_id": "0001", "weight": 1.234, "unit_price": 850.0, "total_price": 1048.9, "timestamp": "2024-01-15T10:30:15.123456"}
{"product_id": "0002", "weight": 0.567, "unit_price": 1200.0, "total_price": 680.4, "timestamp": "2024-01-15T10:31:22.654321"}
```

## Troubleshooting

### Scale Not Detected

1. Check physical connection
2. Verify correct COM port in config
3. Check baud rate matches scale settings (usually 9600)
4. Ensure no other program is using the port

### WebSocket Connection Failed

1. Verify middleware is running
2. Check firewall settings
3. Ensure port 8765 is not in use
4. Try different port in config

### Unstable Readings

1. Increase `stability_threshold` in config
2. Increase `stability_readings` count
3. Check scale is on stable surface
4. Calibrate the scale

### No Data Received

1. Check scale protocol settings
2. Try different baud rates
3. Monitor raw serial data:
   ```python
   import serial
   ser = serial.Serial('COM3', 9600, timeout=1)
   while True:
       print(repr(ser.readline()))
   ```

## PWA Integration

The SmartStock POS connects to this middleware via WebSocket. In the Scale Integration page:

1. Enter the middleware URL: `ws://localhost:8765`
2. Click "Connect"
3. Place items on scale
4. Total price is automatically calculated and sent to POS

## Security Considerations

- Middleware runs on localhost only by default
- No authentication (assumes trusted local network)
- For remote access, implement TLS and authentication

## License

Proprietary - SmartStock POS System
