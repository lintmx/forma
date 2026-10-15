import { colors, typography } from '../../core/typography.js';

export function SourceFooter({ source, url }: { source?: string; url?: string }) {
  const label = source?.trim();
  const address = url?.trim();
  if (!label && !address) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        width: '100%',
        borderTop: '1px solid #eef0f3',
        marginTop: 12,
        paddingTop: 10,
        color: colors.muted,
        ...typography.meta,
      }}
    >
      {label && (
        <div
          style={{
            display: 'flex',
            maxWidth: address ? '50%' : '100%',
            flexShrink: 0,
            padding: '1px 6px',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            backgroundColor: '#f6f7f8',
            color: '#6b7280',
            ...typography.meta,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
      )}
      {label && address && <div style={{ display: 'flex', flexShrink: 0, margin: '0 5px' }}>·</div>}
      {address && (
        <div
          style={{
            display: 'flex',
            minWidth: 0,
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {address}
        </div>
      )}
    </div>
  );
}
