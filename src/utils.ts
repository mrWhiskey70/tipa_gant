import * as XLSX from 'xlsx';

export const toDateOnlyString = (date: Date): string => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

export const excelToDate = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const dotFormat = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const dotMatch = trimmed.match(dotFormat);
    if (dotMatch) {
      const [, dd, mm, yyyy] = dotMatch;
      const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
      if (!Number.isNaN(date.getTime())) return date;
    }

    const isoDate = new Date(trimmed);
    if (!Number.isNaN(isoDate.getTime())) {
      return new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate());
    }
  }

  return null;
};
