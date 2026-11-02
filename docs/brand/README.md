# Slyyce brand assets

Vector sources for the logo, app icon and banner, using the app's colour tokens and Rajdhani Bold (`apps/web/public/font/Rajdhani-Bold.ttf`).

- `logo.html`: logo with wordmark (default), or the mark only with `?mode=mark` (the app icon)
- `banner.html`: 1500×500 banner
- `parts.js`: shared shapes (sliced watermelon, citrus, droplets)

Render with Playwright, after copying `Rajdhani-Bold.ttf` next to these files:

```bash
node docs/brand/render.mjs <path-to-playwright/index.mjs> "$PWD/docs/brand/logo.html" out.png '?mode=mark'
SCALE=2 node docs/brand/render.mjs <path-to-playwright/index.mjs> "$PWD/docs/brand/logo.html" logo@2x.png
```

App icons in `apps/web/public/icons/`:
- `icon-512.png`: mark at 1×
- `icon-192.png`: mark, resized
- `apple-touch-icon.png`: 180 px
- `pwa-icon.png`: mark at 2×
- `web-logo.png`: full logo at 2×
