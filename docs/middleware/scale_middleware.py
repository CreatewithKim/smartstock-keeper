#!/usr/bin/env python3
"""
ACLAS PS6X Scale Middleware for PWA POS Integration
====================================================
A production-ready middleware service that bridges an ACLAS PS6X weighing scale
with a locally running PWA POS system via WebSocket.

Author: SmartStock POS Integration
Version: 1.0.0
Python: 3.10+
"""

import asyncio
import json
import logging
import os
import re
import signal
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, Set

import serial
import serial.tools.list_ports
import websockets
from websockets.server import WebSocketServerProtocol

# ============================================================================
# CONFIGURATION
# ============================================================================

CONFIG_FILE = Path(__file__).parent / "config.json"
LOG_FILE = Path(__file__).parent / "transactions.log"

# Default configuration (overridden by config.json)
DEFAULT_CONFIG = {
    "serial": {
        "port": "COM3",  # Windows: COM3, Linux: /dev/ttyUSB0
        "baud_rate": 9600,
        "data_bits": 8,
        "parity": "N",  # N=None, E=Even, O=Odd
        "stop_bits": 1,
        "timeout": 1.0
    },
    "websocket": {
        "host": "localhost",
        "port": 8765
    },
    "scale": {
        "stability_threshold": 0.01,  # kg - ignore changes smaller than this
        "stability_readings": 3,       # consecutive stable readings required
        "duplicate_timeout": 2.0       # seconds before same weight is re-sent
    },
    "plu_prices": {
        # PLU code -> unit price mapping (KSh per kg)
        "0001": 850.00,
        "0002": 1200.00,
        "0003": 650.00,
        "0004": 480.00,
        "0005": 950.00
    }
}


