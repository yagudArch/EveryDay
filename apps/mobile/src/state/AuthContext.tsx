import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponse, LoginInput, Profile, RegisterInput } from '@everyday/contracts';

import { api, tokenStorage } from '../api';
import { assertUpdateProfileInput } from '../api/endpoints';
import { clearSession, getActiveSession, isSessionExpired, persistSession, setSession, setUnauthorizedHandler } from '../api/session';
import type { StoredSession } from '../storage/tokenStorage';
import { errorMessage } from '../utils/asyncState';

export type AuthStatus = 'restoring' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  status: AuthStatus;
  profile: Profile | null;
  /** Причина потери сессии (истёк токен) — показывается на экране входа. */
  sessionNotice: string | null;
  /** Ошибка проверки сессии (нет сети): интерфейс работает, данные покажут свою ошибку. */
  restoreError: string | null;
  busy: boolean;
  register(input: RegisterInput): Promise<void>;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
  /** PATCH /me: профиль обновляется из ответа сервера, локальных «оптимистичных» копий нет. */
  updateDisplayName(displayName: string): Promise<void>;
  clearSessionNotice(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('restoring');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applySession = useCallback(async (response: AuthResponse) => {
    await persistSession(
      { token: response.token, expiresAt: response.expiresAt },
      (session) => tokenStorage.writeSession(session),
    );
    setProfile(response.user);
    setRestoreError(null);
    setStatus('authenticated');
  }, []);

  /** Полный сброс пользовательского контекста: память + SecureStore/память процесса. */
  const dropSession = useCallback(async (notice: string | null) => {
    clearSession();
    try {
      await tokenStorage.clear();
    } catch {
      // Хранилище недоступно — сессия всё равно сброшена в памяти процесса.
    }
    setProfile(null);
    setSessionNotice(notice);
    setStatus('anonymous');
  }, []);

  // Истёкшая/отозванная сессия: backend вернул 401 -> клиент очищает контекст.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void dropSession('Сессия истекла. Войдите снова.');
    });
    return () => {
      setUnauthorizedHandler(null);
    };
  }, [dropSession]);

  // Восстановление сессии при запуске.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (api === null) {
        if (!cancelled) setStatus('anonymous');
        return;
      }

      let stored: StoredSession | null = null;
      try {
        stored = await tokenStorage.readSession();
      } catch {
        stored = null;
      }
      if (cancelled) return;

      if (stored === null) {
        setStatus('anonymous');
        return;
      }

      setSession(stored.token, stored.expiresAt);

      if (isSessionExpired()) {
        await dropSession('Сессия истекла. Войдите снова.');
        return;
      }

      try {
        const me = await api.me();
        if (cancelled) return;
        setProfile(me);
        setRestoreError(null);
        setStatus('authenticated');
      } catch (error) {
        if (cancelled) return;
        if (getActiveSession() === null) {
          // 401 уже обработан unauthorized-handler: пользователь разлогинен.
          setStatus('anonymous');
          return;
        }
        // Оффлайн/сервер недоступен: сессию не выбрасываем, но и данные не выдумываем.
        setRestoreError(errorMessage(error));
        setStatus('authenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dropSession]);

  const register = useCallback(
    async (input: RegisterInput) => {
      if (api === null) throw new Error('API-клиент недоступен: проверьте EXPO_PUBLIC_API_URL.');
      setBusy(true);
      try {
        const response = await api.register(input);
        await applySession(response);
      } finally {
        setBusy(false);
      }
    },
    [applySession],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      if (api === null) throw new Error('API-клиент недоступен: проверьте EXPO_PUBLIC_API_URL.');
      setBusy(true);
      try {
        const response = await api.login(input);
        await applySession(response);
      } finally {
        setBusy(false);
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    setBusy(true);
    try {
      if (api !== null && getActiveSession() !== null) {
        try {
          await api.logout();
        } catch {
          // Локальный выход обязателен даже если сервер недоступен.
        }
      }
    } finally {
      await dropSession(null);
      setBusy(false);
    }
  }, [dropSession]);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (api === null) throw new Error('API-клиент недоступен: проверьте EXPO_PUBLIC_API_URL.');
      const input = assertUpdateProfileInput({ displayName });
      const updated = await api.updateProfile(input);
      setProfile(updated);
    },
    [],
  );

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      profile,
      sessionNotice,
      restoreError,
      busy,
      register,
      login,
      logout,
      updateDisplayName,
      clearSessionNotice,
    }),
    [
      status,
      profile,
      sessionNotice,
      restoreError,
      busy,
      register,
      login,
      logout,
      updateDisplayName,
      clearSessionNotice,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth должен вызываться внутри AuthProvider.');
  }
  return value;
}
