import { getDB } from "./db";

const STORES = [
  "products",
  "stockIntakes",
  "sales",
  "excessSales",
  "productsOut",
  "expenses",
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

const DATE_FIELDS = ["date", "createdAt", "updatedAt"];

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

export async function downloadBackup(): Promise<{ filename: string; totals: Record<string, number> }> {
  const backup = await createBackup();
  const filename = `smartstock-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
  downloadFile(JSON.stringify(backup, null, 2), filename, "application/json");
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
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
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
