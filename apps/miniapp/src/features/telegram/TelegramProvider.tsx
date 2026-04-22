import WebApp from '@twa-dev/sdk';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeParams = Partial<Record<string, string>>;

type TelegramContextValue = {
  isTelegram: boolean;
  webApp: typeof WebApp | null;
  initData: string;
  themeParams: ThemeParams;
  colorScheme: 'light' | 'dark';
  impact(style?: 'light' | 'medium' | 'heavy'): void;
  notify(type: 'success' | 'error' | 'warning'): void;
};

const TelegramContext = createContext<TelegramContextValue | null>(null);

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const [contextState, setContextState] = useState<TelegramContextValue>(() => {
    const webApp = resolveWebApp();
    return buildTelegramContext(webApp);
  });

  useEffect(() => {
    const webApp = resolveWebApp();
    if (webApp) {
      webApp.ready();
      webApp.expand();
    }

    const nextContext = buildTelegramContext(webApp);
    setContextState(nextContext);
    applyTheme(nextContext.themeParams, nextContext.colorScheme);
  }, []);

  const value = useMemo(() => contextState, [contextState]);
  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export function useTelegram() {
  const value = useContext(TelegramContext);
  if (!value) {
    throw new Error('useTelegram must be used inside TelegramProvider.');
  }

  return value;
}

function resolveWebApp() {
  try {
    return WebApp;
  } catch {
    return null;
  }
}

function buildTelegramContext(webApp: typeof WebApp | null): TelegramContextValue {
  const isTelegram = Boolean(webApp?.initData);
  const themeParams = normalizeThemeParams(webApp?.themeParams as ThemeParams | undefined);
  const colorScheme = webApp?.colorScheme === 'dark' ? 'dark' : resolveSystemColorScheme();

  return {
    isTelegram,
    webApp,
    initData: webApp?.initData ?? '',
    themeParams,
    colorScheme,
    impact(style = 'light') {
      webApp?.HapticFeedback?.impactOccurred(style);
    },
    notify(type) {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
  };
}

function normalizeThemeParams(themeParams: ThemeParams | undefined): ThemeParams {
  if (!themeParams) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(themeParams).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function resolveSystemColorScheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(themeParams: ThemeParams, colorScheme: 'light' | 'dark') {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.theme = colorScheme;

  const mappedKeys = {
    bg_color: '--tg-bg-color',
    text_color: '--tg-text-color',
    hint_color: '--tg-hint-color',
    secondary_bg_color: '--tg-secondary-bg-color',
    button_color: '--tg-button-color',
    button_text_color: '--tg-button-text-color',
  } as const;

  for (const [sourceKey, cssVar] of Object.entries(mappedKeys)) {
    const value = themeParams[sourceKey];
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  }
}
