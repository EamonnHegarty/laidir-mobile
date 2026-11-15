const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Today", "Yesterday", "3 days ago" for the last week, then a date ("10 Sep", with the year when
 * it isn't this year). Days are calendar days in the phone's time zone.
 */
export function relativeDay(iso: string, now: Date = new Date(), locale?: string): string {
  const then = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const sameYear = then.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(then);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
