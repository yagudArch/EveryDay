import { describe, expect, it } from 'vitest';

import { deviceTimezone, formatDateOnly, formatDateTime, greetingForHour, isValidTimezone, localDateIso } from './timezone';

describe('isValidTimezone', () => {
  it('принимает IANA зоны', () => {
    expect(isValidTimezone('Europe/Riga')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
  });

  it('отклоняет мусор и пустые значения', () => {
    expect(isValidTimezone('')).toBe(false);
    expect(isValidTimezone('   ')).toBe(false);
    expect(isValidTimezone('Not/AZone')).toBe(false);
    expect(isValidTimezone('Europe/Riga; drop table')).toBe(false);
  });
});

describe('deviceTimezone', () => {
  it('возвращает непустую зону', () => {
    expect(deviceTimezone().length).toBeGreaterThan(0);
  });
});

describe('localDateIso', () => {
  it('возвращает локальную дату без UTC-сдвига', () => {
    expect(localDateIso(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(localDateIso(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31');
  });
});

describe('форматирование', () => {
  it('formatDateTime использует timezone профиля', () => {
    const formatted = formatDateTime('2026-09-17T10:00:00.000Z', 'Europe/Riga');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).not.toBe('2026-09-17T10:00:00.000Z');
  });

  it('formatDateTime и formatDateOnly деградируют без исключений', () => {
    expect(formatDateTime('not-a-date', 'UTC')).toBe('not-a-date');
    expect(formatDateOnly('not-a-date')).toBe('not-a-date');
    expect(formatDateOnly('2026-09-17').length).toBeGreaterThan(0);
  });
});

describe('greetingForHour', () => {
  it('меняется по времени суток', () => {
    expect(greetingForHour(3)).toBe('Доброй ночи');
    expect(greetingForHour(9)).toBe('Доброе утро');
    expect(greetingForHour(15)).toBe('Добрый день');
    expect(greetingForHour(21)).toBe('Добрый вечер');
  });
});
