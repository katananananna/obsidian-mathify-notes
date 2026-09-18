# Mathify Notes

Type common plain-text shortcuts in Obsidian, press **Space** (or run the command), and they become LaTeX math / chemistry.

Version **1.5.0** focuses on not destroying normal notes: dates, URLs, inline code, fenced code, frontmatter, and everyday English stay untouched.

## What you type

### Chemistry

| Type | Result |
| :--- | :--- |
| `H2O` | H₂O |
| `Ca(OH)2` | Ca(OH)₂ |
| `SO4^2-` or `SO42-` | SO₄²⁻ |
| `NO3-` | NO₃⁻ |
| `Cu2+` | Cu²⁺ |
| `CuSO4*5H2O` | CuSO₄ · 5H₂O |
| `H2O(l)` | H₂O(l) |
| `H2 + O2 --> H2O` | H₂ + O₂ ⟶ H₂O |

Bare words that look like elements (`He`, `As`, `US`, `CO`) are left alone. Use a subscript, charge, or state if you mean chemistry (`CO2`, `He2`, `CO(g)`).

### Math

| Type | Result |
| :--- | :--- |
| `1/2` | ½ |
| `1/2/3` | nested fraction (only short numbers, so dates like `12/03/2026` stay dates) |
| `dy/dx` | dy/dx |
| `x^y` | xʸ |
| `x_i` | xᵢ |
| `sqrt(x)` | √x |
| `root(3, x)` | ³√x |
| `!=` `<=` `>=` `~~` `+-` | ≠ ≤ ≥ ≈ ± |
| `pi` `theta` `inf` `deg` `ohm` | π θ ∞ ° Ω |
| `log(x)` `sin(` | log / sin functions (`log` as a normal word is not converted) |
| `therefore` `subset` `member` `notin` | ∴ ⊂ ∈ ∉ |

`because`, `union`, `intersect`, `cap`, and `beta` are **off** unless you enable **English logic words** in settings.

### Arrows

`->` `-->` `<-` `<--` `<->` `<=>` `=>` `==>`

## Settings

Open **Settings → Mathify Notes**:

- Convert as you type
- Chemistry formulas
- English logic words

Command palette: **Convert math shorthand in current line**.

## Install / update

Release **1.5.0** includes the three files Obsidian needs: `main.js`, `manifest.json`, `styles.css`.

### BRAT (recommended until listed in Community plugins)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. BRAT → **Add Beta plugin** → `katananananna/obsidian-mathify-notes`.
3. Enable **Mathify Notes**.
4. Later: BRAT → **Check for updates** (or enable auto-update).

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [1.5.0 release](https://github.com/katananananna/obsidian-mathify-notes/releases/tag/1.5.0).
2. Put them in `.obsidian/plugins/mathify-notes/`.
3. Reload Obsidian and enable the plugin.

Official Community plugins listing is a separate review by Obsidian. Until then, BRAT or a manual copy is how the vault updates.

## License

MIT. See [LICENSE](LICENSE).
