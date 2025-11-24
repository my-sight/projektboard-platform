// src/utils/dateUtils.ts

export function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isoWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.valueOf() - firstThursday.valueOf();
  return 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
}

export const getKwString = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return `KW ${isoWeekNumber(date)}`;
};

export const formatWeekKey = (date: Date): string => {
  const temp = new Date(date);
  const target = startOfWeek(temp);
  const year = target.getFullYear();
  const week = isoWeekNumber(target);
  return `${year}-${String(week).padStart(2, '0')}`;
};

export const parseWeekKey = (value: string): Date => {
  const [yearPart, weekPart] = value.split('-');
  const year = Number(yearPart);
  const week = Number(weekPart);
  if (!Number.isFinite(year) || !Number.isFinite(week)) {
    return startOfWeek(new Date());
  }
  const simple = new Date(Date.UTC(year, 0, 1));
  const day = simple.getUTCDay();
  const diff = (day <= 4 ? day - 1 : day - 8);
  simple.setUTCDate(simple.getUTCDate() - diff + (week - 1) * 7);
  return startOfWeek(simple);
};

export const weekRangeLabel = (date: Date): string => {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const formatter = new Intl.DateTimeFormat('de-DE');
  return `${formatter.format(start)} – ${formatter.format(end)}`;
};

export const shiftWeek = (weekKey: string, delta: number): string => {
  const base = parseWeekKey(weekKey);
  base.setDate(base.getDate() + delta * 7);
  return formatWeekKey(base);
};