def load_config() -> dict:
    """Load configuration from file or use defaults."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, 'r') as f:
                user_config = json.load(f)
                # Merge with defaults
                config = DEFAULT_CONFIG.copy()
                for key, value in user_config.items():
                    if isinstance(value, dict) and key in config:
                        config[key].update(value)
                    else:
                        config[key] = value
                return config
        except Exception as e:
            logging.warning(f"Failed to load config: {e}, using defaults")
    return DEFAULT_CONFIG.copy()


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class ScaleReading:
    """Represents a single scale reading event."""
    product_id: str
    weight: float
    unit_price: float
    total_price: float
    timestamp: str
    
    def to_json(self) -> str:
        return json.dumps(asdict(self))


@dataclass
class StabilityBuffer:
    """Tracks weight stability across multiple readings."""
    readings: list[float]
    last_sent_weight: Optional[float] = None
    last_sent_time: Optional[datetime] = None
    
    def add_reading(self, weight: float) -> None:
        self.readings.append(weight)
        if len(self.readings) > 10:
            self.readings.pop(0)
    
    def is_stable(self, threshold: float, required_readings: int) -> bool:
        """Check if recent readings are stable within threshold."""
        if len(self.readings) < required_readings:
            return False
        recent = self.readings[-required_readings:]
        return max(recent) - min(recent) <= threshold
    
    def get_stable_weight(self) -> float:
        """Return average of recent stable readings."""
        return round(sum(self.readings[-3:]) / 3, 3)
    
    def is_duplicate(self, weight: float, timeout: float) -> bool:
        """Check if this weight was recently sent."""
        if self.last_sent_weight is None:
            return False
        if abs(weight - self.last_sent_weight) > 0.01:
            return False
        if self.last_sent_time is None:
            return False
        elapsed = (datetime.now() - self.last_sent_time).total_seconds()
        return elapsed < timeout
    
    def mark_sent(self, weight: float) -> None:
        self.last_sent_weight = weight
        self.last_sent_time = datetime.now()


# ============================================================================
# ACLAS PS6X SCALE PARSER
# ============================================================================

class AclasPS6XParser:
    """
    Parser for ACLAS PS6X scale serial output.
    
    ACLAS PS6X Protocol (typical frame structure):
    - STX (0x02) - Start of transmission
    - PLU (4-6 digits) - Product lookup code
    - Weight (6-8 chars) - Net weight in kg, format varies
    - Unit Price (optional) - If scale has pricing enabled
    - Total (optional) - Calculated total
    - ETX (0x03) - End of transmission
    
    Common output formats:
    1. Weight-only mode: "W+001.234" (weight in kg with sign)
    2. PLU mode: "P0001W+001.234U0850.00T1049.90"
    3. Continuous mode: Repeated weight readings
    
    This parser handles multiple formats and extracts relevant data.
    """
    
    # Regex patterns for different ACLAS output formats
    PATTERNS = {
        # Format: P<PLU>W<weight>U<unit_price>T<total>
        'full': re.compile(
            r'P(\d{4,6})W([+-]?\d+\.?\d*)U(\d+\.?\d*)T(\d+\.?\d*)'
        ),
        # Format: P<PLU>W<weight> (no pricing on scale)
        'plu_weight': re.compile(
            r'P(\d{4,6})W([+-]?\d+\.?\d*)'
        ),
        # Format: W<weight> (weight only, no PLU)
        'weight_only': re.compile(
            r'W([+-]?\d+\.?\d*)'
        ),
        # Format: <weight>kg (simple weight output)
        'simple': re.compile(
            r'(\d+\.?\d*)\s*[kK][gG]'
        ),
        # Stable indicator (some scales mark stable readings)
        'stable': re.compile(r'ST|STABLE', re.IGNORECASE)
    }
    
    def __init__(self, plu_prices: dict[str, float]):
        self.plu_prices = plu_prices
        self.default_plu = "0000"
    
    def parse(self, data: bytes) -> Optional[dict]:
        """
        Parse raw serial data from the scale.
        
        Returns dict with: product_id, weight, unit_price, total_price
        Returns None if parsing fails or data is invalid.
        """
        try:
            # Decode bytes, handling common encodings
            text = data.decode('ascii', errors='ignore').strip()
            
            if not text:
                return None
            
            logging.debug(f"Parsing scale data: {repr(text)}")
            
            # Try full format first (PLU + weight + price + total)
            match = self.PATTERNS['full'].search(text)
            if match:
                plu, weight, unit_price, total = match.groups()
                return {
                    'product_id': plu,
                    'weight': float(weight),
                    'unit_price': float(unit_price),
                    'total_price': float(total)
                }
            
            # Try PLU + weight format
            match = self.PATTERNS['plu_weight'].search(text)
            if match:
                plu, weight = match.groups()
                weight = float(weight)
                unit_price = self.plu_prices.get(plu, 0.0)
                return {
                    'product_id': plu,
                    'weight': weight,
                    'unit_price': unit_price,
                    'total_price': round(weight * unit_price, 2)
                }
            
            # Try weight-only format
            match = self.PATTERNS['weight_only'].search(text)
            if match:
                weight = float(match.group(1))
                return {
                    'product_id': self.default_plu,
                    'weight': weight,
                    'unit_price': 0.0,
                    'total_price': 0.0
                }
            
            # Try simple kg format
            match = self.PATTERNS['simple'].search(text)
            if match:
                weight = float(match.group(1))
                return {
                    'product_id': self.default_plu,
                    'weight': weight,
                    'unit_price': 0.0,
                    'total_price': 0.0
                }
            
            logging.debug(f"No pattern matched for: {repr(text)}")
            return None
            
        except Exception as e:
            logging.error(f"Parse error: {e}")
            return None


# ============================================================================
# SERIAL PORT HANDLER
# ============================================================================

class SerialScaleReader:
    """
    Handles serial communication with the ACLAS PS6X scale.
    
    Features:
    - Automatic reconnection on disconnect
    - Configurable serial parameters
    - Non-blocking async reading
    - Error handling for common serial issues
    """
    
    def __init__(self, config: dict):
        self.config = config['serial']
        self.parser = AclasPS6XParser(config['plu_prices'])
        self.serial_port: Optional[serial.Serial] = None
        self.running = False
        
    def get_parity(self) -> str:
        """Convert parity string to pyserial constant."""
        parity_map = {
            'N': serial.PARITY_NONE,
            'E': serial.PARITY_EVEN,
            'O': serial.PARITY_ODD,
            'M': serial.PARITY_MARK,
            'S': serial.PARITY_SPACE
        }
        return parity_map.get(self.config['parity'], serial.PARITY_NONE)
    
    def connect(self) -> bool:
        """Establish connection to the serial port."""
        try:
            self.serial_port = serial.Serial(
                port=self.config['port'],
                baudrate=self.config['baud_rate'],
                bytesize=self.config['data_bits'],
                parity=self.get_parity(),
                stopbits=self.config['stop_bits'],
                timeout=self.config['timeout']
            )
            logging.info(f"Connected to scale on {self.config['port']}")
            return True
        except serial.SerialException as e:
            logging.error(f"Failed to connect to {self.config['port']}: {e}")
            return False
    
    def disconnect(self) -> None:
        """Close the serial connection."""
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
            logging.info("Serial port closed")
    
    def read_line(self) -> Optional[bytes]:
        """Read a line of data from the scale."""
        if not self.serial_port or not self.serial_port.is_open:
            return None
        try:
            # Read until newline or timeout
            data = self.serial_port.readline()
            if data:
                return data
        except serial.SerialException as e:
            logging.error(f"Serial read error: {e}")
            self.disconnect()
        return None
    
    async def read_async(self) -> Optional[dict]:
        """Async wrapper for reading scale data."""
        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(None, self.read_line)
        if data:
            return self.parser.parse(data)
        return None
    
    @staticmethod
    def list_ports() -> list[str]:
        """List available serial ports."""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]


# ============================================================================
# WEBSOCKET SERVER
# ============================================================================

class ScaleWebSocketServer:
    """
    WebSocket server that broadcasts scale readings to connected clients.
    
    Features:
    - Multiple simultaneous client connections
    - Automatic client cleanup on disconnect
    - JSON message broadcasting
    - Connection state management
    """
    
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.clients: Set[WebSocketServerProtocol] = set()
        self.server = None
        
    async def handler(self, websocket: WebSocketServerProtocol) -> None:
        """Handle a new WebSocket client connection."""
        self.clients.add(websocket)
        client_id = id(websocket)
        logging.info(f"Client connected: {client_id} (total: {len(self.clients)})")
        
        try:
            # Send welcome message
            await websocket.send(json.dumps({
                "type": "connected",
                "message": "Connected to ACLAS PS6X Scale Middleware",
                "timestamp": datetime.now().isoformat()
            }))
            
            # Keep connection alive, handle incoming messages
            async for message in websocket:
                # Handle client messages (e.g., configuration updates)
                try:
                    data = json.loads(message)
                    if data.get('type') == 'ping':
                        await websocket.send(json.dumps({"type": "pong"}))
                except json.JSONDecodeError:
                    pass
                    
        except websockets.exceptions.ConnectionClosed:
            logging.info(f"Client disconnected: {client_id}")
        finally:
            self.clients.discard(websocket)
            logging.info(f"Client removed: {client_id} (remaining: {len(self.clients)})")
    
    async def broadcast(self, reading: ScaleReading) -> None:
        """Broadcast a scale reading to all connected clients."""
        if not self.clients:
            return
            
        message = reading.to_json()
        
        # Send to all clients, removing any that fail
        disconnected = set()
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
        
        self.clients -= disconnected
        
        if disconnected:
            logging.debug(f"Removed {len(disconnected)} disconnected clients")
    
    async def start(self) -> None:
        """Start the WebSocket server."""
        self.server = await websockets.serve(
            self.handler,
            self.host,
            self.port
        )
        logging.info(f"WebSocket server started on ws://{self.host}:{self.port}")
    
    async def stop(self) -> None:
        """Stop the WebSocket server."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logging.info("WebSocket server stopped")


