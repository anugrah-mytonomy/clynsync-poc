import DonutChart from '@/components/ui/DonutChart';
import { cn } from '@/utils/cn';

type RiskLevel = 'high' | 'medium' | 'low';

interface RiskSegment {
  level: RiskLevel;
  label: string;
  count: number;
  percent: number;
}

// Matches the danger/success CSS variables in theme.css; amber-500 has no
// equivalent token yet, so its hex is used directly (same as the Tailwind
// utility classes below resolve to).
const riskFillColors: Record<RiskLevel, string> = {
  high: 'rgb(var(--color-danger))',
  medium: '#f59e0b',
  low: 'rgb(var(--color-success))',
};

const riskDotClasses: Record<RiskLevel, string> = {
  high: 'bg-danger',
  medium: 'bg-amber-500',
  low: 'bg-success',
};

const riskSegments: RiskSegment[] = [
  { level: 'high', label: 'High Risk', count: 12, percent: 11 },
  { level: 'medium', label: 'Medium Risk', count: 34, percent: 30 },
  { level: 'low', label: 'Low Risk', count: 67, percent: 59 },
];

const totalFindings = riskSegments.reduce((sum, segment) => sum + segment.count, 0);

const donutData = riskSegments.map((segment) => ({
  id: segment.level,
  label: segment.label,
  value: segment.count,
  color: riskFillColors[segment.level],
}));

const OverallRiskDistribution = () => {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-5">
      <h2 className="text-lg font-bold text-slate-900">Overall Risk Distribution</h2>
      <div className="mt-10 flex items-center gap-lg">
        <DonutChart
          data={donutData}
          size={128}
          thickness={18}
          ariaLabel={`Overall risk distribution: ${riskSegments
            .map((segment) => `${segment.label} ${segment.percent}%`)
            .join(', ')}, ${totalFindings} findings total`}
          centerLabel={
            <>
              <span className="text-2xl font-bold text-slate-900">{totalFindings}</span>
              <span className="text-xs font-medium text-muted">Total findings</span>
            </>
          }
        />
        <ul className="flex flex-1 flex-col gap-5">
          {riskSegments.map((segment) => (
            <li key={segment.level} className="flex items-center justify-between gap-sm text-sm">
              <span className="flex items-center gap-sm text-slate-900">
                <span className={cn('h-2.5 w-2.5 rounded-full', riskDotClasses[segment.level])} />
                <span className="text-[#475569] text-[13px] font-normal">{segment.label} ({segment.count} findings)</span>
              </span>
              <span className="font-bold text-[13px] text-slate-900">{segment.percent}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default OverallRiskDistribution;
