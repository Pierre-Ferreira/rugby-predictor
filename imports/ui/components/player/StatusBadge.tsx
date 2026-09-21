export type PlayerStatusTone =
  'brand' | 'danger' | 'info' | 'neutral' | 'success' | 'warning';

const toneClassNames: Record<PlayerStatusTone, string> = {
  brand: 'rr-status-badge--brand',
  danger: 'rr-status-badge--danger',
  info: 'rr-status-badge--info',
  neutral: 'rr-status-badge--neutral',
  success: 'rr-status-badge--success',
  warning: 'rr-status-badge--warning',
};

export const StatusBadge = ({
  className,
  label,
  tone = 'neutral',
}: {
  readonly className?: string;
  readonly label: string;
  readonly tone?: PlayerStatusTone;
}) => (
  <span
    className={['rr-status-badge', toneClassNames[tone], className ?? ''].join(
      ' ',
    )}
  >
    {label}
  </span>
);
