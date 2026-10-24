const styles = `
  :root { --paper: #f5f3ee; --ink: #242722; --muted: #676a62; --line: #cdcec5; --blue: #2b4aff; --display: 72px; --motion: 180ms; --slow-motion: 500ms; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif; color: var(--ink); background: var(--paper); font-synthesis: none; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin: 0; min-height: 100svh; display: flex; flex-direction: column; }
  ::selection { background: #d7deff; color: #19278b; }
  a { color: inherit; text-decoration: none; }
  a:focus-visible { outline: 2px solid var(--blue); outline-offset: 6px; }
  header, footer, main { width: min(100% - 112px, 1360px); margin-inline: auto; }
  header { display: flex; justify-content: space-between; align-items: center; min-height: 96px; border-bottom: .5px solid var(--line); }
  .brand { display: inline-flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 650; letter-spacing: -1px; }
  .mark { display: grid; place-items: center; width: 32px; height: 32px; background: var(--blue); color: white; font: italic 24px Georgia, serif; border-radius: 4px; }
  nav { display: flex; gap: 32px; align-items: center; font-size: 12px; }
  nav a { padding-block: 12px; transition: color var(--motion); }
  nav a:hover, .text-link:hover { color: var(--blue); }
  .nav-current { color: var(--muted); }
  .nav-play { display: flex; align-items: center; gap: 24px; }
  main { flex: 1; }
  .hero { display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 64px; padding-block: 80px 88px; }
  .eyebrow, .number, .specimen-label, .edition, .proof, .output, footer { font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: 1px; }
  .eyebrow { display: flex; align-items: center; gap: 12px; margin: 0; color: var(--muted); }
  .eyebrow::before { content: ''; width: 6px; height: 6px; background: var(--blue); }
  h1 { margin: 32px 0 28px; font-size: var(--display); line-height: 1.18; letter-spacing: -4px; font-weight: 550; }
  h1 span { color: var(--blue); }
  .description { max-width: 390px; color: var(--muted); font-size: 16px; line-height: 1.9; margin: 0; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 28px; margin-top: 36px; }
  .button { display: inline-flex; align-items: center; justify-content: space-between; gap: 36px; padding: 17px 22px; border: .5px solid var(--line); border-radius: 4px; font-size: 16px; transition: background var(--motion), transform var(--motion); }
  .button span, .text-link span, .nav-play span { display: inline-block; transition: transform var(--motion); }
  .button:hover span, .text-link:hover span, .nav-play:hover span { transform: translate(3px, -3px); }
  .button:active { transform: translateY(2px); }
  .primary { color: white; background: var(--blue); border-color: var(--blue); }
  .primary:hover { background: #1938e2; }
  .text-link { font-size: 12px; padding-block: 12px; transition: color var(--motion); }
  .text-link span { margin-left: 12px; }
  .note { margin-top: 16px; color: var(--muted); font-size: 12px; }
  .formats { display: flex; gap: 24px; margin-top: 48px; color: var(--muted); font: 12px ui-monospace, monospace; }
  .formats span + span { padding-left: 24px; border-left: .5px solid var(--line); }
  .specimen { position: relative; margin: 0; min-width: 0; padding: 40px 32px 32px; background: #eae9e2; border: .5px solid #d8d9cf; }
  .specimen::before, .specimen::after { content: '+'; position: absolute; font: 16px ui-monospace, monospace; color: #7f8377; }
  .specimen::before { top: -11px; left: -5px; }
  .specimen::after { right: -5px; bottom: -10px; }
  .specimen-label { position: absolute; top: 16px; left: 22px; color: var(--muted); letter-spacing: .5px; }
  .sheets { position: relative; padding: 32px 16px 16px; }
  .data-sheet { position: absolute; inset: 12px 30px 32px 4px; background: #f8f7f3; border: .5px solid #c9ccc1; transform: rotate(-6deg); padding: 20px; color: var(--muted); font: 12px/1.8 ui-monospace, monospace; transition: transform var(--slow-motion) cubic-bezier(.2,.7,.2,1); }
  .print { position: relative; background: #fffefa; padding: 24px; border: .5px solid #cecec4; box-shadow: 0 16px 30px -22px #34392760; transform: rotate(3deg); transition: transform var(--slow-motion) cubic-bezier(.2,.7,.2,1); }
  .edition { display: flex; justify-content: space-between; color: var(--muted); letter-spacing: 0; }
  .print-art { display: block; width: 100%; height: auto; margin: 24px auto; }
  .print-title { font-size: 24px; letter-spacing: -1px; line-height: 1.4; margin: 0 0 20px; font-weight: 500; }
  .proof { display: flex; justify-content: space-between; border-top: .5px solid var(--line); padding-top: 12px; color: var(--muted); letter-spacing: 0; }
  .output { display: flex; justify-content: space-between; margin-top: 28px; color: var(--muted); letter-spacing: 0; }
  .output span:last-child { color: var(--blue); }
  .process { padding: 32px 0 56px; border-top: .5px solid var(--line); }
  .section-label { display: flex; justify-content: space-between; color: var(--muted); font: 12px ui-monospace, monospace; margin-bottom: 36px; }
  .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
  .feature { padding-right: 28px; }
  .feature + .feature { border-left: .5px solid var(--line); padding-left: 40px; }
  .number { color: var(--blue); letter-spacing: 0; }
  h2 { margin: 18px 0 12px; font-size: 24px; letter-spacing: -.5px; font-weight: 500; }
  .features p { max-width: 340px; margin: 0; color: var(--muted); font-size: 16px; line-height: 1.8; }
  footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; border-top: .5px solid var(--line); padding-block: 24px; color: var(--muted); letter-spacing: 0; }
  .not-found { padding-block: 100px; }
  .error-code { color: var(--blue); font: 24px ui-monospace, monospace; }
  @media (hover: hover) { .specimen:hover .print { transform: rotate(0deg) translateY(-4px); } .specimen:hover .data-sheet { transform: rotate(-9deg) translate(-5px, -3px); } }
  @media (prefers-reduced-motion: no-preference) { .hero-copy, .specimen { animation: arrive 700ms cubic-bezier(.2,.7,.2,1) both; } .specimen { animation-delay: 100ms; } @keyframes arrive { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } } }
  @media (max-width: 1100px) { :root { --display: 56px; } header, footer, main { width: calc(100% - 64px); } .hero { gap: 40px; padding-block: 64px; } .specimen { padding-inline: 20px; } .print { padding: 20px; } h1 { letter-spacing: -3px; } .feature + .feature { padding-left: 28px; } }
  @media (max-width: 760px) { :root { --display: 48px; } header, footer, main { width: calc(100% - 40px); } header { min-height: 76px; } nav { gap: 22px; } .hero { grid-template-columns: 1fr; gap: 56px; padding-block: 48px; } h1 { margin-block: 24px; letter-spacing: -2.5px; } .description { max-width: 420px; } .formats { margin-top: 32px; } .specimen { width: 100%; max-width: 500px; justify-self: center; padding: 40px 28px 24px; } .features { grid-template-columns: 1fr; gap: 28px; } .feature, .feature + .feature { border-left: 0; padding: 0; } .feature + .feature { border-top: .5px solid var(--line); padding-top: 28px; } h2 { margin-block: 12px; } .features p { max-width: none; } .process { padding-bottom: 40px; } .section-label { gap: 16px; margin-bottom: 28px; } }
  @media (max-width: 380px) { :root { --display: 44px; } .nav-current { display: none; } .specimen { padding-inline: 12px; } .print { padding: 18px; } .actions { gap: 18px; } }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } :root { --motion: 0ms; --slow-motion: 0ms; } }
`;

