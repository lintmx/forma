interface FooterProps {
  source?: string;
  postUrl?: string;
}

export function Footer({ source, postUrl }: FooterProps) {
  const sourceLabel = source?.trim();

  if (!sourceLabel && !postUrl) {
    return null;
  }

  return (
    <footer className="card-footer">
      <div className="card-footer__remark">
        {sourceLabel && <span className="card-footer__source">{sourceLabel}</span>}
        {sourceLabel && postUrl && <span className="card-footer__dot">·</span>}
        {postUrl && <span className="card-footer__url">{postUrl}</span>}
      </div>
    </footer>
  );
}
