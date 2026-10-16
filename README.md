# Motion Design — Sidan portfolio

A responsive portfolio landing page with a custom Newar-inspired gate and interactive brass-chain curtain, based on the supplied video and architectural references.

## Develop

Requires Node.js 20.19+ or 22.12+ (validated with Node 24).

```sh
npm ci
npm run dev
```

Move your pointer over the chains, or use the curtain button with touch/keyboard. Optional synthesized chimes are off by default. Reduced-motion preferences are respected.

## Verify

```sh
npm run build
npx playwright test
```

Browser tests use `/usr/bin/chromium` when available. On other machines, run `npx playwright install chromium` first, or set `CHROMIUM_EXECUTABLE_PATH`.

Before publishing, replace the draft biography and `hello@example.com` in `index.html` with your own details. No backend or secret values are required.

## Publish with GitHub Pages

In the repository, open **Settings → Pages** and select **GitHub Actions** as the source. The included workflow builds and deploys the portfolio on pushes to `main`; you can also run it from **Actions → Deploy portfolio to GitHub Pages → Run workflow**.

After a successful deployment, the site will be available at https://sidantap.github.io/Motion-Design/. The relative Vite asset base supports this project URL and custom domains.
