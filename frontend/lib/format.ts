export function formatKg(value: number) {
  return `${value.toLocaleString()} kg`;
}

export function formatTonsFromKg(value: number) {
  return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} tons`;
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

