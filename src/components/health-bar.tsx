"use client";

interface HealthBarProps {
  current: number;
  max: number;
  label: string;
}

export function HealthBar({ current, max, label }: HealthBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color =
    pct > 50 ? "bg-retro-green" : pct > 20 ? "bg-retro-gold" : "bg-retro-accent";

  return (
    <div className="w-full">
      <div className="mb-1 flex justify-between font-retro text-[8px]">
        <span>{label}</span>
        <span>
          {current}/{max}
        </span>
      </div>
      <div className="h-3 w-full border-2 border-retro-white bg-retro-black">
        <div
          className={`h-full ${color} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
