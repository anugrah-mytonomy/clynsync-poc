import type { ComponentType, SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import { AlertIcon, CheckCircleIcon, FindingsReportsIcon, ReviewQueueIcon, UploadIcon } from '@/components/ui/icons';
import OverallRiskDistribution from '@/pages/dashboard/OverallRiskDistribution';
import RecentScans from '@/pages/dashboard/RecentScans';
import FindingsRequiringAttention from '@/pages/dashboard/FindingsRequiringAttention';
import { cn } from '@/utils/cn';

type Tone = 'primary' | 'danger' | 'secondary' | 'success';
type HintTone = 'success' | 'danger' | 'muted';

interface SummaryCard {
  label: string;
  value: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: Tone;
  hint?: string;
  hintTone?: HintTone;
  highlighted?: boolean;
}

const hintToneClasses: Record<HintTone, string> = {
  success: 'text-success',
  danger: 'text-danger',
  muted: 'text-muted',
};

const summaryCards: SummaryCard[] = [
  {
    label: 'Content Analyzed',
    value: '847',
    icon: FindingsReportsIcon,
    tone: 'primary',
    hint: '+15 completed today',
    hintTone: 'success',
  },
  {
    label: 'High Risk Findings',
    value: '12',
    icon: AlertIcon,
    tone: 'danger',
    hint: 'Requires attention',
    hintTone: 'danger',
    highlighted: true,
  },
  {
    label: 'SME Review Queue',
    value: '17',
    icon: ReviewQueueIcon,
    tone: 'secondary',
  },
  {
    label: 'SME-Verified Content',
    value: '43',
    icon: CheckCircleIcon,
    tone: 'success',
    hint: 'Signed off this review cycle',
    hintTone: 'muted',
  },
];

const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Clinical Governance Overview"
        subtitle="Monitor clinical content governance, review findings, and prioritize refresh work."
        actions={
          <Button onClick={() => navigate('/dashboard/content-library')}>
            <UploadIcon className="h-4 w-4" />
            Upload Content
          </Button>
        }
      />

      <div className="flex flex-col gap-lg p-lg">
        <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, hint, tone, hintTone, highlighted }) => (
          <div
            key={label}
            className={cn(
              'rounded-lg border bg-background px-6 py-5',
              highlighted ? 'border-danger' : 'border-border',
            )}
          >
            <div className="flex items-start justify-between gap-sm">
              <p
                className={cn(
                  'text-sm font-medium',
                  tone === 'danger' ? 'text-danger' : 'text-muted',
                )}
              >
                {label}
              </p>
              <Icon className="h-5 w-5" />
            </div>
            <p
              className={cn(
                'mt-sm text-4xl font-bold',
                highlighted ? 'text-danger' : 'text-slate-900',
              )}
            >
              {value}
            </p>
            {hint && (
              <p className={cn('mt-xs text-xs font-medium', hintToneClasses[hintTone ?? 'muted'])}>
                {hint}
              </p>
            )}
          </div>
        ))}
        </div>

        <div className="grid grid-cols-1 gap-lg lg:grid-cols-[2.5fr_3fr]">
          <OverallRiskDistribution />
          <RecentScans />
        </div>

        <FindingsRequiringAttention />
      </div>
    </div>
  );
};

export default DashboardPage;
