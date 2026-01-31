// User Manual content and download functionality

export const USER_MANUAL_CONTENT = `
SMARTSTOCK USER MANUAL
======================
Version 1.0.0 | Offline-First Inventory Management System

TABLE OF CONTENTS
-----------------
1. Getting Started
2. Dashboard
3. Products Management
4. Products Out (Stock Removal)
5. Sales Recording
6. Avenues (Sales Channels)
7. Scale Integration (ACLAS PS6X)
8. Reports
9. Settings
10. Troubleshooting

================================================================================
1. GETTING STARTED
================================================================================

SmartStock is a Progressive Web App (PWA) designed for offline-first inventory 
management. All data is stored securely on your device using IndexedDB.

INSTALLATION:
• Mobile: Tap "Add to Home Screen" in your browser menu
• Desktop: Click the install icon in your address bar
• The app works completely offline once installed

CURRENCY:
All prices and calculations are in Kenyan Shillings (KSh)

================================================================================
2. DASHBOARD
================================================================================

The Dashboard provides an at-a-glance overview of your inventory status:

• Total Products: Number of unique items in inventory
• Low Stock Alerts: Products below minimum threshold
• Today's Sales: Revenue generated today
• Recent Activity: Latest transactions and stock movements

================================================================================
3. PRODUCTS MANAGEMENT
================================================================================

ACCESS: Click "Products" in the navigation menu

ADDING A NEW PRODUCT:
1. Click "Add Product" button
2. Fill in product details:
   - Name (required)
   - SKU/Barcode
   - Category
   - Unit Price (KSh)
   - Cost Price (KSh)
   - Current Stock
   - Minimum Stock Level
3. Click "Save"

EDITING A PRODUCT:
1. Find the product in the list
2. Click the edit icon
3. Modify details
4. Click "Save"

STOCK INTAKE:
1. Click "Stock In" on any product
2. Enter quantity received
3. Optionally add notes
4. Click "Confirm"

================================================================================
4. PRODUCTS OUT (STOCK REMOVAL)
================================================================================

ACCESS: Click "Products Out" in the navigation menu

Use this section to record stock removals that are NOT sales (e.g., damaged 
goods, samples, internal use).

RECORDING STOCK OUT:
1. Select the product
2. Enter quantity removed
3. Select reason (Damaged, Sample, Internal Use, Other)
4. Add notes if needed
5. Click "Record"

================================================================================
5. SALES RECORDING
================================================================================

ACCESS: Click "Sales" in the navigation menu

RECORDING A SALE:
1. Click "New Sale"
2. Add products to the cart:
   - Search or browse products
   - Enter quantity
   - Click "Add"
3. Review cart items
4. Select payment method (Cash, M-Pesa, Card)
5. Select sales avenue (optional)
6. Click "Complete Sale"

VIEWING SALES HISTORY:
• All sales are listed with date, items, and total
• Click any sale to view full details
• Filter by date range or payment method

================================================================================
6. AVENUES (SALES CHANNELS)
================================================================================

ACCESS: Click "Avenues" in the navigation menu

Avenues represent different sales channels (e.g., Shop, Market, Online).

CREATING AN AVENUE:
1. Click "Add Avenue"
2. Enter avenue name
3. Add description (optional)
4. Click "Save"

USING AVENUES:
• When recording sales, select the appropriate avenue
• Track performance by channel in Reports

================================================================================
7. SCALE INTEGRATION (ACLAS PS6X)
================================================================================

ACCESS: Click "Scale" in the navigation menu

SmartStock integrates with ACLAS PS6X weighing scales for automated weight-based 
pricing. This requires a middleware service running on your local computer.

ARCHITECTURE:
┌─────────────────┐     RS-232/USB     ┌─────────────────────┐     WebSocket     ┌─────────────────┐
│  ACLAS PS6X     │ ─────────────────► │  Python Middleware  │ ───────────────► │   SmartStock    │
│  Scale          │                    │  (scale_middleware) │                   │   (Browser)     │
└─────────────────┘                    └─────────────────────┘                   └─────────────────┘

MIDDLEWARE SETUP:
1. Install Python 3.10 or higher
2. Install dependencies: pip install pyserial websockets
3. Connect scale via RS-232 or USB-to-Serial adapter
4. Configure config.json with your serial port:
   - Windows: COM3, COM4, etc.
   - Linux: /dev/ttyUSB0, /dev/ttyACM0, etc.
5. Run: python scale_middleware.py

FINDING YOUR SERIAL PORT:
• Windows: Open Device Manager → Ports (COM & LPT)
• Linux: Run "ls /dev/ttyUSB*" or "ls /dev/ttyACM*"

CONNECTING TO SCALE:
1. Start the middleware service
2. In SmartStock, go to Scale Integration
3. Enter WebSocket URL (default: ws://localhost:8765)
4. Click "Connect"
5. Status indicator shows connection state

PLU CONFIGURATION:
PLU (Price Look-Up) codes link scale buttons to products in SmartStock.

Setting Up PLU Mappings:
1. In Scale Integration, scroll to "PLU Configuration"
2. Click "Add PLU Mapping"
3. Enter PLU Code (matches scale button, e.g., "0001")
4. Select the corresponding product from dropdown
5. Enter price per kg in KSh
6. Click "Save"

PLU changes sync automatically to the middleware's config.json file.

USING THE SCALE:
1. On the scale, press product number then PLU button
   Example: Press "1" then "PLU" for product 1 (PLU code 0001)
2. Place item on scale
3. Weight and calculated price appear in SmartStock
4. Add to sale cart

PLU DETECTION STATUS:
• Green (Matched): PLU recognized, product found
• Yellow (Waiting): Connected, waiting for scale input
• Red (Not Found): PLU code not configured - add mapping

TROUBLESHOOTING SCALE ISSUES:

Scale Not Detected:
• Check physical cable connection
• Verify correct COM port in middleware config
• Ensure baud rate is 9600 (default for ACLAS PS6X)
• Close any other programs using the port

WebSocket Connection Failed:
• Verify middleware is running
• Check firewall allows port 8765
• Try different port if 8765 is in use

Unstable Readings:
• Place scale on stable, level surface
• Calibrate the scale
• Increase stability threshold in config

PLU Mismatch Errors:
• Ensure PLU code matches exactly (including leading zeros)
• Check PLU mapping exists in SmartStock
• Verify sync status shows "Synced"

================================================================================
8. REPORTS
================================================================================

ACCESS: Click "Reports" in the navigation menu

Available Reports:
• Sales Summary: Revenue by period
• Product Performance: Top sellers, slow movers
• Stock Movement: Intake vs. sales over time
• Avenue Analysis: Performance by sales channel

GENERATING REPORTS:
1. Select report type
2. Choose date range
3. Apply filters if needed
4. Click "Generate"
5. Export to CSV or PDF if needed

================================================================================
9. SETTINGS
================================================================================

ACCESS: Click "Settings" in the navigation menu

DATA BACKUP:
1. Click "Backup" in Data Management section
2. Download file saves to your device
3. Store backup securely

RESTORE DATA:
1. Click "Restore" (if available)
2. Select backup file
3. Confirm restoration

CLEAR ALL DATA:
⚠️ WARNING: This action cannot be undone!
1. Click "Clear" in Data Management
2. Confirm in the dialog
3. All products, sales, and records will be deleted

================================================================================
10. TROUBLESHOOTING
================================================================================

APP NOT LOADING:
• Clear browser cache
• Try incognito/private mode
• Reinstall the PWA

DATA NOT SAVING:
• Check storage quota (Settings → About)
• Clear old data if storage is full
• Ensure browser allows IndexedDB

OFFLINE MODE ISSUES:
• Ensure app was loaded while online first
• Check service worker is active
• Try reinstalling PWA

SLOW PERFORMANCE:
• Clear old transaction history
• Reduce items per page in lists
• Close other browser tabs

For additional support, contact your system administrator.

================================================================================
END OF USER MANUAL
================================================================================
© SmartStock Inventory Management System
`;

export const downloadUserManual = () => {
  const blob = new Blob([USER_MANUAL_CONTENT], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'SmartStock_User_Manual.txt';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
