import { cn } from '@/utils/cn';
import { ContentLibraryIcon } from '@/components/ui/icons';

type ScanStatus = 'verified' | 'high-risk' | 'medium-risk';

interface RecentScan {
  id: string;
  name: string;
  scannedAt: string;
  status: ScanStatus;
}

const scanStatusConfig: Record<ScanStatus, { label: string; badgeClass: string }> = {
  verified: { label: 'Verified', badgeClass: 'bg-success/10 text-success' },
  'high-risk': { label: 'High Risk', badgeClass: 'bg-danger/10 text-danger' },
  'medium-risk': { label: 'Medium Risk', badgeClass: 'bg-amber-50 text-amber-700' },
};

const recentScans: RecentScan[] = [
  {
    id: 'scan-1',
    name: 'Pediatric Dosage Table Revision 2.pdf',
    scannedAt: 'Today, 10:33 AM',
    status: 'verified',
  },
  {
    id: 'scan-2',
    name: 'Adult Hypertension Treatment Video.mp4',
    scannedAt: 'Today, 09:15 AM',
    status: 'high-risk',
  },
  {
    id: 'scan-3',
    name: 'Diabetes Care Booklet Update.docx',
    scannedAt: 'Yesterday, 4:47 PM',
    status: 'medium-risk',
  },
];

const RecentScans = () => {
  return (
    <div className="rounded-lg border border-border bg-background px-6 py-5">
      <div className="flex items-center justify-between gap-sm">
        <h2 className="text-lg font-bold text-slate-900">Recent Scans</h2>
        <a href="#" className="text-xs font-medium text-[#007FAA] hover:underline">
          View all scans
        </a>
      </div>
      <ul className="mt-md flex flex-col gap-sm">
        {recentScans.map((scan) => {
          const status = scanStatusConfig[scan.status];
          return (
            <li
              key={scan.id}
              className="flex items-center justify-between gap-sm rounded-md border border-border px-3 py-2.5 bg-[#F4F6F9]"
            >
              <div className="flex min-w-0 items-center gap-sm">
                <ContentLibraryIcon className="h-5 w-5 shrink-0 text-muted" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{scan.name}</p>
                  <p className="text-xs text-muted">{scan.scannedAt}</p>
                </div>
              </div>
              <span
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium',
                  status.badgeClass,
                )}
              >
                {status.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default RecentScans;
