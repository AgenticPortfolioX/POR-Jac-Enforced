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
