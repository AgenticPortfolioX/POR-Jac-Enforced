import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

export const metadata = {
  title: 'PoRJE - Proof of Reserve, Jac Enforced',
  description:
    'Proof of Reserve attests. Jac enforces. The printer is the proof.',
};

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-cl-bg text-cl-primary min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
