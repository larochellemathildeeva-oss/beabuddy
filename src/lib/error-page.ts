export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 14px/1.5 "DM Sans", system-ui, -apple-system, sans-serif; background: #fff; color: #111; margin: 0; }
      header { height: 64px; display: flex; align-items: center; padding: 0 16px; }
      header a { color: inherit; text-decoration: none; font-weight: 700; font-size: 20px; }
      main { max-width: 480px; margin: 0 auto; padding: 12px 16px 40px; }
      .label { font-size: 12px; margin: 0; }
      h1 { font-size: 28px; line-height: 1.2; margin: 6px 0 0; padding-bottom: 12px; border-bottom: 1px solid #e5e5e5; }
      p.body { margin: 16px 0; }
      button { width: 100%; min-height: 52px; border: 0; border-radius: 8px; background: #111; color: #fff; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
      @media (prefers-color-scheme: dark) {
        body { background: #111; color: #f5f5f5; }
        h1 { border-color: #333; }
        button { background: #f5f5f5; color: #111; }
      }
    </style>
  </head>
  <body>
    <header><a href="/" aria-label="Béa, home">Béa</a></header>
    <main>
      <p class="label">Something went wrong</p>
      <h1>This page didn't load.</h1>
      <p class="body">Try again, or return to <a href="/">Home</a>.</p>
      <button onclick="location.reload()">Try again</button>
    </main>
  </body>
</html>`;
}
