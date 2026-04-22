import type { AppUser, SessionPayload } from '@langue-buster/shared';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { apiClient, ApiClientError } from '../api/client';
import { clearStoredSessionToken, getStoredSessionToken, setStoredSessionToken } from './storage';
import { useTelegram } from '../telegram/TelegramProvider';

type AuthState =
  | { status: 'bootstrapping'; retry: () => void }
  | { status: 'unsupported'; retry: () => void }
  | { status: 'error'; message: string; retry: () => void }
  | {
      status: 'authenticated';
      retry: () => void;
      user: AppUser;
      session: SessionPayload;
      token: string;
    };

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const telegram = useTelegram();
  const bootstrap = useCallback(async () => {
    setState({ status: 'bootstrapping', retry: () => { void bootstrap(); } });
    const storedToken = getStoredSessionToken();

    if (storedToken) {
      try {
        const response = await apiClient.verifySession(storedToken);
        setState({
          status: 'authenticated',
          retry: () => { void bootstrap(); },
          user: response.user,
          session: response.session,
          token: storedToken,
        });
        return;
      } catch (error) {
        if (!(error instanceof ApiClientError) || error.status >= 500) {
          setState({
            status: 'error',
            retry: () => { void bootstrap(); },
            message: 'Сервер временно недоступен. Повторите попытку.',
          });
          return;
        }

        clearStoredSessionToken();
      }
    }

    if (!telegram.initData) {
      setState({ status: 'unsupported', retry: () => { void bootstrap(); } });
      return;
    }

    try {
      const response = await apiClient.authenticateTelegram(telegram.initData);
      setStoredSessionToken(response.session.token);
      setState({
        status: 'authenticated',
        retry: () => { void bootstrap(); },
        user: response.user,
        session: response.session,
        token: response.session.token,
      });
    } catch (error) {
      setState({
        status: 'error',
        retry: () => { void bootstrap(); },
        message:
          error instanceof Error ? error.message : 'Не удалось авторизоваться через Telegram.',
      });
    }
  }, [telegram.initData]);
  const [state, setState] = useState<AuthState>({
    status: 'bootstrapping',
    retry: () => { void bootstrap(); },
  });

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
