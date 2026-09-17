/**
 * Работа с IANA timezone: устройство как источник для регистрации/настроек,
 * явная проверка валидности (та же семантика, что TimezoneSchema в контракте).
 * Чистый TS без react-native.
 */

export const FALLBACK_TIMEZONE = 'UTC';

export function isValidTimezone(value: string): boolean {
  if (value.trim() === '') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimezone(): string {
  try {
    const resolved: unknown = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof resolved === 'string' && resolved !== '') return resolved;
    return FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/** Локальная дата дня в формате YYYY-MM-DD (без UTC-сдвига). */
export function localDateIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Форматирование серверного ISO-времени в timezone профиля; при любой проблеме — исходная строка. */
export function formatDateTime(isoTimestamp: string, timeZone: string, locale: string = 'ru'): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: isValidTimezone(timeZone) ? timeZone : undefined,
    }).format(parsed);
  } catch {
    return isoTimestamp;
  }
}

export function formatDateOnly(isoDate: string, locale: string = 'ru'): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(parsed);
  } catch {
    return isoDate;
  }
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return 'Доброй ночи';
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}
