export function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function attemptDateValue(value: string) {
  return value.slice(0, 10);
}

export function formatAttemptDate(value: string) {
  return new Date(`${attemptDateValue(value)}T00:00:00`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
