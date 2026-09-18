# Mathify Notes — User guide (v1.5.0)

This is the full instruction book for the plugin.

## 1. What it does

Watches the current line. Type shorthand, press Space, get $LaTeX$. Does not scan the vault. Skips frontmatter, fenced code, inline code, existing math, URLs, dates, and bare words like He / As / US / CO.

## 2. Install

Obsidian 0.15.0+. Release 1.5.0 assets: main.js, manifest.json, styles.css.

BRAT: install Obsidian42-BRAT → Add beta plugin → katananananna/obsidian-mathify-notes → enable Mathify Notes.

Manual: put the three files in .obsidian/plugins/mathify-notes/ then reload.

Community store updates only after the dashboard review row is Completed.

## 3. Daily use

Type on a normal line. Space to convert. Or command: Convert math shorthand in current line.

## 4. Chemistry (setting on)

H2O, CO2, Ca(OH)2, SO4^2- or SO42-, NO3-, Cu2+, CuSO4*5H2O, H2O(l), H2 + O2 --> H2O.
Need a digit, charge, parentheses, or state. CO stays CO. CO2 converts.

## 5. Math

1/2, 1/2/3 (short numbers), dy/dx, x^2, x_i, sqrt(x), root(3, x), != <= >= ~~ +-, pi theta inf deg ohm, log(x) sin( cos( tan(, therefore subset member notin.

English logic words OFF by default: because union intersect cap beta.
Dates must stay dates: 12/03/2026, 1/1/2025, 2026/09/18.

## 6. Arrows

-> --> <- <-- <-> => ==> <=>

## 7. Settings

Convert as you type ON. Chemistry ON. English logic words OFF.

## 8. Must not convert

Dates, URLs, because (default), He As US CO, backtick code, fenced code, YAML frontmatter.

## 9. Troubleshooting

Nothing converts: plugin off, or inside code. Chemistry skipped: setting off or no digit. because became a symbol: turn English words off. Date became fraction: update to 1.5.0. BRAT old: check release 1.5.0 assets.

Full tables and the copy-paste vault test live in this repo: docs/TEST.md
