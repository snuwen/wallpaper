# Gradient Wallpaper Studio

Standalone tool for generating high-resolution animated-gradient wallpapers
as PNGs, extracted from the WebGL gradient background used in TimerV1.

## Features

- Same WebGL mesh-gradient technique as the TimerV1 stream widget (4
  configurable colors, animated noise).
- Layout presets: phone (9:16, 1080×1920), desktop (16:9, 1920×1080),
  desktop 4K (3840×2160), or a fully custom width/height.
- High-quality PNG export, independent from screen resolution.

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

Just open `index.html` in a browser (or serve the folder statically — no
build step, no dependencies). Pick a layout, tweak colors, hit **PNG olarak
dışa aktar**.

## Files

- `gradient-engine.js` — WebGL gradient renderer (MiniGl + mesh-gradient
  shaders), with resolution/mesh-density controls added for export quality.
- `app.js` — UI wiring: presets, custom size, colors, export.
- `index.html`, `style.css` — the interface.

## Credits

The underlying WebGL gradient technique (noise-displaced mesh gradient) is
adapted from Stripe's open-source gradient implementation, as previously
integrated into TimerV1.
