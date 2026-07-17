# Static assets

Files here are served from the site root.

## Brand logo

Drop your logo image here as **`logo.png`** (or `logo.svg`):

    web/public/logo.png

It's picked up automatically by the header/footer logo badge. If the file is
absent, the app falls back to the built-in SVG mark (`components/Logo.tsx`).

Ideal: a square-ish icon (the feather/candlestick mark) works best in the small
header badge. The full lockup (icon + wordmark) is fine too — it's shown
`object-cover` in a rounded square.
