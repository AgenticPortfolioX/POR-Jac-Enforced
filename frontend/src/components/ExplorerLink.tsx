// frontend/src/components/ExplorerLink.tsx
// Purpose: Etherscan link after successful mint — renders only when txHash present
// Owner walker/module: frontend
// Spec: see PRD §12
// Status: IMPLEMENTED — Prompt 12

interface ExplorerLinkProps {
  txHash: string | null;
}

export function ExplorerLink({ txHash }: ExplorerLinkProps) {
  if (!txHash) return null;
  return (
    <a
      id="explorer-link"
      href={`https://sepolia.etherscan.io/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="underline text-sm text-blue-400 hover:text-blue-300 transition-colors"
    >
      View tx on Etherscan →
    </a>
  );
}
