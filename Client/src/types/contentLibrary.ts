export type SupportedExtension = 'docx' | 'pdf' | 'html' | 'zip';

export type UploadStatus = 'queued' | 'scanning' | 'success' | 'validation-failed' | 'upload-failed';

/**
 * Verdicts returned by the ClinSync server (`scripts/compare_engine.py`) for
 * one document section. Mirrors the SSE `result` event's `verdict` field.
 */
export type ScanVerdict = 'MATCH' | 'MODIFIED' | 'RISK' | 'UNVERIFIED' | 'NOT_CHECKED' | 'ERROR';

export type ScanRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type ScanHighestRiskLevel = 'HIGH' | 'MEDIUM' | 'CONFIRMATORY';

/**
 * One section's finding, as produced by `compare_engine.py`'s verify pass
 * (or a NOT_CHECKED/ERROR placeholder for sections that weren't verified).
 */
export interface ScanSectionResult {
  index: number;
  title: string;
  verdict: ScanVerdict;
  risk_level: ScanRiskLevel;
  /** Short label, e.g. "Health Literacy Enhancement" or "Confirmatory (No Issue)". */
  category: string;
  /** Plain-English status, e.g. "Suggestion — low priority." or "Confirmed — No changes needed." */
  status_note: string;
  /** Verbatim excerpt this finding is about, if the model quoted one. */
  current_text?: string | null;
  /** Concrete rewrite fixing the issue, or null if nothing needs to change. */
  suggested_change?: string | null;
  /** What current guidance actually says. */
  evidence: string;
  /** What happens if this is left as-is. */
  clinical_impact?: string | null;
  /** @deprecated kept for older event shapes; same content as `evidence`. */
  explanation: string;
  source_url?: string | null;
  source_tier?: number | null;
  /** Short names of the guidance relied on, e.g. ["FDA Acetaminophen", "CDC Wound Care"]. */
  cited_sources: string[];
}

export interface ScanSummary {
  counts: Partial<Record<ScanVerdict, number>>;
  checked: number;
  total_checks: number;
  highest_risk_level: ScanHighestRiskLevel;
  sme_review_needed: string;
  coverage_note: string;
  doc_title: string;
  doc_type: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  currency_status: string;
  primary_risk_driver: string;
  sme_role: string;
  key_issues_summary: string;
  recommended_action: string;
}

export type ScanStatus = 'scanning' | 'done' | 'error' | 'unsupported';

export interface ScanState {
  status: ScanStatus;
  sections: ScanSectionResult[];
  docTitle?: string;
  totalChecks?: number;
  searchBudget?: number;
  uploadWarning?: string;
  summary?: ScanSummary;
  error?: string;
}

export interface VideoSection {
  id: string;
  index: number;
  title: string;
}

export interface ZipEntryResult {
  id: string;
  path: string;
  fileName: string;
  valid: boolean;
  error?: string;
  videoSections?: VideoSection[];
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  videoSections?: VideoSection[];
  zipEntries?: ZipEntryResult[];
}

export type CloudUploadStatus = 'idle' | 'uploading' | 'success' | 'failed' | 'canceled';

/**
 * Progress/result of streaming this file directly to S3 in chunks (see
 * `Client/src/utils/s3ChunkedUpload.ts`). Independent of `scan` — every file
 * gets stored in S3 regardless of type, while only .docx also gets scanned.
 */
export interface CloudUploadState {
  status: CloudUploadStatus;
  uploadedBytes: number;
  totalBytes: number;
  percent: number;
  error?: string;
  key?: string;
  location?: string;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  extension: SupportedExtension | null;
  size: number;
  status: UploadStatus;
  /** Whether the deep "Validate Files" pass has run for this item. */
  validated: boolean;
  validation?: FileValidationResult;
  /** Live guideline-verification result from the ClinSync server, .docx only. */
  scan?: ScanState;
  /** Direct-to-S3 chunked upload progress/result, set for every valid file. */
  cloudUpload?: CloudUploadState;
}
