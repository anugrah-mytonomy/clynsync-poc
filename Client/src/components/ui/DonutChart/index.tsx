import type { ReactNode } from 'react';
import { Pie, PieChart } from 'recharts';

export interface DonutChartSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutChartSegment[];
  size?: number;
  thickness?: number;
  paddingAngle?: number;
  cornerRadius?: number;
  centerLabel?: ReactNode;
  ariaLabel?: string;
}

const DonutChart = ({
  data,
  size = 128,
  thickness = 18,
  paddingAngle = 0,
  cornerRadius = 0,
  centerLabel,
  ariaLabel,
}: DonutChartProps) => {
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius - thickness;
  const pieData = data.map((segment) => ({ ...segment, fill: segment.color }));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={ariaLabel}>
      <PieChart width={size} height={size}>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={paddingAngle}
          cornerRadius={cornerRadius}
          stroke="none"
          isAnimationActive={false}
        />
      </PieChart>
      {centerLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel}
        </div>
      )}
    </div>
  );
};

export default DonutChart;
