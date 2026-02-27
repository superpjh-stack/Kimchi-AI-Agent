// E5: 알림 배지 — Sidebar 헤더에 표시
interface AlertBadgeProps {
  criticalCount: number;
  warningCount: number;
}

export default function AlertBadge({ criticalCount, warningCount }: AlertBadgeProps) {
  if (criticalCount === 0 && warningCount === 0) return null;

  if (criticalCount > 0) {
    return (
      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-kimchi-red text-white text-[10px] font-bold leading-none animate-pulse">
        {criticalCount}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-400 text-white text-[10px] font-bold leading-none">
      {warningCount}
    </span>
  );
}
