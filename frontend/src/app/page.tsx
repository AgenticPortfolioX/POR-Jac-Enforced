// frontend/src/app/page.tsx
// Purpose: Dashboard page rendering PoR panels and control interface
// Owner walker/module: shared
// Spec: see PRD §11
// Status: SCAFFOLD — no logic implemented

import React from 'react';
import GraphView from '@/components/GraphView';
import StampBadge from '@/components/StampBadge';
import MintButton from '@/components/MintButton';
import AuditorPanel from '@/components/AuditorPanel';
import CounselPanel from '@/components/CounselPanel';
import PathSelector from '@/components/PathSelector';
import ExplorerLink from '@/components/ExplorerLink';
import PolicyCard from '@/components/PolicyCard';

// # TODO: wire to jacClient per PRD §9

export default function Home() {
  return (
    <main className="min-h-screen p-8 flex flex-col gap-6">
      <PathSelector />
      <StampBadge />
      <PolicyCard />
      <GraphView />
      <AuditorPanel />
      <CounselPanel />
      <MintButton />
      <ExplorerLink />
    </main>
  );
}
