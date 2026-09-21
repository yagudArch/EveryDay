import { z } from 'zod';

export const API_PREFIX = '/api/v1';
export const routes = {
  health: `${API_PREFIX}/health`, register: `${API_PREFIX}/auth/register`,
  login: `${API_PREFIX}/auth/login`, logout: `${API_PREFIX}/auth/logout`,
  me: `${API_PREFIX}/me`, preferences: `${API_PREFIX}/preferences`,
  today: `${API_PREFIX}/context/today`, subscription: `${API_PREFIX}/subscription`,
  aiStatus: `${API_PREFIX}/ai/status`, aiParse: `${API_PREFIX}/ai/parse`,
  nutritionGoals: `${API_PREFIX}/nutrition/goals`,
  nutritionMeals: `${API_PREFIX}/nutrition/meals`,
  nutritionSummary: `${API_PREFIX}/nutrition/summary`,
  emailVerifyRequest: `${API_PREFIX}/auth/email/verify/request`,
  emailVerifyConfirm: `${API_PREFIX}/auth/email/verify/confirm`,
  passwordResetRequest: `${API_PREFIX}/auth/password/reset/request`,
  passwordResetConfirm: `${API_PREFIX}/auth/password/reset/confirm`,
  sessionsRevokeAll: `${API_PREFIX}/auth/sessions/revoke-all`,
  memory: `${API_PREFIX}/memory`,
  accountExport: `${API_PREFIX}/account/export`,
  account: `${API_PREFIX}/account`,
  openapi: `${API_PREFIX}/openapi.json`,
} as const;
export const nutritionMealById = (id: string) => `${API_PREFIX}/nutrition/meals/${id}` as const;
export const memoryFactById = (id: string) => `${API_PREFIX}/memory/${id}` as const;
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const TimezoneSchema = z.string().min(1).max(100).refine((value) => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Invalid IANA timezone');
const EmailSchema = z.string().trim().toLowerCase().email().max(254);
export const RegisterSchema = z.object({
  email: EmailSchema, password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(80), timezone: TimezoneSchema,
}).strict();
export const LoginSchema = z.object({ email: EmailSchema, password: z.string().min(1).max(128) }).strict();
export const ProfileSchema = z.object({
  id: z.string().uuid(), email: EmailSchema, displayName: z.string().min(1).max(80),
  createdAt: IsoDateTimeSchema,
}).strict();
export const UpdateProfileSchema = z.object({ displayName: z.string().trim().min(1).max(80) }).strict();
export const PreferencesSchema = z.object({
  timezone: TimezoneSchema, locale: z.enum(['ru', 'en']), theme: z.enum(['system', 'light', 'dark']),
  city: z.string().trim().min(1).max(120).nullable(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(100)).max(30),
  allergies: z.array(z.string().trim().min(1).max(100)).max(30),
  aiConsent: z.boolean(), memoryEnabled: z.boolean(),
}).strict();
export const UpdatePreferencesSchema = PreferencesSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0, 'At least one field required',
);
export const GoalSchema = z.object({
  id: z.string().uuid(), type: z.enum(['maintain', 'lose', 'gain', 'custom']),
  calories: z.number().nonnegative().nullable(), protein: z.number().nonnegative().nullable(),
  fat: z.number().nonnegative().nullable(), carbs: z.number().nonnegative().nullable(),
}).strict();
export const MemoryFactSchema = z.object({
  id: z.string().uuid(), fact: z.string().max(1000), source: z.literal('user_confirmed'),
  createdAt: IsoDateTimeSchema,
}).strict();
export const SubscriptionSchema = z.object({
  status: z.enum(['trial', 'active', 'expired_trial', 'expired_subscription', 'cancelled', 'grace']),
  trialStartedAt: IsoDateTimeSchema, trialEndsAt: IsoDateTimeSchema,
  currentPeriodEndsAt: IsoDateTimeSchema.nullable(), premium: z.boolean(),
}).strict();
export const UnavailableModuleSchema = z.object({
  status: z.literal('unavailable'), reason: z.literal('not_implemented'), data: z.null(),
}).strict();
export const TodayContextSchema = z.object({
  schemaVersion: z.literal(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: TimezoneSchema, generatedAt: IsoDateTimeSchema,
  profile: ProfileSchema, preferences: PreferencesSchema,
  goals: z.array(GoalSchema), memory: z.array(MemoryFactSchema),
  subscription: SubscriptionSchema, dayNote: z.string().max(2000).nullable(),
  modules: z.object({
    nutrition: UnavailableModuleSchema, weather: UnavailableModuleSchema,
    wardrobe: UnavailableModuleSchema, activity: UnavailableModuleSchema,
    inventory: UnavailableModuleSchema, shopping: UnavailableModuleSchema,
    events: UnavailableModuleSchema, changes: UnavailableModuleSchema,
  }).strict(),
}).strict();
export const UpdateDayContextSchema = z.object({ dayNote: z.string().trim().max(2000).nullable() }).strict();
export const AuthResponseSchema = z.object({
  token: z.string().min(32), expiresAt: IsoDateTimeSchema, user: ProfileSchema,
}).strict();
export const ErrorResponseSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string() }).strict(),
}).strict();
export const AICapabilitySchema = z.enum(['text', 'vision', 'speech_to_text', 'structured_output', 'embeddings', 'tools']);
export const AIStatusSchema = z.object({
  provider: z.string(), configured: z.boolean(), capabilities: z.array(AICapabilitySchema),
}).strict();
const actionBase = {
  id: z.string().uuid(), occurredAt: IsoDateTimeSchema.nullable(),
  confidence: z.number().min(0).max(1), confirmationRequired: z.literal(true),
};
export const StructuredActionSchema = z.discriminatedUnion('type', [
  z.object({ ...actionBase, type: z.literal('add_meal'), module: z.literal('nutrition'),
    parameters: z.object({ description: z.string().trim().min(1).max(2000),
      mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).nullable() }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal('add_activity'), module: z.literal('activity'),
    parameters: z.object({ description: z.string().trim().min(1).max(2000) }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal('create_event'), module: z.literal('events'),
    parameters: z.object({ title: z.string().trim().min(1).max(200) }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal('add_shopping_item'), module: z.literal('shopping'),
    parameters: z.object({ name: z.string().trim().min(1).max(200) }).strict() }).strict(),
  z.object({ ...actionBase, type: z.literal('update_day_note'), module: z.literal('context'),
    parameters: z.object({ dayNote: z.string().trim().min(1).max(2000) }).strict() }).strict(),
]);
export const ParseInputSchema = z.object({ text: z.string().trim().min(1).max(4000) }).strict();
export const ActionPreviewSchema = z.object({
  actions: z.array(StructuredActionSchema).max(20),
  clarification: z.string().trim().min(1).max(2000).nullable(),
}).strict();
export const HealthSchema = z.object({ status: z.literal('ok'), database: z.literal('ok') }).strict();

// --- Nutrition (Stage 2, NUT-001). LEAD-owned contract; BACKEND implements routes/persistence.
// Macros are non-negative, finite, and stored/returned rounded to 1 decimal place.
const MacroGrams = z.number().finite().nonnegative().max(10000);
const Calories = z.number().finite().nonnegative().max(50000);
export const MealTypeSchema = z.enum(['breakfast', 'lunch', 'dinner', 'snack']);
export const NutritionGoalSchema = z.object({
  type: z.enum(['maintain', 'lose', 'gain', 'custom']),
  calories: Calories.nullable(), protein: MacroGrams.nullable(),
  fat: MacroGrams.nullable(), carbs: MacroGrams.nullable(),
  updatedAt: IsoDateTimeSchema,
}).strict();
export const UpdateNutritionGoalSchema = z.object({
  type: z.enum(['maintain', 'lose', 'gain', 'custom']),
  calories: Calories.nullable(), protein: MacroGrams.nullable(),
  fat: MacroGrams.nullable(), carbs: MacroGrams.nullable(),
}).strict();
export const MealSchema = z.object({
  id: z.string().uuid(), mealType: MealTypeSchema,
  description: z.string().trim().min(1).max(2000),
  calories: Calories, protein: MacroGrams, fat: MacroGrams, carbs: MacroGrams,
  // Server-computed local day (profile timezone) the meal counts toward.
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consumedAt: IsoDateTimeSchema, createdAt: IsoDateTimeSchema,
}).strict();
export const CreateMealSchema = z.object({
  mealType: MealTypeSchema, description: z.string().trim().min(1).max(2000),
  calories: Calories, protein: MacroGrams, fat: MacroGrams, carbs: MacroGrams,
  // Optional client instant; server resolves the local day and defaults to now when null.
  consumedAt: IsoDateTimeSchema.nullable(),
}).strict();
export const UpdateMealSchema = CreateMealSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0, 'At least one field required',
);
export const MealListSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: TimezoneSchema,
  meals: z.array(MealSchema).max(200),
}).strict();
export const NutritionSummarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timezone: TimezoneSchema,
  goal: NutritionGoalSchema.nullable(),
  consumed: z.object({
    calories: Calories, protein: MacroGrams, fat: MacroGrams, carbs: MacroGrams,
  }).strict(),
  remaining: z.object({
    calories: z.number().finite(), protein: z.number().finite(),
    fat: z.number().finite(), carbs: z.number().finite(),
  }).strict().nullable(),
  mealCount: z.number().int().nonnegative(),
}).strict();

