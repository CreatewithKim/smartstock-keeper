/**
 * Ensures a value is a proper Date object.
 * IndexedDB can sometimes return dates as strings or timestamps after
 * serialization, which breaks date comparisons and .getTime() calls.
 */
export function ensureDate(value: any): Date {
  if (value instanceof Date && !isNaN(value.getTime())) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(); // fallback to now if completely invalid
}

/**
 * Normalizes all date fields on a record to proper Date objects.
 * Pass the field names that should be dates.
 */
export function normalizeDates<T extends Record<string, any>>(
  record: T,
  dateFields: (keyof T)[]
): T {
  const result = { ...record };
  for (const field of dateFields) {
    if (field in result) {
      (result as any)[field] = ensureDate(result[field]);
    }
  }
  return result;
}

/**
 * Safely compare a date value against a range, handling string/Date inconsistencies.
 */
export function isDateInRange(date: any, start: Date, end: Date): boolean {
  const d = ensureDate(date);
  return d >= start && d < end;
}

/**
 * Get start and end of a given day.
 */
export function getDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
