interface CardFooterProps {
  source?: string;
  url?: string;
}

/** 展示内容来源和原文地址；没有可展示内容时整块省略。 */
export function CardFooter({ source, url }: CardFooterProps) {
  const sourceLabel = source?.trim();
  const urlLabel = url?.trim();

  if (!sourceLabel && !urlLabel) {
    return null;
  }

  return (
    <footer className="card-footer">
      <div className="card-footer__remark">
        {sourceLabel && <span className="card-footer__source">{sourceLabel}</span>}
        {sourceLabel && urlLabel && <span className="card-footer__dot">·</span>}
        {urlLabel && <span className="card-footer__url">{url}</span>}
      </div>
    </footer>
  );
}