// --- Auth hardening (BCK-001). LEAD-owned contract; BACKEND implements routes/persistence.
// Opaque single-use tokens delivered out of band (email); never echoed by the API.
// Request endpoints always return an accepted-style result and never reveal whether an
// account or verification state exists (no user enumeration).
const AuthTokenSchema = z.string().min(32).max(512);
export const AcceptedSchema = z.object({ status: z.literal('accepted') }).strict();
export const EmailVerificationStatusSchema = z.object({
  emailVerified: z.boolean(), verificationSentAt: IsoDateTimeSchema.nullable(),
}).strict();
export const VerifyEmailSchema = z.object({ token: AuthTokenSchema }).strict();
export const RequestPasswordResetSchema = z.object({ email: EmailSchema }).strict();
export const ResetPasswordSchema = z.object({
  token: AuthTokenSchema, password: z.string().min(12).max(128),
}).strict();
export const RevokeAllSessionsSchema = z.object({ revokedCount: z.number().int().nonnegative() }).strict();

// --- Memory & account privacy (BCK-002). LEAD-owned contract; BACKEND implements routes/persistence.
// All endpoints authenticate with the session bearer and operate ONLY on the principal's own
// data (ownership derived from the session, never a client-supplied userId). Reuses the existing
// MemoryFactSchema (source: 'user_confirmed'); the AI never writes memory without user confirmation.
// CONSENT DECISION: memoryEnabled and aiConsent stay in PreferencesSchema and are toggled via the
// existing PATCH /preferences (UpdatePreferencesSchema.partial()). No new consent endpoints are
// introduced — a single preferences surface avoids a second source of truth for consent. "Disable
// memory" = PATCH /preferences { memoryEnabled: false }; it does NOT delete stored facts. Erasing
// facts is DELETE /memory (one) or DELETE /memory (all, see MemoryDeleteAllSchema).
export const CreateMemoryFactSchema = z.object({
  fact: z.string().trim().min(1).max(1000),
}).strict();
export const MemoryListSchema = z.object({
  facts: z.array(MemoryFactSchema).max(500),
}).strict();
// delete-all returns how many facts were removed; delete-one is a 204 no-body.
export const MemoryDeleteAllSchema = z.object({ deletedCount: z.number().int().nonnegative() }).strict();
// Full account data export (GDPR-style portability): profile, preferences, goals, memory, subscription
// plus a server-set generatedAt. Domain modules not yet implemented are omitted, not faked.
export const AccountExportSchema = z.object({
  generatedAt: IsoDateTimeSchema,
  profile: ProfileSchema, preferences: PreferencesSchema,
  goals: z.array(GoalSchema), memory: z.array(MemoryFactSchema),
  subscription: SubscriptionSchema,
}).strict();
// Irreversible account deletion. Requires the current password as an explicit confirmation; the
// server cascades removal of all owned rows and revokes every session.
export const DeleteAccountSchema = z.object({ password: z.string().min(1).max(128) }).strict();

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>;
export type TodayContext = z.infer<typeof TodayContextSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type AIStatus = z.infer<typeof AIStatusSchema>;
export type AICapability = z.infer<typeof AICapabilitySchema>;
export type StructuredAction = z.infer<typeof StructuredActionSchema>;
export type ActionPreview = z.infer<typeof ActionPreviewSchema>;
export type MealType = z.infer<typeof MealTypeSchema>;
export type NutritionGoal = z.infer<typeof NutritionGoalSchema>;
export type UpdateNutritionGoalInput = z.infer<typeof UpdateNutritionGoalSchema>;
export type Meal = z.infer<typeof MealSchema>;
export type CreateMealInput = z.infer<typeof CreateMealSchema>;
export type UpdateMealInput = z.infer<typeof UpdateMealSchema>;
export type MealList = z.infer<typeof MealListSchema>;
export type NutritionSummary = z.infer<typeof NutritionSummarySchema>;
export type Accepted = z.infer<typeof AcceptedSchema>;
export type EmailVerificationStatus = z.infer<typeof EmailVerificationStatusSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type RevokeAllSessions = z.infer<typeof RevokeAllSessionsSchema>;
export type MemoryFact = z.infer<typeof MemoryFactSchema>;
export type CreateMemoryFactInput = z.infer<typeof CreateMemoryFactSchema>;
export type MemoryList = z.infer<typeof MemoryListSchema>;
export type MemoryDeleteAll = z.infer<typeof MemoryDeleteAllSchema>;
export type AccountExport = z.infer<typeof AccountExportSchema>;
export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>;

