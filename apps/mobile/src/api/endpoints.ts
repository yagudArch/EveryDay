/**
 * Типизированные вызовы backend. Единственный источник routes и схем ответов —
 * packages/contracts: мобильный клиент не дублирует пути и не изобретает поля.
 *
 * Разбор ответов идёт через Zod-схемы контракта, поэтому расхождение сервера с
 * контрактом превращается в ApiError('invalid_response'), а не в тихую подстановку
 * данных. Схемы вызываются обёртками (input) => Schema.parse(input): это сохраняет
 * `this` внутри метода Zod.
 */
import {
  ActionPreviewSchema,
  AIStatusSchema,
  AuthResponseSchema,
  HealthSchema,
  LoginSchema,
  PreferencesSchema,
  ProfileSchema,
  RegisterSchema,
  SubscriptionSchema,
  TodayContextSchema,
  UpdateDayContextSchema,
  UpdatePreferencesSchema,
  UpdateProfileSchema,
  routes,
} from '@everyday/contracts';
import type {
  ActionPreview,
  AIStatus,
  AuthResponse,
  LoginInput,
  Preferences,
  Profile,
  RegisterInput,
  Subscription,
  TodayContext,
  UpdatePreferencesInput,
} from '@everyday/contracts';

import type { HttpClient } from './client';

export type Health = { status: 'ok'; database: 'ok' };
export type UpdateDayNoteInput = { dayNote: string | null };
export type UpdateProfileInput = { displayName: string };

export interface EverydayApi {
  health(): Promise<Health>;
  register(input: RegisterInput): Promise<AuthResponse>;
  login(input: LoginInput): Promise<AuthResponse>;
  logout(): Promise<void>;
  me(): Promise<Profile>;
  updateProfile(input: UpdateProfileInput): Promise<Profile>;
  preferences(): Promise<Preferences>;
  updatePreferences(input: UpdatePreferencesInput): Promise<Preferences>;
  todayContext(): Promise<TodayContext>;
  updateDayNote(input: UpdateDayNoteInput): Promise<TodayContext>;
  subscription(): Promise<Subscription>;
  aiStatus(): Promise<AIStatus>;
  aiParse(text: string): Promise<ActionPreview>;
}

/** Клиентская проверка тел запросов: fail-fast до сети, сервер остаётся источником истины. */
export function assertRegisterInput(input: unknown): RegisterInput {
  return RegisterSchema.parse(input);
}

export function assertLoginInput(input: unknown): LoginInput {
  return LoginSchema.parse(input);
}

export function assertUpdateProfileInput(input: unknown): UpdateProfileInput {
  return UpdateProfileSchema.parse(input);
}

export function assertUpdatePreferencesInput(input: unknown): UpdatePreferencesInput {
  return UpdatePreferencesSchema.parse(input);
}

export function assertDayNoteInput(input: unknown): UpdateDayNoteInput {
  return UpdateDayContextSchema.parse(input);
}

export function createEverydayApi(client: HttpClient): EverydayApi {
  return {
    health: () => client.get(routes.health, (input) => HealthSchema.parse(input), { auth: false }),
    register: (input) => client.post(routes.register, input, (body) => AuthResponseSchema.parse(body), { auth: false }),
    login: (input) => client.post(routes.login, input, (body) => AuthResponseSchema.parse(body), { auth: false }),
    logout: () => client.sendVoid(routes.logout),
    me: () => client.get(routes.me, (input) => ProfileSchema.parse(input)),
    updateProfile: (input) => client.patch(routes.me, input, (body) => ProfileSchema.parse(body)),
    preferences: () => client.get(routes.preferences, (input) => PreferencesSchema.parse(input)),
    updatePreferences: (input) => client.patch(routes.preferences, input, (body) => PreferencesSchema.parse(body)),
    todayContext: () => client.get(routes.today, (input) => TodayContextSchema.parse(input)),
    updateDayNote: (input) => client.patch(routes.today, input, (body) => TodayContextSchema.parse(body)),
    subscription: () => client.get(routes.subscription, (input) => SubscriptionSchema.parse(input)),
    aiStatus: () => client.get(routes.aiStatus, (input) => AIStatusSchema.parse(input)),
    aiParse: (text) => client.post(routes.aiParse, { text }, (body) => ActionPreviewSchema.parse(body)),
  };
}
