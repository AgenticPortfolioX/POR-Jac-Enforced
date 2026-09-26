// frontend/src/app/layout.tsx
// Purpose: Root HTML and layout shell
// Owner walker/module: shared
// Spec: see PRD §11
// Status: SCAFFOLD — no logic implemented

import './globals.css';
import React from 'react';

export const metadata = {
  title: 'Proof of Reserve — Jac Enforced',
  description: 'Policy-enforced Proof of Reserve powered by Jac Cloud and Chainlink',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
