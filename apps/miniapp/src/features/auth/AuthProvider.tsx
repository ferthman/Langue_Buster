import type { AppUser, SessionPayload } from '@langue-buster/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiClient, ApiClientError } from '../api/client';
import { createClientErrorReporter, trackAnalyticsEvent } from '../analytics/client';
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
  const errorReporter = useMemo(() => createClientErrorReporter(), []);
  const bootstrap = useCallback(async () => {
    setState({ status: 'bootstrapping', retry: () => { void bootstrap(); } });
    const storedToken = getStoredSessionToken();

    if (storedToken) {
      try {
        const response = await apiClient.verifySession(storedToken);
        await trackAnalyticsEvent(storedToken, {
          eventName: 'app_bootstrap_succeeded',
          occurredAt: new Date().toISOString(),
          userId: response.user.id,
          sessionId: response.session.id,
          payload: {
            method: 'stored_session',
            route: '/',
            isTelegram: telegram.isTelegram,
          },
        });
        setState({
          status: 'authenticated',
          retry: () => { void bootstrap(); },
          user: response.user,
          session: response.session,
          token: storedToken,
        });
        return;
      } catch (error) {
        errorReporter.captureError(error, {
          domain: 'auth-bootstrap',
          method: 'stored_session',
        });
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
      await trackAnalyticsEvent(response.session.token, {
        eventName: 'app_bootstrap_succeeded',
        occurredAt: new Date().toISOString(),
        userId: response.user.id,
        sessionId: response.session.id,
        payload: {
          method: 'telegram_auth',
          route: '/',
          isTelegram: telegram.isTelegram,
        },
      });
      setState({
        status: 'authenticated',
        retry: () => { void bootstrap(); },
        user: response.user,
        session: response.session,
        token: response.session.token,
      });
    } catch (error) {
      errorReporter.captureError(error, {
        domain: 'auth-bootstrap',
        method: 'telegram_auth',
      });
      setState({
        status: 'error',
        retry: () => { void bootstrap(); },
        message:
          error instanceof Error ? error.message : 'Не удалось авторизоваться через Telegram.',
      });
    }
  }, [errorReporter, telegram.initData, telegram.isTelegram]);
  const [state, setState] = useState<AuthState>({
    status: 'bootstrapping',
    retry: () => { void bootstrap(); },
  });

  useEffect(() => {
    void (async () => {
      const storedToken = getStoredSessionToken();
      await trackAnalyticsEvent(storedToken, {
        eventName: 'app_bootstrap_started',
        occurredAt: new Date().toISOString(),
        payload: {
          method: storedToken ? 'stored_session' : telegram.initData ? 'telegram_auth' : 'none',
          route: '/',
          isTelegram: telegram.isTelegram,
        },
      });
    })();
    void bootstrap();
  }, [bootstrap, telegram.initData, telegram.isTelegram]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
