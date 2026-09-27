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
      className={`w-full rounded-[8px] px-6 py-3 font-semibold text-sm transition-all text-white flex justify-center items-center ${
        enabled && !pending 
          ? 'bg-cl-blue hover:brightness-110 shadow-lg shadow-cl-blue/20' 
          : 'bg-cl-blue opacity-40 cursor-not-allowed'
      }`}
    >
      {pending
        ? 'Minting...'
        : `Mint (justified: ${justified.toFixed(2)})`}
    </button>
  );
}
