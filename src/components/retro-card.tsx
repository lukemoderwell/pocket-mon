interface RetroCardProps {
  children: React.ReactNode;
  className?: string;
}

export function RetroCard({ children, className = "" }: RetroCardProps) {
  return (
    <div className={`pixel-border bg-retro-dark p-4 ${className}`}>
      {children}
    </div>
  );
}
