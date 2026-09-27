interface MintButtonProps {
  enabled: boolean;
  justified: number;
  onMint: () => void;
  pending: boolean;
}

export function MintButton({
  enabled,
  justified,
  onMint,
  pending,
}: MintButtonProps) {
  return (
    <button
      id="mint-button"
      onClick={onMint}
      disabled={!enabled || pending}
      className="rounded-lg px-6 py-3 font-semibold text-sm transition-colors bg-green-700 hover:bg-green-600 text-white disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed"
    >
      {pending
        ? 'Minting...'
        : `Mint (justified: ${justified.toFixed(2)})`}
    </button>
  );
}
