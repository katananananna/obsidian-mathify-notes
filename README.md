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

### Community plugins (if listed)

Obsidian reads the latest `manifest.json` on GitHub, then downloads `main.js` + `manifest.json` + `styles.css` from the GitHub **release** whose tag matches that version.

1. After 1.5.0 is released, use **Settings → Community plugins → Check for updates**.
2. Manual installs should replace files from the latest GitHub release.

### Manual / BRAT

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest GitHub release](https://github.com/katananananna/obsidian-mathify-notes/releases).
2. Put them in `.obsidian/plugins/mathify-notes/`.
3. Enable the plugin.

## License

MIT. See [LICENSE](LICENSE).
