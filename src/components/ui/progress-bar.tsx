'use client';

interface ProgressBarProps {
  percentage: number;
  className?: string;
}

export default function ProgressBar({ percentage, className = '' }: ProgressBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className={`h-2 w-full rounded-full bg-slate-200 ${className}`}>
      <div
        className="h-2 rounded-full bg-blue-600 transition-all duration-300"
        style={{ width: `${clampedPercentage}%` }}
      />
    </div>
  );
}
