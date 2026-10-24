import { colors, typography } from '../../core/typography.js';

const brands = [
  {
    aliases: [
      ['youtube', 'YouTube'],
      ['油管', 'YouTube'],
    ],
    color: '#ff0000',
    width: 20,
    height: 14,
    viewBox: '0 3.5 24 17',
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    aliases: [
      ['bilibili', 'Bilibili'],
      ['bilibili live', 'Bilibili Live'],
      ['哔哩哔哩', 'Bilibili'],
      ['哔哩哔哩直播', 'Bilibili Live'],
      ['b站', 'Bilibili'],
      ['b站直播', 'Bilibili Live'],
    ],
    color: '#fb7299',
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    path: 'M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c0-.373.129-.689.386-.947.258-.257.574-.386.947-.386zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373Z',
  },
  {
    aliases: [
      ['twitter', 'Twitter'],
      ['推特', 'Twitter'],
    ],
    color: '#1d9bf0',
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    path: 'M21.543 7.104c.015.211.015.423.015.636 0 6.507-4.954 14.01-14.01 14.01v-.003A13.94 13.94 0 0 1 0 19.539a9.88 9.88 0 0 0 7.287-2.041 4.93 4.93 0 0 1-4.6-3.42 4.916 4.916 0 0 0 2.223-.084A4.926 4.926 0 0 1 .96 9.167v-.062a4.887 4.887 0 0 0 2.235.616A4.928 4.928 0 0 1 1.67 3.148 13.98 13.98 0 0 0 11.82 8.292a4.929 4.929 0 0 1 8.39-4.49 9.868 9.868 0 0 0 3.128-1.196 4.941 4.941 0 0 1-2.165 2.724A9.828 9.828 0 0 0 24 4.555a10.019 10.019 0 0 1-2.457 2.549z',
  },
  {
    aliases: [['x', 'X']],
    color: '#18181b',
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  },
];

export function SourceFooter({
  source,
  url,
  marginTop = 12,
  measure = false,
}: {
  source?: string;
  url?: string;
  marginTop?: number;
  measure?: boolean;
}) {
  const input = source?.trim();
  const key = input?.toLowerCase();
  const brand = brands.find(item => item.aliases.some(([alias]) => alias === key));
  const label = brand?.aliases.find(([alias]) => alias === key)?.[1] ?? input;
  const address = url?.trim();
  if (!label && !address) return null;
  return (
    <div
      data-measure={measure || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        width: measure ? undefined : '100%',
        flexShrink: 0,
        gap: 12,
        borderTop: '0.5px solid ' + colors.border,
        marginTop,
        paddingTop: 10,
        color: colors.muted,
        ...typography.meta,
      }}
    >
      {label && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 18,
            minWidth: 0,
            flexShrink: 0,
            maxWidth: measure ? undefined : address ? '70%' : '100%',
            color: colors.ink,
            fontWeight: 700,
          }}
        >
          {brand && (
            <svg width={brand.width} height={brand.height} viewBox={brand.viewBox} style={{ flexShrink: 0 }}>
              <path d={brand.path} fill={brand.color} />
            </svg>
          )}
          <div
            style={{
              display: 'block',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {label}
          </div>
        </div>
      )}
      {address && (
        <div
          style={{
            display: 'flex',
            minWidth: 0,
            flexGrow: measure ? 0 : 1,
            flexShrink: measure ? 0 : 1,
            justifyContent: label ? 'flex-end' : 'flex-start',
          }}
        >
          <div
            style={{
              display: 'block',
              minWidth: 0,
              maxWidth: measure ? undefined : '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {address}
          </div>
        </div>
      )}
    </div>
  );
}
