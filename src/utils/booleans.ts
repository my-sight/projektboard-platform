export const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    return [
      'true',
      '1',
      'yes',
      'ja',
      'y',
      'x',
      'checked',
      'on'
    ].includes(normalized);
  }

  return false;
};

export const nullableDate = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};