# ============================================================================
# TRANSACTION LOGGER
# ============================================================================

class TransactionLogger:
    """
    Logs all scale transactions to a local file for audit and recovery.
    
    Log format: JSON lines (one JSON object per line)
    """
    
    def __init__(self, log_file: Path):
        self.log_file = log_file
        
    def log(self, reading: ScaleReading) -> None:
        """Append a transaction to the log file."""
        try:
            with open(self.log_file, 'a') as f:
                f.write(reading.to_json() + '\n')
        except Exception as e:
            logging.error(f"Failed to log transaction: {e}")
    
    def get_recent(self, count: int = 100) -> list[dict]:
        """Retrieve recent transactions from the log."""
        if not self.log_file.exists():
            return []
        
        transactions = []
        try:
            with open(self.log_file, 'r') as f:
                for line in f:
                    if line.strip():
                        transactions.append(json.loads(line))
            return transactions[-count:]
        except Exception as e:
            logging.error(f"Failed to read transaction log: {e}")
            return []


# ============================================================================
# MAIN MIDDLEWARE SERVICE
# ============================================================================

class ScaleMiddleware:
    """
    Main middleware service orchestrating all components.
    
    Flow:
    1. Start WebSocket server
    2. Connect to scale serial port
    3. Read scale data continuously
    4. Filter for stable readings
    5. Calculate total price
    6. Broadcast to WebSocket clients
    7. Log transaction
    """
    
    def __init__(self):
        self.config = load_config()
        self.scale_reader = SerialScaleReader(self.config)
        self.ws_server = ScaleWebSocketServer(
            self.config['websocket']['host'],
            self.config['websocket']['port']
        )
        self.logger = TransactionLogger(LOG_FILE)
        self.stability = StabilityBuffer(readings=[])
        self.running = False
        
    async def process_reading(self, data: dict) -> None:
        """Process a scale reading and broadcast if stable."""
        weight = data['weight']
        
        # Skip zero or negative weights
        if weight <= 0:
            return
        
        # Add to stability buffer
        self.stability.add_reading(weight)
        
        # Check stability
        scale_config = self.config['scale']
        if not self.stability.is_stable(
            scale_config['stability_threshold'],
            scale_config['stability_readings']
        ):
            return
        
        stable_weight = self.stability.get_stable_weight()
        
        # Check for duplicate
        if self.stability.is_duplicate(
            stable_weight,
            scale_config['duplicate_timeout']
        ):
            return
        
        # Look up unit price if not provided by scale
        product_id = data['product_id']
        unit_price = data['unit_price']
        
        if unit_price == 0:
            unit_price = self.config['plu_prices'].get(product_id, 0.0)
        
        # Calculate total price
        total_price = round(stable_weight * unit_price, 2)
        
        # Create reading object
        reading = ScaleReading(
            product_id=product_id,
            weight=round(stable_weight, 3),
            unit_price=unit_price,
            total_price=total_price,
            timestamp=datetime.now().isoformat()
        )
        
        # Mark as sent
        self.stability.mark_sent(stable_weight)
        
        # Log transaction
        self.logger.log(reading)
        
        # Broadcast to clients
        await self.ws_server.broadcast(reading)
        
        logging.info(
            f"Broadcast: PLU={product_id}, "
            f"Weight={stable_weight}kg, "
            f"Price={total_price} KSh"
        )
    
    async def scale_reader_loop(self) -> None:
        """Main loop for reading scale data."""
        reconnect_delay = 1.0
        max_delay = 30.0
        
        while self.running:
            # Connect to scale
            if not self.scale_reader.serial_port or not self.scale_reader.serial_port.is_open:
                if self.scale_reader.connect():
                    reconnect_delay = 1.0
                else:
                    logging.warning(f"Retrying in {reconnect_delay}s...")
                    await asyncio.sleep(reconnect_delay)
                    reconnect_delay = min(reconnect_delay * 2, max_delay)
                    continue
            
            # Read data
            data = await self.scale_reader.read_async()
            
            if data:
                await self.process_reading(data)
            else:
                # Small delay to prevent busy loop
                await asyncio.sleep(0.1)
    
    async def run(self) -> None:
        """Start the middleware service."""
        self.running = True
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s [%(levelname)s] %(message)s',
            handlers=[
                logging.StreamHandler(),
                logging.FileHandler(LOG_FILE.parent / 'middleware.log')
            ]
        )
        
        logging.info("=" * 60)
        logging.info("ACLAS PS6X Scale Middleware Starting")
        logging.info("=" * 60)
        logging.info(f"Serial port: {self.config['serial']['port']}")
        logging.info(f"WebSocket: ws://{self.config['websocket']['host']}:{self.config['websocket']['port']}")
        logging.info(f"PLU mappings: {len(self.config['plu_prices'])} products")
        
        # List available ports
        ports = SerialScaleReader.list_ports()
        logging.info(f"Available serial ports: {ports}")
        
        # Start WebSocket server
        await self.ws_server.start()
        
        # Run scale reader
        try:
            await self.scale_reader_loop()
        except asyncio.CancelledError:
            logging.info("Middleware shutdown requested")
        finally:
            self.running = False
            self.scale_reader.disconnect()
            await self.ws_server.stop()
            logging.info("Middleware stopped")
    
    def stop(self) -> None:
        """Signal the middleware to stop."""
        self.running = False


# ============================================================================
# ENTRY POINT
# ============================================================================

def main():
    """Main entry point."""
    middleware = ScaleMiddleware()
    
    # Handle shutdown signals
    def signal_handler(sig, frame):
        print("\nShutdown signal received...")
        middleware.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the middleware
    try:
        asyncio.run(middleware.run())
    except KeyboardInterrupt:
        pass
    
    print("Middleware exited")


if __name__ == "__main__":
    main()