export function pageResponse(page: 'home' | 'not-found', playground: boolean) {
  const home = page === 'home';
  const playgroundLink = '<a class="button primary" href="/dev">打开 Playground <span aria-hidden="true">↗</span></a>';
  const content = home
    ? `<section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow">A LITTLE STRUCTURE. A NEW FORM.</p>
          <h1 id="hero-title">让数据，<br>成为<span>图片。</span></h1>
          <p class="description">给内容一个清晰的形状。将 JSON 交给 Forma，让文字、动态与想法，成为值得分享的图片。</p>
          <div class="actions">${playgroundLink}<a class="text-link" href="#process">了解工作方式 <span aria-hidden="true">↓</span></a></div>
          ${playground ? '' : '<p class="note">当前实例未开放 Playground。</p>'}
          <div class="formats"><span>JSON → IMAGE</span><span>PNG / SVG</span></div>
        </div>
        <figure class="specimen" aria-label="从结构化数据到视觉作品的排版示意">
          <div class="specimen-label">FORMA / COMPOSITION STUDY</div>
          <div class="sheets">
            <div class="data-sheet" aria-hidden="true">{<br>&nbsp; "form": "possibility",<br>&nbsp; "content": "让想法成形"<br>}</div>
            <div class="print">
              <div class="edition"><span>FORM / 001</span><span>形的可能</span></div>
              <svg class="print-art" viewBox="0 0 360 250" fill="none" aria-hidden="true">
                <path d="M0 249.5H360M.5 0V250M359.5 0V250" stroke="#cdcec5" stroke-width=".5"/>
                <path d="M62 224V95C62 52 97 17 140 17H294V71H151C131 71 116 86 116 106V224H62Z" fill="#2b4aff"/>
                <path d="M135 224V120C135 103 148 90 165 90H294V144H204C196 144 189 151 189 159V224H135Z" fill="#2b4aff"/>
                <circle cx="267" cy="197" r="27" fill="#2b4aff"/>
                <path d="M0 71H360M0 144H360M116 0V250M189 0V250" stroke="#242722" stroke-opacity=".22" stroke-width=".5"/>
                <circle cx="116" cy="71" r="3" fill="#fffefa" stroke="#242722" stroke-width=".5"/>
                <circle cx="189" cy="144" r="3" fill="#fffefa" stroke="#242722" stroke-width=".5"/>
              </svg>
              <p class="print-title">有结构，也有表达。</p>
              <div class="proof"><span>Made of possibilities.</span><span>↗</span></div>
            </div>
          </div>
          <figcaption class="output"><span>从数据到画面</span><span>无限表达 ↗</span></figcaption>
        </figure>
      </section>
      <section class="process" id="process" aria-label="工作方式">
        <div class="section-label"><span>THE PROCESS</span><span>从一段数据，到一张好图片。</span></div>
        <div class="features">
          <div class="feature"><span class="number">01 / INPUT</span><h2>内容先行</h2><p>用 JSON 描述内容。文本、社交动态、文章与对比，都有合适的表达方式。</p></div>
          <div class="feature"><span class="number">02 / COMPOSE</span><h2>让排版自然发生</h2><p>选择模板，调整数据。在 Playground 中实时查看真正的图片输出。</p></div>
          <div class="feature"><span class="number">03 / SHARE</span><h2>准备好，被看见</h2><p>下载高清 PNG 或矢量 SVG，也可通过 HTTP API 接入你的应用。</p></div>
        </div>
      </section>`
    : `<p class="error-code" aria-hidden="true">404 / NOT FOUND</p>
      <h1>这个页面<br>还没有<span>成形。</span></h1>
      <p class="description">你访问的页面不存在，可能已被移动，或链接地址有误。</p>
      <div class="actions"><a class="button primary" href="/">返回首页 <span aria-hidden="true">←</span></a>${playground ? '<a class="text-link" href="/dev">打开 Playground <span aria-hidden="true">↗</span></a>' : ''}</div>`;
  return new Response(
    `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f5f3ee">
  <meta name="description" content="Forma 将 JSON 数据通过模板渲染为 PNG 或 SVG，提供 HTTP API 和在线 Playground。">
  ${home ? '' : '<meta name="robots" content="noindex">'}
  <title>${home ? 'Forma / 让数据成为图片' : '404 / 页面未找到 / Forma'}</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='4' fill='%232b4aff'/%3E%3Ctext x='10' y='25' fill='white' font-family='Georgia' font-style='italic' font-size='30'%3Ef%3C/text%3E%3C/svg%3E">
  <style>${styles}</style>
</head>
<body>
  <header><a class="brand" href="/" aria-label="Forma 首页"><span class="mark" aria-hidden="true">f</span>forma</a><nav aria-label="主导航"><a class="nav-current" href="/"${home ? ' aria-current="page"' : ''}>概览</a><a class="nav-play" href="/dev">Playground <span aria-hidden="true">↗</span></a></nav></header>
  <main${home ? '' : ' class="not-found"'}>${content}</main>
  <footer><span>forma / 让内容有形</span><span>STRUCTURED IN. BEAUTIFULLY OUT.</span></footer>
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
