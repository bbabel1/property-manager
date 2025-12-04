'use client';

type TransactionLoadingSkeletonProps = {
  rows?: number;
  columns?: number;
};

export default function TransactionLoadingSkeleton({
  rows = 4,
  columns = 6,
}: TransactionLoadingSkeletonProps) {
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  return (
    <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-4">
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="grid animate-pulse gap-3" style={gridStyle}>
          {[...Array(columns)].map((__, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="h-4 rounded bg-slate-200/80"
              aria-hidden
            />
          ))}
        </div>
      ))}
    </div>
  );
}
