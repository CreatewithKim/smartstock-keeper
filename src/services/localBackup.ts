import { getDB } from "./db";

const STORES = [
  "products",
  "stockIntakes",
  "sales",
  "excessSales",
  "productsOut",
  "expenses",
  "stockTakes",
] as const;

type StoreName = (typeof STORES)[number];

const AVENUES_STORAGE_KEY = "smartstock-avenues";

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: Record<string, any[]>;
  avenues?: any[];
}

const DATE_FIELDS = ["date", "createdAt", "updatedAt", "timestamp"];
const NUMERIC_FIELDS = [
  "id",
  "productId",
  "quantity",
  "quantityKg",
  "sellingPrice",
  "currentStock",
  "initialStock",
  "lowStockThreshold",
  "unitPrice",
  "totalAmount",
  "amount",
];
const BOOLEAN_FIELDS = ["isPaid"];

function reviveDates<T extends Record<string, any>>(row: T): T {
  const out: Record<string, any> = { ...row };
  for (const field of DATE_FIELDS) {
    if (typeof out[field] === "string") {
      const d = new Date(out[field]);
      if (!isNaN(d.getTime())) out[field] = d;
    }
  }
  return out as T;
}

export async function createBackup(): Promise<BackupFile> {
  const db = await getDB();
  const data: Record<string, any[]> = {};
  for (const store of STORES) {
    data[store] = await db.getAll(store);
  }
  const avenuesRaw = localStorage.getItem(AVENUES_STORAGE_KEY);
  return {
    app: "smartstock",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
    avenues: avenuesRaw ? JSON.parse(avenuesRaw) : [],
  };
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- CSV serialisation ---------------- */

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function serialiseValue(value: any): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseValue(field: string, raw: string): any {
  if (raw === "") return undefined;
  if (DATE_FIELDS.includes(field)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d;
  }
  if (NUMERIC_FIELDS.includes(field)) {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  if (BOOLEAN_FIELDS.includes(field)) return raw === "true";
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function backupToCsv(backup: BackupFile): string {
  const rows: Array<{ store: string; record: any }> = [];
  for (const store of STORES) {
    for (const record of backup.data[store] ?? []) rows.push({ store, record });
  }
  for (const record of backup.avenues ?? []) rows.push({ store: "avenues", record });

  const fields: string[] = [];
  for (const { record } of rows) {
    for (const key of Object.keys(record ?? {})) {
      if (!fields.includes(key)) fields.push(key);
    }
  }

  const header = ["__store", ...fields];
  const lines = [header.map(escapeCsv).join(",")];
  for (const { store, record } of rows) {
    lines.push(
      [store, ...fields.map((f) => serialiseValue(record?.[f]))].map(escapeCsv).join(","),
    );
  }
  return lines.join("\n");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += char;
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c !== ""));
}

export function csvToBackup(text: string): BackupFile {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("The CSV backup file is empty.");
  const header = rows[0];
  if (header[0] !== "__store") {
    throw new Error("This does not look like a SmartStock CSV backup file.");
  }
  const data: Record<string, any[]> = {};
  for (const store of STORES) data[store] = [];
  const avenues: any[] = [];

  for (const row of rows.slice(1)) {
    const store = row[0];
    const record: Record<string, any> = {};
    for (let i = 1; i < header.length; i++) {
      const value = parseValue(header[i], row[i] ?? "");
      if (value !== undefined) record[header[i]] = value;
    }
    if (store === "avenues") avenues.push(record);
    else if (data[store]) data[store].push(record);
  }

  return { app: "smartstock", version: 1, exportedAt: new Date().toISOString(), data, avenues };
}

export async function downloadBackup(): Promise<{ filename: string; totals: Record<string, number> }> {
  const backup = await createBackup();
  const filename = `smartstock-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  downloadFile(backupToCsv(backup), filename, "text/csv");
  const totals: Record<string, number> = {};
  for (const store of STORES) totals[store] = backup.data[store]?.length ?? 0;
  return { filename, totals };
}

export async function restoreBackup(
  file: File,
  mode: "replace" | "merge" = "replace",
): Promise<Record<string, number>> {
  const text = await file.text();
  let parsed: BackupFile;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) {
    // Backwards compatibility with older JSON backups
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("That file could not be read.");
    }
  } else {
    parsed = csvToBackup(text);
  }
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("This does not look like a SmartStock backup file.");
  }

  const db = await getDB();
  const totals: Record<string, number> = {};

  for (const store of STORES) {
    const rows = Array.isArray(parsed.data[store]) ? parsed.data[store] : [];
    const tx = db.transaction(store, "readwrite");
    if (mode === "replace") await tx.store.clear();
    for (const row of rows) {
      const record = reviveDates(row);
      if (mode === "merge") delete (record as any).id;
      await tx.store.put(record as any);
    }
    await tx.done;
    totals[store] = rows.length;
  }

  if (Array.isArray(parsed.avenues) && mode === "replace") {
    localStorage.setItem(AVENUES_STORAGE_KEY, JSON.stringify(parsed.avenues));
  }

  return totals;
}
