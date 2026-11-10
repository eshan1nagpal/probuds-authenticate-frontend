/** LocalDateTime from the API has no timezone. Display its wall-clock fields without conversion. */
export function expiryDisplay(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value)) return null;
  const calendar = new Date(`${value}Z`);
  if (Number.isNaN(calendar.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }).format(calendar);
}
