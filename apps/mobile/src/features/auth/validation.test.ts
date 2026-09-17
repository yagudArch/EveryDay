import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
  passwordHint,
  validateDisplayName,
  validateEmail,
  validateLoginForm,
  validatePassword,
  validateRegisterForm,
  validateTimezoneValue,
} from './validation';

describe('email', () => {
  it('нормализует регистр и пробелы', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('проверяет базовый формат', () => {
    expect(validateEmail('user@example.com')).toBeNull();
    expect(validateEmail('')).not.toBeNull();
    expect(validateEmail('user@')).not.toBeNull();
    expect(validateEmail('user example.com')).not.toBeNull();
  });
});

describe('пароль (12 символов по контракту)', () => {
  it('требует минимум 12 символов', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
    expect(validatePassword('short')).not.toBeNull();
    expect(validatePassword('a'.repeat(11))).not.toBeNull();
    expect(validatePassword('a'.repeat(12))).toBeNull();
  });

  it('ограничивает максимальную длину', () => {
    expect(validatePassword('a'.repeat(129))).not.toBeNull();
  });

  it('подсказывает прогресс, но не блокирует', () => {
    expect(passwordHint('')).toContain('Минимум 12');
    expect(passwordHint('abc')).toContain('Ещё 9');
    expect(passwordHint('correct horse battery')).toContain('подходит');
  });
});

describe('displayName и timezone', () => {
  it('требует имя', () => {
    expect(validateDisplayName('   ')).not.toBeNull();
    expect(validateDisplayName('Александр')).toBeNull();
    expect(validateDisplayName('a'.repeat(81))).not.toBeNull();
  });

  it('требует IANA timezone', () => {
    expect(validateTimezoneValue('Europe/Riga')).toBeNull();
    expect(validateTimezoneValue('UTC')).toBeNull();
    expect(validateTimezoneValue('')).not.toBeNull();
    expect(validateTimezoneValue('Moscow')).not.toBeNull();
  });
});

describe('validateRegisterForm', () => {
  it('возвращает нормализованные значения при валидной форме', () => {
    const result = validateRegisterForm({
      email: '  User@Example.COM ',
      password: 'a'.repeat(12),
      displayName: '  Александр ',
      timezone: ' Europe/Riga ',
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      email: 'user@example.com',
      password: 'a'.repeat(12),
      displayName: 'Александр',
      timezone: 'Europe/Riga',
    });
  });

  it('собирает ошибки по полям', () => {
    const result = validateRegisterForm({ email: 'bad', password: '123', displayName: '', timezone: 'Nowhere' });

    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(['displayName', 'email', 'password', 'timezone']);
  });
});

describe('validateLoginForm', () => {
  it('проверяет email и непустой пароль', () => {
    expect(validateLoginForm({ email: 'user@example.com', password: 'x' }).ok).toBe(true);

    const invalid = validateLoginForm({ email: 'nope', password: '' });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.email).toBeDefined();
    expect(invalid.errors.password).toBeDefined();
  });
});
