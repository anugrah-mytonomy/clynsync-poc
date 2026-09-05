import { useState } from 'react';
import { cn } from '@/utils/cn';
import type { ScanHighestRiskLevel, ScanSectionResult, ScanState } from '@/types/contentLibrary';

interface ScanResultsProps {
  scan: ScanState;
}

const RISK_DOT_CLASSES: Record<ScanHighestRiskLevel, string> = {
  HIGH: 'bg-danger',
  MEDIUM: 'bg-amber-500',
  CONFIRMATORY: 'bg-blue-500',
};

const RISK_LABEL: Record<ScanHighestRiskLevel, string> = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  CONFIRMATORY: 'LOW',
};

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface/60 px-md py-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900">{children}</div>
    </div>
  );
}

function FindingCard({ section }: { section: ScanSectionResult }) {
  const [expanded, setExpanded] = useState(false);
  const isConfirmed = section.category === 'Confirmatory (No Issue)' && !section.suggested_change;

  return (
    <li className="rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-sm px-md py-sm text-left"
      >
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            isConfirmed ? 'bg-success' : section.risk_level === 'HIGH' ? 'bg-danger' : 'bg-amber-500',
          )}
        />
        <span className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
          {section.index + 1}. {section.title}
        </span>
        <span className="shrink-0 text-xs text-muted">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-sm border-t border-border px-md py-sm text-xs">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <p className="font-medium uppercase tracking-wide text-muted">Category</p>
              <p className="mt-0.5 text-slate-900">{section.category}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide text-muted">Status / SME Review</p>
              <p className="mt-0.5 text-slate-900">{section.status_note}</p>
            </div>
          </div>

          {section.current_text && (
            <div>
              <p className="font-medium uppercase tracking-wide text-muted">Current Text</p>
              <p className="mt-0.5 rounded border border-border bg-surface/60 px-sm py-xs italic text-slate-900">
                "{section.current_text}"
              </p>
            </div>
          )}

          <div>
            <p className="font-medium uppercase tracking-wide text-muted">Suggested Change</p>
            {section.suggested_change ? (
              <p className="mt-0.5 rounded border border-success/30 bg-success/10 px-sm py-xs text-slate-900">
                {section.suggested_change}
              </p>
            ) : (
              <p className="mt-0.5 text-muted">N/A</p>
            )}
          </div>

          <div>
            <p className="font-medium uppercase tracking-wide text-muted">Evidence / Rationale</p>
            <p className="mt-0.5 text-slate-900">{section.evidence}</p>
          </div>

          {section.clinical_impact && (
            <div>
              <p className="font-medium uppercase tracking-wide text-muted">Clinical Impact</p>
              <p className="mt-0.5 text-slate-900">{section.clinical_impact}</p>
            </div>
          )}

          {(section.cited_sources.length > 0 || section.source_url) && (
            <div>
              <p className="font-medium uppercase tracking-wide text-muted">Cited Sources</p>
              <p className="mt-0.5 text-slate-900">
                {section.cited_sources.join('; ')}
                {section.source_url && (
                  <>
                    {section.cited_sources.length > 0 ? ' — ' : ''}
                    <a
                      href={section.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {new URL(section.source_url).hostname.replace(/^www\./, '')}
                    </a>
                    {section.source_tier && <span className="ml-xs text-muted">Tier {section.source_tier}</span>}
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

const ScanResults = ({ scan }: ScanResultsProps) => {
  if (scan.status === 'unsupported') {
    return (
      <p className="mt-xs text-xs text-muted">
        Live guideline verification is only available for .docx files in this POC.
      </p>
    );
  }

  if (scan.status === 'scanning') {
    const total = scan.totalChecks ?? 0;
    const done = scan.sections.length;
    return (
      <p className="mt-xs text-xs text-muted">
        Checking against live clinical guidance… {total ? `${done} of ${total} section(s)` : 'starting…'}
        {typeof scan.searchBudget === 'number' ? ` (up to ${scan.searchBudget} verified live)` : ''}
      </p>
    );
  }

  if (scan.status === 'error' && scan.sections.length === 0) {
    return <p className="mt-xs text-xs text-danger">{scan.error ?? 'Scan failed.'}</p>;
  }

  const summary = scan.summary;
  const checkedSections = scan.sections.filter((s) => s.verdict !== 'NOT_CHECKED' && s.verdict !== 'ERROR');
  const notCheckedSections = scan.sections.filter((s) => s.verdict === 'NOT_CHECKED');
  const errorSections = scan.sections.filter((s) => s.verdict === 'ERROR');
  const improvements = checkedSections.filter(
    (s) => s.category !== 'Confirmatory (No Issue)' || Boolean(s.suggested_change),
  );
  const confirmed = checkedSections.filter(
    (s) => s.category === 'Confirmatory (No Issue)' && !s.suggested_change,
  );

  return (
    <div className="mt-sm flex flex-col gap-md rounded-lg border border-border bg-background p-md">
      <h3 className="text-base font-bold text-slate-900">{scan.docTitle || summary?.doc_title}</h3>

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            <StatTile label="Doc Type">{summary.doc_type}</StatTile>
            <StatTile label="Highest Risk">
              <span className="flex items-center gap-xs">
                <span className={cn('h-2.5 w-2.5 rounded-full', RISK_DOT_CLASSES[summary.highest_risk_level])} />
                {RISK_LABEL[summary.highest_risk_level]}
              </span>
            </StatTile>
            <StatTile label="Findings">{improvements.length}</StatTile>
            <StatTile label="Confidence">{summary.confidence}</StatTile>
            <StatTile label="Currency Status">{summary.currency_status}</StatTile>
            <StatTile label="Primary Risk Driver">{summary.primary_risk_driver}</StatTile>
            <StatTile label="SME Review">{summary.sme_review_needed}</StatTile>
            <StatTile label="SME Role">{summary.sme_role}</StatTile>
          </div>

          <div className="rounded-md border border-border bg-surface/60 p-sm text-xs">
            <p className="font-medium uppercase tracking-wide text-muted">Key Issues Summary</p>
            <p className="mt-1 text-slate-900">{summary.key_issues_summary}</p>
          </div>

          <div className="rounded-md border border-border bg-surface/60 p-sm text-xs">
            <p className="font-medium uppercase tracking-wide text-muted">Recommended Action</p>
            <p className="mt-1 font-semibold text-slate-900">{summary.recommended_action}</p>
          </div>
        </>
      )}

      {improvements.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-900">Improvements ({improvements.length})</h4>
          <ul className="mt-xs flex flex-col gap-xs">
            {improvements.map((section) => (
              <FindingCard key={section.index} section={section} />
            ))}
          </ul>
        </div>
      )}

      {confirmed.length > 0 && (
        <div>
          <h4 className="text-sm font-bold text-slate-900">Confirmed ({confirmed.length})</h4>
          <ul className="mt-xs flex flex-col gap-xs">
            {confirmed.map((section) => (
              <FindingCard key={section.index} section={section} />
            ))}
          </ul>
        </div>
      )}

      {(notCheckedSections.length > 0 || errorSections.length > 0) && (
        <div>
          <h4 className="text-sm font-bold text-slate-900">
            Not Checked ({notCheckedSections.length + errorSections.length})
          </h4>
          <ul className="mt-xs flex flex-col gap-xs text-xs">
            {[...notCheckedSections, ...errorSections].map((section) => (
              <li key={section.index} className="rounded-md border border-border bg-surface/60 px-sm py-xs">
                <span className="font-medium text-slate-900">{section.title}</span>
                <span className="text-muted"> — {section.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary && <p className="text-xs text-muted">{summary.coverage_note}</p>}
    </div>
  );
};

export default ScanResults;
