import { useState } from 'react';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeImageUrl, safeLinkUrl } from './urlSafety';
import styles from '../Card.module.css';

interface MarkdownContentProps {
  /** Markdown 源文本。 */
  text: string;
  /** 译文等次要正文使用更紧凑的排版。 */
  compact?: boolean;
}

const remarkPlugins = [remarkGfm];

/** 图片无法加载时保留占位说明，避免卡片布局抖动。 */
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [hasError, setHasError] = useState(false);
  const safeUrl = safeImageUrl(src ?? '');

  if (!safeUrl) {
    return null;
  }

  if (hasError) {
    return <span className={styles.imageFallback}>图片加载失败</span>;
  }

  return (
    <img
      className={styles.image}
      src={safeUrl}
      alt={alt ?? ''}
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const safeUrl = safeLinkUrl(href ?? '');

  if (!safeUrl) {
    return <span className={styles.link}>{children}</span>;
  }

  return (
    <a className={styles.link} href={safeUrl}>
      {children}
    </a>
  );
}

/**
 * 正文与译文的 Markdown 渲染。
 * 原始 HTML 一律忽略，链接与图片地址经过协议校验，链接地址指向自身时保留纯文本。
 */
export function MarkdownContent({ text, compact = false }: MarkdownContentProps) {
  return (
    <div className={compact ? `${styles.markdown} ${styles.markdownCompact}` : styles.markdown}>
      <Markdown
        remarkPlugins={remarkPlugins}
        skipHtml
        components={{
          a: MarkdownLink,
          img: MarkdownImage,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}
