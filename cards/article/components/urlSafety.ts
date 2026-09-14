/** 协议与相对地址判断，与 src/renderer/assetUrls.ts 保持一致的语义。 */
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/iu;
const HTTP_URL_PATTERN = /^https?:\/\//iu;
const MAILTO_URL_PATTERN = /^mailto:/iu;
const DATA_IMAGE_URL_PATTERN = /^data:image\//iu;
const BLOB_URL_PATTERN = /^blob:/iu;

/** 与 assetUrls.ts 相同的绝对 http(s) 校验，额外排除缺少主机名的情况。 */
function isAllowedHttpUrl(value: string): boolean {
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

function isRelativeUrl(value: string): boolean {
  return !URL_SCHEME_PATTERN.test(value) && !value.startsWith('//');
}

/** 链接只保留 http(s)、mailto 和相对地址，其他协议不生成 href。 */
export function safeLinkUrl(value: string): string | undefined {
  const normalizedValue = value.trim();
  if (!normalizedValue || normalizedValue.startsWith('#')) {
    return normalizedValue || undefined;
  }

  if (isRelativeUrl(normalizedValue)) {
    return normalizedValue;
  }

  if (MAILTO_URL_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }

  return isAllowedHttpUrl(normalizedValue) ? normalizedValue : undefined;
}

/** 正文图片只保留 http(s)、data:image、blob 或相对地址，与公共资源地址规则一致。 */
export function safeImageUrl(value: string): string | undefined {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return undefined;
  }

  if (isRelativeUrl(normalizedValue)) {
    return normalizedValue;
  }

  if (DATA_IMAGE_URL_PATTERN.test(normalizedValue) || BLOB_URL_PATTERN.test(normalizedValue)) {
    return normalizedValue;
  }

  return isAllowedHttpUrl(normalizedValue) ? normalizedValue : undefined;
}
