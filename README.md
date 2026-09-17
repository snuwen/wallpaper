# Gradient Wallpaper Studio

Standalone tool for generating high-resolution animated-gradient wallpapers
as PNGs, extracted from the WebGL gradient background used in TimerV1.

## Features

- Same WebGL mesh-gradient technique as the TimerV1 stream widget (4
  configurable colors, animated noise).
- Layout presets: phone (9:16, 1080×1920 or 2160×3840), desktop (16:9,
  1920×1080 or 3840×2160), or a fully custom width/height.
- High-quality PNG export, independent from screen resolution.
- Animated HTML export: a single self-contained `.html` file with the
  current colors/pattern baked in, for use as an OBS (or any streaming
  software) Browser Source live animated background.

## Why the quality is better than the original widget

The original widget's canvas backing-store resolution was driven by
`window.innerWidth`/a fixed height, with no `devicePixelRatio` scaling and a
fixed, coarse mesh density. On HiDPI screens (and on any export) that meant
the gradient was rendered at a lower resolution than displayed, and colors
—computed per-vertex, then linearly interpolated across a coarse mesh—
showed visible triangle facets/banding in sharp transitions.

This tool fixes both:

- Every render target (preview and export) gets an explicit pixel
  resolution; nothing is silently upscaled from a lower-res buffer.
- Mesh density (`xSegCount`/`ySegCount`) scales with the actual render
  resolution instead of being fixed, removing facet banding.
- PNG export renders at 2×–4× the target resolution (supersampling) and
  downsamples with high-quality image smoothing, which further smooths any
  remaining aliasing at sharp gradient edges.

## Usage

Serve the folder statically (e.g. `python3 -m http.server`, or GitHub
Pages — no build step, no dependencies) and open `index.html`. A plain
`file://` open works for viewing/PNG export, but the animated-HTML export
button needs to `fetch()` `gradient-engine.js`, which browsers block for
`file://` pages — serve it over http(s) for that button to work.

Pick a layout, tweak colors, then either:

- **Export as PNG** — a static high-resolution snapshot of the current
  frame.
- **Export as animated HTML** — downloads a single `.html` file with the
  animation baked in (colors, seed, chosen size). Open it directly, or add
  it as an OBS **Browser Source** (Local File) for a live animated
  background — it resizes itself to fill whatever dimensions the source
  is given, while keeping the same wave scale/shape you designed.

## Files

- `gradient-engine.js` — WebGL gradient renderer (MiniGl + mesh-gradient
  shaders), with resolution/mesh-density controls added for export quality.
- `app.js` — UI wiring: presets, custom size, colors, export.
- `index.html`, `style.css` — the interface.

## Credits

The underlying WebGL gradient technique (noise-displaced mesh gradient) is
adapted from Stripe's open-source gradient implementation, as previously
integrated into TimerV1.
