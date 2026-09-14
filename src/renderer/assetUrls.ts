import type {
  ArticleCardData,
  CardAuthor,
  CardData,
  CardMedia,
  ComparisonCardData,
  SocialPostCardData,
} from '../types/card';

const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu;
const DATA_IMAGE_URL_PATTERN = /^data:image\//iu;
const BLOB_URL_PATTERN = /^blob:/iu;
const HTTP_URL_PATTERN = /^https?:\/\//iu;
/** 只匹配行内图片语法的地址部分，alt、标题等其余内容原样保留。 */
const MARKDOWN_IMAGE_PATTERN = /(?<=^|[ \t\n])!\[([^\]\n]*)\]\((<[^<>\n]*>|[^\s()\n]+)+/gu;
/** 图片语法中位于圆括号内的地址。 */
const MARKDOWN_DESTINATION_PATTERN = /\]\(\s*(<[^<>\n]*>|[^\s()\n]+)/u;

type ComparisonModuleData = ComparisonCardData['modules'][number];
type ComparisonImageValue = Extract<NonNullable<ComparisonModuleData['before']>, { url: string }>;

function pathFor(parentPath: string, childPath: string): string {
  return parentPath ? `${parentPath}.${childPath}` : childPath;
}

function parseAssetBaseUrl(value: string | undefined): URL | undefined {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return undefined;
  }

  try {
    const baseUrl = new URL(normalizedValue);
    if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') {
      throw new Error('Unsupported asset base URL protocol.');
    }
    return baseUrl;
  } catch {
    throw new Error('CardData.options.assetBaseUrl must be an absolute http(s) URL.');
  }
}

