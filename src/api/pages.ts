const styles = `
  :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif; color: #223b35; background: #f6f7f4; font-synthesis: none; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100svh; display: flex; flex-direction: column; }
  a { color: inherit; text-decoration: none; }
  a:focus-visible { outline: 3px solid #83b5a0; outline-offset: 5px; }
  header, footer, main { width: min(100% - 64px, 1040px); margin-inline: auto; }
  header { padding-block: 28px; }
  .brand { display: inline-flex; align-items: center; gap: 10px; font-size: 23px; font-weight: 650; letter-spacing: -0.8px; }
  .mark { display: grid; place-items: center; width: 32px; height: 36px; border-radius: 8px; background: #264e40; color: #f6f7f4; font: italic 32px Georgia, serif; }
  main { flex: 1; padding-block: clamp(48px, 10vh, 112px) 64px; }
  .eyebrow { color: #64796b; font: 11px ui-monospace, monospace; letter-spacing: 2px; }
  h1 { max-width: 800px; margin: 22px 0; font-size: clamp(36px, 5.5vw, 60px); line-height: 1.25; letter-spacing: -2px; font-weight: 550; text-wrap: balance; }
  .description { max-width: 580px; color: #647469; font-size: 16px; line-height: 1.9; margin: 0; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
  .button { display: inline-flex; align-items: center; justify-content: center; gap: 28px; padding: 14px 20px; border: 1px solid #d5ddd2; border-radius: 8px; font-size: 14px; transition: background 150ms; }
  .button:hover { background: #e9eee5; }
  .primary { color: white; background: #264e40; border-color: #264e40; }
  .primary:hover { background: #1b3e31; }
  .note { margin-top: 16px; color: #647469; font-size: 12px; }
  .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; padding: 32px 0 0; margin-top: 72px; border-top: 1px solid #dce3d8; }
  .number { font: 11px ui-monospace, monospace; color: #64796b; }
  h2 { margin: 16px 0 10px; font-size: 16px; font-weight: 600; }
  .features p { margin: 0; color: #647469; font-size: 14px; line-height: 1.8; }
  footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; border-top: 1px solid #dce3d8; padding-block: 24px; color: #64796b; font-size: 11px; }
  .error-code { margin: 0 0 24px; font: 500 clamp(80px, 15vw, 132px)/1 ui-monospace, monospace; letter-spacing: -8px; color: #b0beb1; }
  .not-found h1 { font-size: clamp(30px, 5vw, 44px); letter-spacing: -1px; }
  @media (max-width: 600px) {
    header, footer, main { width: calc(100% - 40px); }
    header { padding-block: 22px; }
    main { padding-block: 48px; }
    h1 { letter-spacing: -1px; }
    .features { grid-template-columns: 1fr; gap: 28px; margin-top: 48px; }
    h2 { margin-top: 10px; }
  }
  @media (prefers-reduced-motion: reduce) { .button { transition: none; } }
`;

export function pageResponse(page: 'home' | 'not-found', playground: boolean) {
  const home = page === 'home';
  const playgroundLink = '<a class="button primary" href="/dev">打开 Playground <span aria-hidden="true">↗</span></a>';
  const content = home
    ? `<p class="eyebrow">JSON IN. IMAGES OUT.</p>
      <h1>让数据，成为图片。</h1>
      <p class="description">Forma 将 JSON 数据渲染为清晰的图片。选择模板、填入内容，即可生成适合分享与集成的 PNG 或 SVG。</p>
      <div class="actions">${playgroundLink}</div>
      ${playground ? '' : '<p class="note">当前实例未开放 Playground。</p>'}
      <section class="features" aria-label="主要功能">
        <div><span class="number">01 / INPUT</span><h2>结构化输入</h2><p>通过 HTTP API 提交 JSON，让图片生成融入你的应用与工作流。</p></div>
        <div><span class="number">02 / TEMPLATE</span><h2>模板化排版</h2><p>支持文本、社交动态、内容对比与文章，也可用 TypeScript / TSX 扩展模板。</p></div>
        <div><span class="number">03 / OUTPUT</span><h2>两种格式，即刻交付</h2><p>导出高清 PNG 或矢量 SVG，在 Playground 中预览、调整并下载。</p></div>
      </section>`
    : `<p class="error-code" aria-hidden="true">404</p>
      <p class="eyebrow">PAGE NOT FOUND</p>
      <h1>这个页面还没有成形。</h1>
      <p class="description">你访问的页面不存在，可能已被移动，或链接地址有误。</p>
      <div class="actions"><a class="button primary" href="/">返回首页 <span aria-hidden="true">←</span></a>${playground ? '<a class="button" href="/dev">打开 Playground <span aria-hidden="true">↗</span></a>' : ''}</div>`;
  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Forma 将 JSON 数据通过模板渲染为 PNG 或 SVG，提供 HTTP API 和在线 Playground。">
  ${home ? '' : '<meta name="robots" content="noindex">'}
  <title>${home ? 'Forma · 让数据成为图片' : '404 · 页面未找到 · Forma'}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23264e40'/%3E%3Ctext x='9' y='25' fill='white' font-family='Georgia' font-style='italic' font-size='30'%3Ef%3C/text%3E%3C/svg%3E">
  <style>${styles}</style>
</head>
<body>
  <header><a class="brand" href="/" aria-label="Forma 首页"><span class="mark" aria-hidden="true">f</span>Forma</a></header>
  <main${home ? '' : ' class="not-found"'}>${content}</main>
  <footer><span>Forma · 让内容有形</span><span>JSON → PNG / SVG</span></footer>
</body>
</html>`,
    {
      status: home ? 200 : 404,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...(home ? {} : { Vary: 'Accept' }),
      },
    },
  );
}
