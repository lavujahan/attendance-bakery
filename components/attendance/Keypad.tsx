"use client";

interface Props {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onReset: () => void;
}

const KEYS = [
  ["1", "2", "3", "Bksp"],
  ["4", "5", "6", "Reset"],
  ["7", "8", "9", "0"],
] as const;

export default function Keypad({ onDigit, onBackspace, onReset }: Props) {
  const handlePress = (key: string) => {
    if (key === "Bksp") return onBackspace();
    if (key === "Reset") return onReset();
    onDigit(key);
  };

  return (
    <div className="mx-auto grid w-full max-w-[380px] grid-cols-4 gap-px overflow-hidden rounded-2xl border border-emerald-900 bg-emerald-900 shadow-sm">
      {KEYS.flat().map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handlePress(key)}
          className="bg-emerald-700 py-7 text-2xl font-semibold text-white transition-colors active:bg-emerald-600"
        >
          {key}
        </button>
      ))}
    </div>
  );
}
