import { Route, Routes } from 'react-router-dom';

import { HomeScreen } from '../features/shell/HomeScreen';
import { RunScreen } from '../features/shell/RunScreen';
import { TelegramProvider } from '../features/telegram/TelegramProvider';

export function App() {
  return (
    <TelegramProvider>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/run" element={<RunScreen />} />
      </Routes>
    </TelegramProvider>
  );
}

