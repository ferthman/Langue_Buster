import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';

import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { PreferencesProvider, usePreferences } from '../features/preferences/PreferencesProvider';
import { ReviewScreen } from '../features/review/ReviewScreen';
import { HomeScreen } from '../features/shell/HomeScreen';
import { LevelMapScreen } from '../features/shell/LevelMapScreen';
import { OnboardingScreen } from '../features/shell/OnboardingScreen';
import { PlacementScreen } from '../features/shell/PlacementScreen';
import { ProfileScreen } from '../features/shell/ProfileScreen';
import { FullscreenState } from '../features/shell/StateScreens';
import { TelegramProvider } from '../features/telegram/TelegramProvider';
import { RunResultScreen } from '../features/run/RunResultScreen';
import { RunScreen } from '../features/run/RunScreen';

export function App() {
  return (
    <TelegramProvider>
      <PreferencesProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </PreferencesProvider>
    </TelegramProvider>
  );
}

function AppRoutes() {
  const auth = useAuth();

  if (auth.status === 'bootstrapping') {
    return (
      <FullscreenState
        tone="loading"
        title="Langue Buster"
        description="Подключаем Telegram и восстанавливаем сессию."
      />
    );
  }

  if (auth.status === 'unsupported') {
    return (
      <FullscreenState
        tone="empty"
        title="Нужен запуск из Telegram"
        description="Мини-приложение ожидает Telegram WebApp или уже сохранённую сессию."
        actionLabel="Повторить"
        onAction={auth.retry}
      />
    );
  }

  if (auth.status === 'error') {
    return (
      <FullscreenState
        tone="error"
        title="Не удалось открыть приложение"
        description={auth.message}
        actionLabel="Повторить"
        onAction={auth.retry}
      />
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<RootRedirect />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/placement" element={<PlacementScreen />} />
        <Route element={<RequireOnboarding />}>
          <Route element={<RequireFocusLevel />}>
            <Route path="/home" element={<HomeScreen />} />
            <Route path="/levels" element={<LevelMapScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
            <Route path="/review" element={<ReviewScreen />} />
            <Route path="/run/:runId" element={<RunScreen />} />
            <Route path="/run/:runId/result" element={<RunResultScreen />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function AppLayout() {
  const location = useLocation();
  const hideNavigation = location.pathname.startsWith('/run/');

  return (
    <div className="app-shell">
      <div className={hideNavigation ? 'app-content is-run' : 'app-content'}>
        <Outlet />
      </div>
      {hideNavigation ? null : <BottomNavigation />}
    </div>
  );
}

function BottomNavigation() {
  const location = useLocation();
  const items = [
    { href: '/home', label: 'Домой' },
    { href: '/levels', label: 'Уровни' },
    { href: '/review', label: 'Повтор' },
    { href: '/profile', label: 'Профиль' },
  ] as const;

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {items.map((item) => {
        const isActive = location.pathname === item.href;
        return (
          <NavLink
            key={item.href}
            to={item.href}
            className={isActive ? 'bottom-nav__item is-active' : 'bottom-nav__item'}
          >
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

function RootRedirect() {
  const { onboardingSeen, focusLevel } = usePreferences();

  if (!onboardingSeen) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!focusLevel) {
    return <Navigate to="/placement" replace />;
  }

  return <Navigate to="/home" replace />;
}

function RequireOnboarding() {
  const { onboardingSeen } = usePreferences();
  return onboardingSeen ? <Outlet /> : <Navigate to="/onboarding" replace />;
}

function RequireFocusLevel() {
  const { focusLevel } = usePreferences();
  return focusLevel ? <Outlet /> : <Navigate to="/placement" replace />;
}
