import WebApp from '@twa-dev/sdk';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

type TelegramSessionState = {
  isReady: boolean;
  initData: string;
};

const initialState: TelegramSessionState = {
  isReady: false,
  initData: '',
};

export function TelegramProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<TelegramSessionState>(initialState);

  useEffect(() => {
    WebApp.ready();
    WebApp.expand();

    setSession({
      isReady: true,
      initData: WebApp.initData,
    });
  }, []);

  return (
    <div data-telegram-ready={session.isReady} data-telegram-init={session.initData.length > 0}>
      {children}
    </div>
  );
}

