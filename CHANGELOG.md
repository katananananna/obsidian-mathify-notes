# Changelog

## 1.6.0

Chemistry is a real parser now, not a single greedy regex.

- Complexes keep their brackets inside math: `(NaCl)2`, `[Cu(NH3)4]2+`
- Charges work in every common style: `Fe3+`, `Fe^3+`, `SO42-`, `SO4^2-`, `(NaCl)2 2+`
- After `)` or `]`, `2+` is a charge, never a subscript
- `H2 + O2 -> H2O` is a reaction, not H2+ and O2-
- `e-` becomes an electron
- `sin(x)` keeps the parentheses
- `cup` / `member` / `subset` only convert if English logic words are on
- Dates, ISO acronyms, IME, fences, comments still protected
- Commands: selection, whole note, undo last convert
