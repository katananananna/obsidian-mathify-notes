# Mathify Notes 🧪✨

Mathify Notes is an incredibly intuitive shorthand auto-converter for Obsidian. Simply type math shortcuts, chemical formulas, reactions, or mathematical structures in plain text, press space (or trigger the conversion command), and watch them convert into beautifully formatted LaTeX notation instantly.

---

## 🚀 Interactive Cheat Sheet & Showcase

### 1. Chemical Formulas & Reactions
Our smart chemistry engine distinguishes plain words from elements and handles charges, subscripts, and state symbols automatically.

| Raw Shorthand | What Mathify Outputs (LaTeX) | Visual Result | Notes / Structure |
| :--- | :--- | :--- | :--- |
| `H2O` | `\text{H}_2\text{O}` | **H₂O** | Simple subscript auto-pairing |
| `SO42+` | `\text{SO}_{4}^{2+}` | **SO₄²⁺** | Polyatomic cation |
| `Cr2O72-` | `\text{Cr}_2\text{O}_7^{2-}` | **Cr₂O₇²⁻** | Deep subscripts + anionic charges |
| `Ca(OH)2` | `\text{Ca(OH)}_2` | **Ca(OH)₂** | Nested compound brackets |
| `[Co(NH3)6]Cl3` | `\text{[Co(NH}_3\text{)}_6\text{]Cl}_3` | **[Co(NH₃)₆]Cl₃** | Complex coordination compound |
| `CuSO4*5H2O` | `\text{CuSO}_4 \cdot 5\text{H}_2\text{O}` | **CuSO₄ · 5H₂O** | Hydration state using `*` spacing |
| `Fe^3+` | `\text{Fe}^{3+}` | **Fe³⁺** | Explicit caret charge mapping |
| `H2O(l)` | `\text{H}_2\text{O}\text{(l)}` | **H₂O(l)** | State of matter detection |
| `H2 + O2 --> H2O` | `\text{H}_2 \text{ + } \text{O}_2 \longrightarrow \text{H}_2\text{O}` | **H₂ + O₂ ⟶ H₂O** | Full chemical reaction mapping |

### 2. Math & Logic Shorthand

| Raw Shorthand | What Mathify Outputs (LaTeX) | Visual Result | Shorthand Meaning |
| :--- | :--- | :--- | :--- |
| `1/2` | `\frac{1}{2}` | **½** | Basic Fractions |
| `dy/dx` | `\frac{dy}{dx}` | **dy/dx** | Calculus derivatives |
| `sqrt(x)` | `\sqrt{x}` | **√x** | Roots |
| `root(3, x)` | `\sqrt[3]{x}` | **³√x** | N-th Root |
| `x^y` | `x^y` | **xʸ** | Powers / Superscripts |
| `x_i` | `x_i` | **xᵢ** | Subscripts |

### 3. Quick-type Operators & Greek Letters

* **Symbols:** `pi` → **π** | `theta` → **θ** | `lambda` → **λ** | `ohm` → **Ω** | `micro` → **μ** | `deg` → **°** | `inf` → **∞**
* **Comparisons:** `!=` → **≠** | `<=` → **≤** | `>=` → **≥** | `approx` → **≈**
* **Arrows:** `->` → **→** | `-->` → **⟶** | `<=>` → **⇌** | `=>` → **⇒**

---

## 🛠️ Installation

### Official Store (Once approved)
1. Inside **Obsidian**, head to **Settings** > **Community plugins**.
2. Turn off **Safe mode**.
3. Click **Browse** and search for `Mathify Notes`.
4. Click **Install**, then select **Enable**.

### Quick Manual Install (Beta)
1. Download `main.js`, `manifest.json`, and `styles.css` from our latest release.
2. Move them into your Obsidian vault directory under `.obsidian/plugins/mathify-notes/`.
3. Open Obsidian settings and enable the plugin.

---

## 📜 License
This project is licensed under the [MIT License](LICENSE) - open-source, fast, and free to modify.
