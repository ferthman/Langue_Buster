'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { SessionVerificationResponse } from '@langue-buster/shared';

import { AdminApiError, adminApi, isSessionError } from './api';
import {
  clearStoredSessionToken,
  getStoredSessionToken,
  setStoredSessionToken,
} from './storage';

type AdminSessionState =
  | { status: 'loading' }
  | { status: 'needs_token'; message?: string }
  | { status: 'unauthorized'; message: string }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      token: string;
      session: SessionVerificationResponse;
    };

type AdminSessionContextValue = {
  state: AdminSessionState;
  submitToken(token: string): Promise<void>;
  retry(): Promise<void>;
  logout(): void;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminSessionState>({ status: 'loading' });

  async function bootstrap(providedToken?: string) {
    const token = (providedToken ?? getStoredSessionToken() ?? '').trim();
    if (!token) {
      setState({
        status: 'needs_token',
        message: 'Вставьте действующий Bearer-токен от существующей сессии Mini App.',
      });
      return;
    }

    setState({ status: 'loading' });

    try {
      const session = await adminApi.verifySession(token);
      await adminApi.getHistory(token, { limit: 1 });
      setStoredSessionToken(token);
      setState({
        status: 'ready',
        token,
        session,
      });
    } catch (error) {
      if (isSessionError(error)) {
        clearStoredSessionToken();
        setState({
          status: 'needs_token',
          message: 'Сессия больше не действует. Вставьте новый Bearer-токен.',
        });
        return;
      }

      if (error instanceof AdminApiError && error.code === 'admin_forbidden') {
        setState({
          status: 'unauthorized',
          message: 'Эта сессия не входит в allowlist CMS.',
        });
        return;
      }

      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Не удалось открыть CMS.',
      });
    }
  }

  useEffect(() => {
    void bootstrap();
  }, []);

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      state,
      async submitToken(token: string) {
        await bootstrap(token);
      },
      async retry() {
        await bootstrap();
      },
      logout() {
        clearStoredSessionToken();
        setState({
          status: 'needs_token',
          message: 'Сессия очищена. Вставьте новый Bearer-токен.',
        });
      },
    }),
    [state],
  );

  return (
    <AdminSessionContext.Provider value={value}>
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error('useAdminSession must be used inside AdminSessionProvider.');
  }

  return context;
}
