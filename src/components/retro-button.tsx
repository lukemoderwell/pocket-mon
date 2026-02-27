"use client";

interface RetroButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
  type?: "button" | "submit";
}

export function RetroButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: RetroButtonProps) {
  const base =
    "font-retro text-xs px-6 py-3 uppercase tracking-wider transition-all active:translate-y-1 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0";
  const variants = {
    primary:
      "bg-retro-accent text-white shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] hover:brightness-110",
    secondary:
      "bg-retro-dark text-retro-white border-2 border-retro-white shadow-[4px_4px_0_0_rgba(0,0,0,0.5)] hover:bg-retro-mid",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
