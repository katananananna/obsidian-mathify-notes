# Mathify Notes

**Version 1.5.0** — Obsidian plugin by [KATANA](https://github.com/katananananna)

Type plain-text math and chemistry shorthand. Press **Space** (or run the command). Get LaTeX. Dates, URLs, code, frontmatter, and normal English stay untouched.

Full guidebook: **[GUIDE.md](GUIDE.md)**  
Copy-paste test note: **[docs/TEST.md](docs/TEST.md)**  
Latest files: **[Release 1.5.0](https://github.com/katananananna/obsidian-mathify-notes/releases/tag/1.5.0)**

## 60-second install

### BRAT (easiest)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community plugins.
2. BRAT → **Add Beta plugin** → `katananananna/obsidian-mathify-notes`
3. Enable **Mathify Notes**.
4. Settings → Mathify Notes → leave **Convert as you type** and **Chemistry** on.

### Manual

1. Download `main.js`, `manifest.json`, `styles.css` from [1.5.0](https://github.com/katananananna/obsidian-mathify-notes/releases/tag/1.5.0).
2. Put them in `.obsidian/plugins/mathify-notes/`
3. Reload Obsidian → enable the plugin.

## What you type

| You type | You get |
| :--- | :--- |
| `H2O` `SO42-` `SO4^2-` `CuSO4*5H2O` | chemistry with subscripts / charges |
| `1/2` `x^2` `sqrt(x)` `dy/dx` | fractions, powers, roots, derivatives |
| `!=` `<=` `>=` `~~` `+-` `->` `=>` | ≠ ≤ ≥ ≈ ± arrows |
| `pi` `theta` `inf` | π θ ∞ |
| `12/03/2026` `because` `` `H2O` `` | **left alone** (dates, English, code) |

Command palette: **Convert math shorthand in current line**.

## Settings

Settings → Mathify Notes

- **Convert as you type** — on by default
- **Chemistry formulas** — on by default
- **English logic words** — **off** by default (`because`, `union`, `intersect`, `cap`, `beta`)

## License

MIT. See [LICENSE](LICENSE).
