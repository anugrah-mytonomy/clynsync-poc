import CardTable, { type CardTableColumn } from '@/components/ui/CardTable';
import { cn } from '@/utils/cn';

type RiskLevel = 'high' | 'medium' | 'low';
type AwaitingAction = 'sme-review' | 'pending';

interface Finding {
  id: string;
  description: string;
  source: string;
  riskLevel: RiskLevel;
  awaitingAction: AwaitingAction;
}

const riskBadgeClasses: Record<RiskLevel, string> = {
  high: 'bg-danger/10 text-danger',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-success/10 text-success',
};

const riskLabels: Record<RiskLevel, string> = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Low Risk',
};

const awaitingActionLabels: Record<AwaitingAction, string> = {
  'sme-review': 'SME Review',
  pending: 'Pending',
};

const awaitingActionClasses: Record<AwaitingAction, string> = {
  'sme-review': 'text-secondary',
  pending: 'text-muted',
};

const findings: Finding[] = [
  {
    id: 'finding-1',
    description: 'FDA Warning on Ibuprofen Contraindications missing',
    source: 'Pediatric Pain Guide.pdf',
    riskLevel: 'high',
    awaitingAction: 'sme-review',
  },
  {
    id: 'finding-2',
    description: 'Obsolete hypertension dosage parameter mentioned',
    source: 'Cardio_Education_Slides.pptx',
    riskLevel: 'high',
    awaitingAction: 'pending',
  },
  {
    id: 'finding-3',
    description: 'Recommendation out of sync with AHA 2024 guidelines',
    source: 'Stroke_Guide_Draft.docx',
    riskLevel: 'medium',
    awaitingAction: 'sme-review',
  },
  {
    id: 'finding-4',
    description: 'Medication spelling discrepancy (Acetaminophen)',
    source: 'Medication_Safety_Video.mp4',
    riskLevel: 'low',
    awaitingAction: 'pending',
  },
];

const columns: CardTableColumn<Finding>[] = [
  {
    key: 'description',
    header: 'Finding Description',
    render: (finding) => <span className="font-medium text-slate-900 text-[13px]">{finding.description}</span>,
  },
  {
    key: 'source',
    header: 'Content Source',
    render: (finding) => <span className="text-muted text-[13px]">{finding.source}</span>,
  },
  {
    key: 'riskLevel',
    header: 'Risk Level',
    render: (finding) => (
      <span
        className={cn(
          'inline-block rounded-md px-2.5 py-1 text-xs font-medium',
          riskBadgeClasses[finding.riskLevel],
        )}
      >
        {riskLabels[finding.riskLevel]}
      </span>
    ),
  },
  {
    key: 'awaitingAction',
    header: 'Awaiting Action',
    render: (finding) => (
      <span className={cn('font-medium text-xs', awaitingActionClasses[finding.awaitingAction])}>
        {awaitingActionLabels[finding.awaitingAction]}
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    align: 'right',
    render: () => (
      <a href="#" className="font-medium text-[#007FAA] text-[13px] hover:underline">
        Review Finding
      </a>
    ),
  },
];

const FindingsRequiringAttention = () => {
  return (
    <CardTable
      title="Findings Requiring Attention"
      headerAction={
        <a href="#" className="text-xs font-medium text-[#007FAA] hover:underline">
          View all queue
        </a>
      }
      data={findings}
      getRowKey={(finding) => finding.id}
      columns={columns}
    />
  );
};

export default FindingsRequiringAttention;
