# Mathify Notes — User guide (v1.5.0)

This is the full instruction book for the plugin. Use it to install, teach someone else, or decide if a conversion is a bug.

## 1. What it does

Mathify Notes watches the **current line** in the Obsidian editor. Type a known shorthand and press **Space**. That token becomes `$LaTeX$`.

It does **not** scan the whole vault. It does **not** touch:

- YAML frontmatter
- fenced code blocks
- inline code
- existing `$math$` or `$$math$$`
- URLs
- calendar dates such as `12/03/2026` or `2026/09/18`
- bare element-looking words (`He`, `As`, `US`, `CO`) unless you add a subscript, charge, or state

If something converted that should not have, wrap it in backticks or turn the matching setting off.

## 2. Install

Requirements: Obsidian 0.15.0+. Release **1.5.0** assets: `main.js`, `manifest.json`, `styles.css`.

### BRAT (recommended)

1. Community plugins → install **Obsidian42 - BRAT**
2. Enable BRAT
3. Command palette → **BRAT: Add a beta plugin for testing**
4. Paste `katananananna/obsidian-mathify-notes`
5. Enable **Mathify Notes**
6. Optional: BRAT → auto-update on startup

### Manual

Put the three files in:

```
<vault>/.obsidian/plugins/mathify-notes/
```

Reload Obsidian and enable the plugin.

### Community store

Updates go live only after the developer dashboard review row for that version says **Completed**. Hitting Check for new releases twice in a minute rate-limits you — wait.

## 3. Daily use

1. Type on a normal paragraph line (not inside a fence).
2. Type shorthand, then Space.
3. The token becomes `$…$`. Live Preview / Reading view renders it.

Manual: Command palette → **Convert math shorthand in current line**.

Already-wrapped `$math$` on that line is skipped so you do not double-wrap.

## 4. Chemistry

Setting **Chemistry formulas** must be on.

| Type | Meaning |
| :--- | :--- |
| `H2O` | water |
| `CO2` | carbon dioxide |
| `Ca(OH)2` | calcium hydroxide |
| `SO4^2-` or `SO42-` | sulfate |
| `NO3-` | nitrate |
| `Cu2+` | copper(II) |
| `CuSO4*5H2O` | hydrate (·) |
| `H2O(l)` `CO2(g)` `NaCl(s)` `HCl(aq)` | states |
| `H2 + O2 --> H2O` | reaction |

Need a digit, charge, parentheses, or state. `CO` stays `CO`. `CO2` converts. Prefer `SO4^2-` if `SO42-` looks wrong.

## 5. Math

| Type | Meaning |
| :--- | :--- |
| `1/2` | fraction |
| `1/2/3` | nested (short numbers only) |
| `dy/dx` `dT/dt` | derivative |
| `x^2` `x^y` | superscript |
| `x_i` `a_n` | subscript |
| `sqrt(x)` | square root |
| `root(3, x)` | nth root |
| `!=` `<=` `>=` `~~` `+-` | ≠ ≤ ≥ ≈ ± |
| `pi` `theta` `inf` `deg` `ohm` | π θ ∞ ° Ω |
| `log(x)` `sin(` `cos(` `tan(` | functions |
| `therefore` `subset` `member` `notin` | ∴ ⊂ ∈ ∉ |

**English logic words** are **off** by default: `because`, `union`, `intersect`, `cap`, `beta`.

Dates must stay dates. If `12/03/2026` becomes a fraction, that is a bug.

## 6. Arrows

`->` `-->` `<-` `<--` `<->` `=>` `==>` `<=>`

## 7. Settings

Settings → Mathify Notes

| Toggle | Default |
| :--- | :--- |
| Convert as you type | on |
| Chemistry formulas | on |
| English logic words | off |

## 8. Must not convert

```
Meeting on 12/03/2026
See https://github.com/katananananna/obsidian-mathify-notes
I said because I wanted to
He is here. As am I. US time. CO detector.
`H2O` and `1/2` stay code
```

Fenced code and YAML frontmatter also stay plain.

## 9. Troubleshooting

| Symptom | Fix |
| :--- | :--- |
| Nothing converts | Enabled? Live convert on? Not in a code block? |
| Chemistry skipped | Chemistry on? Need a digit/charge/state |
| `because` became a symbol | Turn English logic words off |
| Date became a fraction | Confirm 1.5.0; report the string |
| Double `$$` | Undo |
| BRAT old | Check release 1.5.0 has the three assets |
| Store not on 1.5.0 | Wait for Completed on the dashboard |

## 10. Release assets

Obsidian/BRAT only update when the GitHub Release tag matches `manifest.json` **and** the release has `main.js`, `manifest.json`, `styles.css` attached.

## 11. Test pack

Copy [docs/TEST.md](docs/TEST.md) into a new vault note and run it.

## 12. License

MIT. Katana — https://github.com/katananananna · https://x.com/InKatanaWeSlash
