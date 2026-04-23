import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '../src/components/AppShell';

import './globals.css';

export const metadata: Metadata = {
  title: 'Langue Buster Admin CMS',
  description: 'Editorial CMS v1',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
