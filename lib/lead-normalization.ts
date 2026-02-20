export function normalizeRuc(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.length > 0 ? cleaned : null;
}

export function normalizeLeadName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePhones(values: string[] | null | undefined): string[] {
  if (!values || values.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const normalized = normalizePhone(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function normalizeEmails(values: string[] | null | undefined): string[] {
  if (!values || values.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    const normalized = normalizeEmail(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function parseDelimitedList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,\n;]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}
