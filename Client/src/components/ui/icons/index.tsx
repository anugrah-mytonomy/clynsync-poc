import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const OutlineIcon = ({ children, className = 'h-5 w-5', ...props }: IconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
};

const DashboardIcon = (props: IconProps) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={props.className ?? 'h-5 w-5'}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
};

const ContentLibraryIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" />
      <path d="M20 4.5A1.5 1.5 0 0 0 18.5 3H13v18h5.5a1.5 1.5 0 0 0 1.5-1.5v-15Z" />
    </OutlineIcon>
  );
};

const ScansIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </OutlineIcon>
  );
};

const FindingsReportsIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
      <path d="M9 10h6M9 14h6M9 18h3" />
    </OutlineIcon>
  );
};

const ReviewQueueIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />
      <circle cx="17" cy="8" r="2.2" />
      <path d="M15.5 14.2c2.9.4 5 2.9 5 5.8" />
    </OutlineIcon>
  );
};

const HelpIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.7 2.2c-.7.4-1.2.9-1.2 1.8v.3" />
      <circle cx="12" cy="17" r="0.4" fill="currentColor" stroke="none" />
    </OutlineIcon>
  );
};

const SettingsIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.97 7.97 0 0 0 0-3l1.9-1.5-2-3.4-2.2.9a8 8 0 0 0-2.6-1.5L16 2h-4l-.4 2.5a8 8 0 0 0-2.6 1.5l-2.2-.9-2 3.4L6.6 10.5a8 8 0 0 0 0 3L4.7 15l2 3.4 2.2-.9a8 8 0 0 0 2.6 1.5L12 22h4l.4-2.5a8 8 0 0 0 2.6-1.5l2.2.9 2-3.4z" />
    </OutlineIcon>
  );
};

const AlertIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z" />
      <path d="M12 9v4" />
      <circle cx="12" cy="16.5" r="0.4" fill="currentColor" stroke="none" />
    </OutlineIcon>
  );
};

const CheckCircleIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5" />
    </OutlineIcon>
  );
};

const UploadIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M12 15V4M8 8l4-4 4 4" />
      <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
    </OutlineIcon>
  );
};

const LogoutIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </OutlineIcon>
  );
};

const DocumentIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5V8h4" />
      <path d="M8.5 12.5h7M8.5 16h4.5" />
    </OutlineIcon>
  );
};

const VideoIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <rect x="3" y="6" width="13" height="12" rx="1.5" />
      <path d="M16 10.5 21 7v10l-5-3.5Z" />
    </OutlineIcon>
  );
};

const TrashIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
      <path d="M10 11v6M14 11v6" />
    </OutlineIcon>
  );
};

const RefreshIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M4.5 9a8 8 0 0 1 14.1-3.5L20 8" />
      <path d="M19.5 15a8 8 0 0 1-14.1 3.5L4 16" />
    </OutlineIcon>
  );
};

const CloudIcon = (props: IconProps) => {
  return (
    <OutlineIcon {...props}>
      <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A5.5 5.5 0 0 1 17.4 8.02 4 4 0 0 1 17 18H7Z" />
    </OutlineIcon>
  );
};

const MytonomyMarkIcon = (props: IconProps) => {
  return (
    <svg
      viewBox="0 0 22 22"
      className={props.className ?? 'h-6 w-6'}
      aria-hidden="true"
      {...props}
    >
      <rect x="1" y="1" width="9" height="9" rx="2" fill="#22C55E" />
      <rect x="12" y="1" width="9" height="9" rx="2" fill="#3B82F6" />
      <rect x="1" y="12" width="9" height="9" rx="2" fill="#EF4444" />
      <rect x="12" y="12" width="9" height="9" rx="2" fill="#F59E0B" />
    </svg>
  );
};

export {
  AlertIcon,
  CheckCircleIcon,
  CloudIcon,
  ContentLibraryIcon,
  DashboardIcon,
  DocumentIcon,
  FindingsReportsIcon,
  HelpIcon,
  LogoutIcon,
  MytonomyMarkIcon,
  RefreshIcon,
  ReviewQueueIcon,
  ScansIcon,
  SettingsIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
};
