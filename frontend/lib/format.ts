export function formatKg(value: number) {
  return `${value.toLocaleString()} kg`;
}

export function formatTonsFromKg(value: number) {
  return `${(value / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} tons`;
}

export function kgFromTons(value: string | number) {
  return Number(value) * 1000;
}

export function bagsFromKg(value: number) {
  return Math.floor(value / 50);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