function isAllowedAbsoluteAssetUrl(value: string): boolean {
  if (DATA_IMAGE_URL_PATTERN.test(value) || BLOB_URL_PATTERN.test(value)) {
    return true;
  }

  if (!HTTP_URL_PATTERN.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function resolveAssetUrl(value: string, baseUrl: URL | undefined, fieldPath: string): string;
function resolveAssetUrl(
  value: string | undefined,
  baseUrl: URL | undefined,
  fieldPath: string,
): string | undefined;
function resolveAssetUrl(
  value: string | undefined,
  baseUrl: URL | undefined,
  fieldPath: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return normalizedValue;
  }

  if (URL_SCHEME_PATTERN.test(normalizedValue)) {
    if (isAllowedAbsoluteAssetUrl(normalizedValue)) {
      return normalizedValue;
    }
    throw new Error(
      `CardData.${fieldPath} must be an http(s), data:image, blob, or relative asset URL.`,
    );
  }

  if (!baseUrl) {
    throw new Error(`CardData.${fieldPath} is a relative asset URL; provide options.assetBaseUrl.`);
  }

  return new URL(normalizedValue, baseUrl).href;
}

function resolveAuthor(
  author: CardAuthor | undefined,
  baseUrl: URL | undefined,
  parentPath: string,
): CardAuthor | undefined {
  if (!author) {
    return undefined;
  }

  return {
    ...author,
    avatarUrl: resolveAssetUrl(author.avatarUrl, baseUrl, pathFor(parentPath, 'author.avatarUrl')),
  };
}

function resolveMedia(
  media: CardMedia[] | undefined,
  baseUrl: URL | undefined,
  parentPath: string,
): CardMedia[] | undefined {
  return media?.map((item, index) => {
    const itemPath = `${parentPath ? `${parentPath}.` : ''}media[${index}]`;
    return {
      ...item,
      url: resolveAssetUrl(item.url, baseUrl, `${itemPath}.url`),
      previewUrl: resolveAssetUrl(item.previewUrl, baseUrl, `${itemPath}.previewUrl`),
    };
  });
}

function resolveSocialPostSnapshot<
  T extends {
    author?: CardAuthor;
    media?: CardMedia[];
  },
>(post: T, baseUrl: URL | undefined, parentPath: string): T {
  return {
    ...post,
    author: resolveAuthor(post.author, baseUrl, parentPath),
    media: resolveMedia(post.media, baseUrl, parentPath),
  };
}

function resolveSocialPost(data: SocialPostCardData, baseUrl: URL | undefined): SocialPostCardData {
  const resolvedData = resolveSocialPostSnapshot(data, baseUrl, '');

  return {
    ...resolvedData,
    replyChain: data.replyChain?.map((reply, index) =>
      resolveSocialPostSnapshot(reply, baseUrl, `replyChain[${index}]`),
    ),
    quotedPost: data.quotedPost
      ? resolveSocialPostSnapshot(data.quotedPost, baseUrl, 'quotedPost')
      : undefined,
  };
}

function isComparisonImageValue(
  value: ComparisonModuleData['before'],
): value is ComparisonImageValue {
  return typeof value === 'object' && value !== null && typeof value.url === 'string';
}

function resolveComparisonImageValue(
  value: ComparisonModuleData['before'],
  baseUrl: URL | undefined,
  fieldPath: string,
): ComparisonModuleData['before'] {
  if (!isComparisonImageValue(value)) {
    return value;
  }

  return {
    ...value,
    url: resolveAssetUrl(value.url, baseUrl, `${fieldPath}.url`),
  };
}

function resolveComparison(data: ComparisonCardData, baseUrl: URL | undefined): ComparisonCardData {
  return {
    ...data,
    modules: data.modules.map((module, index) => {
      if (module.type !== 'image') {
        return module;
      }

      return {
        ...module,
        before: resolveComparisonImageValue(module.before, baseUrl, `modules[${index}].before`),
        after: resolveComparisonImageValue(module.after, baseUrl, `modules[${index}].after`),
      };
    }),
  };
}

/** 被奇数个反斜杠转义的 `![` 是普通文本，不参与地址解析。 */
function isEscaped(text: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

/**
 * 正文和译文里的 Markdown 图片地址走与其他媒体一致的校验和补全；
 * 普通链接是外部地址，不参与资源解析，匹配不到地址时按原文保留。
 */
function resolveMarkdownImageUrls(
  text: string,
  baseUrl: URL | undefined,
  fieldPath: string,
): string {
  let imageIndex = 0;

  return text.replace(MARKDOWN_IMAGE_PATTERN, (match: string, offset: number) => {
    imageIndex += 1;
    if (isEscaped(text, offset)) {
      return match;
    }

    const rawDestination = MARKDOWN_DESTINATION_PATTERN.exec(match)?.[1];
    if (!rawDestination) {
      return match;
    }

    const isAngleBracketed = rawDestination.startsWith('<');
    const destination = isAngleBracketed ? rawDestination.slice(1, -1) : rawDestination;
    const resolvedDestination = resolveAssetUrl(
      destination,
      baseUrl,
      `${fieldPath} 第 ${imageIndex} 张图片`,
    );

    return match.replace(rawDestination, () =>
      isAngleBracketed ? `<${resolvedDestination}>` : resolvedDestination,
    );
  });
}

function resolveArticle(data: ArticleCardData, baseUrl: URL | undefined): ArticleCardData {
  const translation = data.translation
    ? {
        ...data.translation,
        content:
          data.translation.contentType === 'text' || !data.translation.content
            ? data.translation.content
            : resolveMarkdownImageUrls(data.translation.content, baseUrl, 'translation.content'),
      }
    : undefined;

  return {
    ...data,
    content:
      data.contentType === 'text'
        ? data.content
        : resolveMarkdownImageUrls(data.content, baseUrl, 'content'),
    translation,
  };
}

export function resolveCardAssetUrls(data: CardData): CardData {
  const baseUrl = parseAssetBaseUrl(data.options?.assetBaseUrl);

  if (data.type === 'social_post') {
    return resolveSocialPost(data, baseUrl);
  }

  if (data.type === 'article') {
    return resolveArticle(data, baseUrl);
  }

  return resolveComparison(data, baseUrl);
}

export function validateCardAssetUrls(data: CardData): string[] {
  try {
    resolveCardAssetUrls(data);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : 'Card asset URL is invalid.'];
  }
}
