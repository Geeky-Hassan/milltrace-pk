export function matchesSearch(row: unknown, query: string) {
  if (!query.trim()) {
    return true;
  }

  return JSON.stringify(row).toLowerCase().includes(query.trim().toLowerCase());
}

export function matchesValue(value: string | undefined | null, selected: string) {
  return selected === "all" || (value ?? "").toLowerCase().replaceAll("_", " ") === selected.toLowerCase().replaceAll("_", " ");
}

export function uniqueOptions(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

export function parseSerialList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