// Shared endpoint catalog: used for OpenAPI generation and contract tests.
export const endpoints = [
  { method: 'get', path: routes.health, auth: false, response: HealthSchema, status: 200 },
  { method: 'post', path: routes.register, auth: false, body: RegisterSchema, response: AuthResponseSchema, status: 201 },
  { method: 'post', path: routes.login, auth: false, body: LoginSchema, response: AuthResponseSchema, status: 200 },
  { method: 'post', path: routes.logout, auth: true, status: 204 },
  { method: 'get', path: routes.me, auth: true, response: ProfileSchema, status: 200 },
  { method: 'patch', path: routes.me, auth: true, body: UpdateProfileSchema, response: ProfileSchema, status: 200 },
  { method: 'get', path: routes.preferences, auth: true, response: PreferencesSchema, status: 200 },
  { method: 'patch', path: routes.preferences, auth: true, body: UpdatePreferencesSchema, response: PreferencesSchema, status: 200 },
  { method: 'get', path: routes.today, auth: true, response: TodayContextSchema, status: 200 },
  { method: 'patch', path: routes.today, auth: true, body: UpdateDayContextSchema, response: TodayContextSchema, status: 200 },
  { method: 'get', path: routes.subscription, auth: true, response: SubscriptionSchema, status: 200 },
  { method: 'get', path: routes.aiStatus, auth: true, response: AIStatusSchema, status: 200 },
  { method: 'post', path: routes.aiParse, auth: true, body: ParseInputSchema, response: ActionPreviewSchema, status: 200 },
  { method: 'get', path: routes.nutritionGoals, auth: true, response: NutritionGoalSchema.nullable(), status: 200 },
  { method: 'put', path: routes.nutritionGoals, auth: true, body: UpdateNutritionGoalSchema, response: NutritionGoalSchema, status: 200 },
  { method: 'get', path: routes.nutritionMeals, auth: true, response: MealListSchema, status: 200 },
  { method: 'post', path: routes.nutritionMeals, auth: true, body: CreateMealSchema, response: MealSchema, status: 201 },
  { method: 'get', path: routes.nutritionSummary, auth: true, response: NutritionSummarySchema, status: 200 },
  { method: 'post', path: routes.emailVerifyRequest, auth: true, response: EmailVerificationStatusSchema, status: 202 },
  { method: 'post', path: routes.emailVerifyConfirm, auth: false, body: VerifyEmailSchema, response: EmailVerificationStatusSchema, status: 200 },
  { method: 'post', path: routes.passwordResetRequest, auth: false, body: RequestPasswordResetSchema, response: AcceptedSchema, status: 202 },
  { method: 'post', path: routes.passwordResetConfirm, auth: false, body: ResetPasswordSchema, status: 204 },
  { method: 'post', path: routes.sessionsRevokeAll, auth: true, response: RevokeAllSessionsSchema, status: 200 },
  { method: 'get', path: routes.memory, auth: true, response: MemoryListSchema, status: 200 },
  { method: 'post', path: routes.memory, auth: true, body: CreateMemoryFactSchema, response: MemoryFactSchema, status: 201 },
  { method: 'delete', path: routes.memory, auth: true, response: MemoryDeleteAllSchema, status: 200 },
  { method: 'delete', path: `${routes.memory}/{id}`, auth: true, status: 204 },
  { method: 'get', path: routes.accountExport, auth: true, response: AccountExportSchema, status: 200 },
  { method: 'delete', path: routes.account, auth: true, body: DeleteAccountSchema, status: 204 },
] as const;
