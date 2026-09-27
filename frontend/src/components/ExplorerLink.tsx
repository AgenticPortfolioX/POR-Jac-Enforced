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
      className="inline-flex items-center gap-2 rounded-full bg-cl-wash/10 px-4 py-2 text-sm font-medium text-cl-wash hover:bg-cl-wash/20 transition-colors"
    >
      View receipt on Etherscan ↗
    </a>
  );
}
