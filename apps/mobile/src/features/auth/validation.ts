/**
 * Клиентская валидация форм auth.
 *
 * Правила зеркалят RegisterSchema/LoginSchema из packages/contracts и дают fail-fast
 * подсказки в UI. Источник истины — сервер: даже прошедшая клиентская проверка
 * отправляется на backend и может быть отклонена контрактной ошибкой.
 */
import { isValidTimezone } from '../../utils/timezone';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const EMAIL_MAX_LENGTH = 254;

export type FieldErrors = Record<string, string>;

export interface FormValidation {
  ok: boolean;
  errors: FieldErrors;
  /** Нормализованные значения (trim/lowercase), пригодные для отправки. */
  value: { email: string; password: string; displayName: string; timezone: string };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): string | null {
  const email = normalizeEmail(value);
  if (email === '') return 'Укажите email.';
  if (email.length > EMAIL_MAX_LENGTH) return `Email длиннее ${EMAIL_MAX_LENGTH} символов.`;
  if (!EMAIL_PATTERN.test(email)) return 'Похоже, email указан с ошибкой.';
  return null;
}

export function validatePassword(value: string): string | null {
  if (value === '') return 'Укажите пароль.';
  if (value.length < PASSWORD_MIN_LENGTH) return `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов.`;
  if (value.length > PASSWORD_MAX_LENGTH) return `Пароль длиннее ${PASSWORD_MAX_LENGTH} символов.`;
  return null;
}

export function validateDisplayName(value: string): string | null {
  const name = value.trim();
  if (name === '') return 'Укажите имя, которое будет отображаться в приложении.';
  if (name.length > DISPLAY_NAME_MAX_LENGTH) return `Имя длиннее ${DISPLAY_NAME_MAX_LENGTH} символов.`;
  return null;
}

export function validateTimezoneValue(value: string): string | null {
  const timezone = value.trim();
  if (timezone === '') return 'Укажите часовой пояс.';
  if (!isValidTimezone(timezone)) return 'Неизвестный часовой пояс. Используйте формат IANA, например Europe/Riga.';
  return null;
}

export interface RegisterFormInput {
  email: string;
  password: string;
  displayName: string;
  timezone: string;
}

export function validateRegisterForm(input: RegisterFormInput): FormValidation {
  const errors: FieldErrors = {};
  const emailError = validateEmail(input.email);
  const passwordError = validatePassword(input.password);
  const displayNameError = validateDisplayName(input.displayName);
  const timezoneError = validateTimezoneValue(input.timezone);

  if (emailError !== null) errors.email = emailError;
  if (passwordError !== null) errors.password = passwordError;
  if (displayNameError !== null) errors.displayName = displayNameError;
  if (timezoneError !== null) errors.timezone = timezoneError;

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      email: normalizeEmail(input.email),
      password: input.password,
      displayName: input.displayName.trim(),
      timezone: input.timezone.trim(),
    },
  };
}

export interface LoginFormInput {
  email: string;
  password: string;
}

export function validateLoginForm(input: LoginFormInput): { ok: boolean; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const emailError = validateEmail(input.email);
  if (emailError !== null) errors.email = emailError;
  if (input.password === '') errors.password = 'Укажите пароль.';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** Сила пароля — информационная подсказка, а не требование. */
export function passwordHint(value: string): string {
  if (value.length === 0) return `Минимум ${PASSWORD_MIN_LENGTH} символов.`;
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Ещё ${PASSWORD_MIN_LENGTH - value.length} симв. до минимума.`;
  }
  const hasLetter = /[a-zA-Zа-яА-Я]/.test(value);
  const hasDigit = /\d/.test(value);
  const hasSymbol = /[^a-zA-Zа-яА-Я0-9]/.test(value);
  const classes = [hasLetter, hasDigit, hasSymbol].filter(Boolean).length;
  if (classes === 3 && value.length >= 16) return 'Длинный пароль с разными символами.';
  if (classes >= 2) return 'Пароль подходит.';
  return 'Добавьте цифры или символы, чтобы пароль был надёжнее.';
}
