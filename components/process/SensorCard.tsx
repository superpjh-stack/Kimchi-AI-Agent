// E3: individual sensor value card
export type SensorStatus = 'normal' | 'warning' | 'critical';

interface SensorCardProps {
  icon: string;
  label: string;
  value: string;
  unit: string;
  status: SensorStatus;
}

const STATUS_STYLES: Record<SensorStatus, string> = {
  normal:   'text-kimchi-green bg-kimchi-green/5 border-kimchi-green/20',
  warning:  'text-kimchi-orange bg-kimchi-orange/5 border-kimchi-orange/20',
  critical: 'text-kimchi-red bg-kimchi-red/5 border-kimchi-red/20',
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
