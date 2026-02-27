// E3: 개별 센서 수치 카드
export type SensorStatus = 'normal' | 'warning' | 'critical';

interface SensorCardProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  status: SensorStatus;
}

const STATUS_STYLES: Record<SensorStatus, string> = {
  normal:   'text-kimchi-green bg-green-50 border-green-100',
  warning:  'text-yellow-600 bg-yellow-50 border-yellow-100',
  critical: 'text-kimchi-red bg-red-50 border-red-100',
};

const STATUS_LABEL: Record<SensorStatus, string> = {
  normal:   '정상',
  warning:  '경고',
  critical: '위험',
};

export default function SensorCard({ icon, label, value, unit, status }: SensorCardProps) {
  return (
    <div className={`rounded-lg border p-2.5 ${STATUS_STYLES[status]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium opacity-70">
          {icon} {label}
        </span>
        <span className="text-xs font-semibold">{STATUS_LABEL[status]}</span>
      </div>
      <div className="text-lg font-bold tabular-nums leading-tight">
        {value}
        <span className="text-xs font-normal ml-0.5 opacity-80">{unit}</span>
      </div>
    </div>
  );
}
