import {
  productDB,
  stockIntakeDB,
  salesDB,
  excessSalesDB,
  productOutDB,
  expenseDB,
} from "./db";

const SCOPE = "https://www.googleapis.com/auth/drive.file";
const LAST_BACKUP_KEY = "lastGoogleDriveBackup";

// App-wide Google OAuth Client ID. Set once via VITE_GOOGLE_CLIENT_ID env var,
// or hardcode below. End users do NOT need to configure anything — they just
// authorize their own Google account at backup time and the file is uploaded
// to that account's personal Google Drive.
const HARDCODED_CLIENT_ID = ""; // e.g. "1234567890-abc.apps.googleusercontent.com"

declare global {
  interface Window {
    google?: any;
  }
}

export function getGoogleClientId(): string {
  return (
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
    HARDCODED_CLIENT_ID ||
    ""
  );
}

export function getLastDriveBackupAt(): Date | null {
  const v = localStorage.getItem(LAST_BACKUP_KEY);
  return v ? new Date(v) : null;
}

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Identity Services")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.gis = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google Identity Services"));
    document.head.appendChild(s);
  });
}

async function requestAccessToken(clientId: string): Promise<string> {
  await loadGisScript();
  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          resolve(resp.access_token);
        },
        error_callback: (err: any) => reject(new Error(err?.message || "Google sign-in cancelled")),
      });
      client.requestAccessToken({ prompt: "" });
    } catch (e: any) {
      reject(e);
    }
  });
}

async function gatherSnapshot() {
  const [products, stockIntakes, sales, excessSales, productsOut, expenses] = await Promise.all([
    productDB.getAll(),
    stockIntakeDB.getAll(),
    salesDB.getAll(),
    excessSalesDB.getAll(),
    productOutDB.getAll(),
    expenseDB.getAll(),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    data: { products, stockIntakes, sales, excessSales, productsOut, expenses },
  };
}

async function uploadJson(token: string, filename: string, json: string) {
  const boundary = "smartstock_" + Math.random().toString(36).slice(2);
  const metadata = { name: filename, mimeType: "application/json" };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${json}\r\n` +
    `--${boundary}--`;

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${t}`);
  }
  return res.json();
}

export async function backupToGoogleDrive(): Promise<{ filename: string; totals: Record<string, number> }> {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error("Google Client ID not configured. Add it in Settings.");
  const token = await requestAccessToken(clientId);
  const snapshot = await gatherSnapshot();
  const filename = `smartstock-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await uploadJson(token, filename, JSON.stringify(snapshot, null, 2));
  localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
  const totals = {
    products: snapshot.data.products.length,
    stock_intakes: snapshot.data.stockIntakes.length,
    sales: snapshot.data.sales.length,
    excess_sales: snapshot.data.excessSales.length,
    products_out: snapshot.data.productsOut.length,
    expenses: snapshot.data.expenses.length,
  };
  return { filename, totals };
}
