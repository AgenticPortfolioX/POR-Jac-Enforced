// frontend/src/app/layout.tsx
// Purpose: Root layout wrapping all PoRJE pages
// Owner walker/module: frontend
// Spec: see PRD §12
// Status: IMPLEMENTED — Prompt 12

import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'PoRJE — Proof of Reserve, Jac Enforced',
  description:
    'Proof of Reserve attests. Jac enforces. The printer is the proof.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
