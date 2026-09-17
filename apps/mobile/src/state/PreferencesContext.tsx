import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Preferences, UpdatePreferencesInput } from '@everyday/contracts';

import { api } from '../api';
import { assertUpdatePreferencesInput } from '../api/endpoints';
import { errorMessage } from '../utils/asyncState';
import { deviceTimezone } from '../utils/timezone';
import { useAuth } from './AuthContext';

export type PreferencesStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PreferencesContextValue {
  status: PreferencesStatus;
  preferences: Preferences;
  /** true — значения получены с backend; false — локальные дефолты (гость/ошибка загрузки). */
  serverBacked: boolean;
  error: string | null;
  saving: boolean;
  reload(): void;
  save(patch: UpdatePreferencesInput): Promise<Preferences>;
}

/** Дефолты соответствуют контракту: aiConsent=false, memoryEnabled=false — без скрытого включения. */
export function defaultPreferences(): Preferences {
  return {
    timezone: deviceTimezone(),
    locale: 'ru',
    theme: 'system',
    city: null,
    dietaryRestrictions: [],
    allergies: [],
    aiConsent: false,
    memoryEnabled: false,
  };
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [status, setStatus] = useState<PreferencesStatus>('idle');
  const [preferences, setPreferences] = useState<Preferences>(() => defaultPreferences());
  const [serverBacked, setServerBacked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || api === null) {
      setPreferences(defaultPreferences());
      setServerBacked(false);
      setStatus('idle');
      setError(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setError(null);

    void (async () => {
      try {
        const loaded = await api.preferences();
        if (cancelled) return;
        setPreferences(loaded);
        setServerBacked(true);
        setStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setError(errorMessage(loadError));
        setServerBacked(false);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authStatus, reloadToken]);

  const save = useCallback(async (patch: UpdatePreferencesInput) => {
    if (api === null) throw new Error('API-клиент недоступен: проверьте EXPO_PUBLIC_API_URL.');
    const validated = assertUpdatePreferencesInput(patch);
    setSaving(true);
    try {
      const updated = await api.updatePreferences(validated);
      setPreferences(updated);
      setServerBacked(true);
      setStatus('ready');
      setError(null);
      return updated;
    } finally {
      setSaving(false);
    }
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ status, preferences, serverBacked, error, saving, reload, save }),
    [status, preferences, serverBacked, error, saving, reload, save],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (value === null) {
    throw new Error('usePreferences должен вызываться внутри PreferencesProvider.');
  }
  return value;
}
