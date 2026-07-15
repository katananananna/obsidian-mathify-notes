const { Plugin } = require('obsidian');

// Supported chemical elements for smart validation
const ELEMENTS = new Set([
    'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
    'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br',
    'Kr','Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te',
    'I','Xe','Cs','Ba','Pt','Au','Hg','Pb','Bi','U','W'
]);

module.exports = class MathShorthandPlugin extends Plugin {
    async onload() {
        console.log('Loading Mathify Notes: Smart Shorthand Converter...');
        this.isConverting = false;

        this.addCommand({
            id: 'convert-shorthand-math',
            name: 'Convert math shorthand in current line',
            editorCallback: (editor) => {
                this.isConverting = true;
                try {
                    this.convertMathInCurrentLine(editor);
                } finally {
                    this.isConverting = false;
                }
            }
        });

        // Scoped to editor, mobile-friendly, guards re-entrancy with try/finally
        this.registerEvent(
            this.app.workspace.on('editor-change', (editor) => {
                if (this.isConverting) return;

                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line);

                if (cursor.ch > 0 && lineText[cursor.ch - 1] === ' ') {
                    this.isConverting = true;
                    try {
                        this.convertMathInCurrentLine(editor);
                    } finally {
                        this.isConverting = false;
                    }
                }
            })
        );
    }

    convertMathInCurrentLine(editor) {
        const cursor = editor.getCursor();
        const lineText = editor.getLine(cursor.line);

        // FIX 1: Real pipe | characters (not \vert{} corruption).
        // Splits line into [plain, $math$, plain, $$math$$, plain, ...] segments
        // so rules only fire on plain-text segments and never corrupt existing LaTeX.
        const replaceOutsideMath = (text, regex, replacementFn) => {
            const segments = text.split(/(\$\$[^$]*\$\$|\$[^$]*\$)/g);
            let changed = false;
            for (let i = 0; i < segments.length; i++) {
                if (i % 2 === 0) {
                    const original = segments[i];
                    const replaced = original.replace(regex, replacementFn);
                    if (replaced !== original) {
                        segments[i] = replaced;
                        changed = true;
                    }
                }
            }
            return { text: segments.join(''), changed };
        };

        let currentText = lineText;
        let lineChanged = false;

        const rules = [
            // --- FRACTIONS & ROOTS ---
            // Triple fraction must come before double to avoid partial match
            { regex: /\b(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\b/g,
              replacer: (m, n1, n2, n3) => `$\\frac{\\frac{${n1}}{${n2}}}{${n3}}$` },
            { regex: /\b(\d+)\s*\/\s*(\d+)\b/g,
              replacer: (m, n1, n2) => `$\\frac{${n1}}{${n2}}$` },
            { regex: /\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g,
              replacer: (m, v1, v2) => `$\\frac{${v1}}{${v2}}$` },
            { regex: /\b([a-zA-Z_]\w*)\s+\/\s+([a-zA-Z_]\w*)\b/g,
              replacer: (m, v1, v2) => `$\\frac{${v1}}{${v2}}$` },
            { regex: /\b(dy)\/(dx)\b/g,
              replacer: '$\\frac{dy}{dx}$' },
            { regex: /\broot\(([^,]+)\s*,\s*([^)]+)\)/g,
              replacer: (m, index, radicand) => `$\\sqrt[${index}]{${radicand}}$` },
            { regex: /\bsqrt\(([^)]+)\)/g,
              replacer: (m, contents) => `$\\sqrt{${contents}}$` },

            // --- ARROWS & REACTIONS ---
            // Longest patterns first to prevent partial matches
            { regex: /<=>/g,        replacer: '$\\rightleftharpoons$' },
            { regex: /<—>|<==>/g,   replacer: '$\\longleftrightarrow$' },
            { regex: /<->/g,        replacer: '$\\leftrightarrow$' },
            { regex: /-->|—>/g,     replacer: '$\\longrightarrow$' },
            { regex: /->/g,         replacer: '$\\rightarrow$' },
            { regex: /<--/g,        replacer: '$\\longleftarrow$' },
            { regex: /<-/g,         replacer: '$\\leftarrow$' }, // FIX 4: was \leftleftarrow
            { regex: /==>/g,        replacer: '$\\Longrightarrow$' },
            { regex: /=>/g,         replacer: '$\\Rightarrow$' },

            // --- MATH & LOGIC OPERATORS ---
            { regex: /\bpropto\b/g,  replacer: '$\\propto$' },
            // Smart multiply: only between two numbers to avoid clobbering variable names
            { regex: /(\b\d+)\s+x\s+(\d+\b)/g,
              replacer: (m, n1, n2) => `${n1} $\\times$ ${n2}` },
            { regex: /\s+\*\s+/g,   replacer: ' $\\times$ ' },
            { regex: /\s+div\s+/g,  replacer: ' $\\div$ ' },
            { regex: /~~|\bapprox\b/g, replacer: '$\\approx$' },
            { regex: /!=/g,         replacer: '$\\neq$' },
            { regex: /<=|=</g,      replacer: '$\\leq$' },
            { regex: />=/g,         replacer: '$\\geq$' },
            { regex: /\+-/g,        replacer: '$\\pm$' },
            { regex: /-\+/g,        replacer: '$\\mp$' },

            // --- CHEMISTRY PARSER ---
            // FIX 2 & 3: Use lookahead/lookbehind instead of \b so trailing +/- are
            // captured as part of the formula. ^ added to char class so Fe^3+ is
            // captured whole, not split at the caret.
            {
                regex: /(?<![A-Za-z])([A-Z0-9][A-Za-z0-9()\[\]*·•.^+-]*)(?![A-Za-z0-9])/g,
                replacer: (match) => {
                    if (this.isChemFormula(match)) return this.formatChemFormula(match);
                    return match;
                }
            },

            // --- PHYSICS & ALGEBRA ---
            { regex: /\b([a-zA-Z0-9]+)\^([a-zA-Z0-9-]+)\b/g,
              replacer: (m, base, exp) => `$${base}^{${exp}}$` },
            { regex: /\b([a-zA-Z])_([a-zA-Z0-9]+)\b/g,
              replacer: (m, base, sub) => `$${base}_{${sub}}$` },

            // --- CORE FUNCTIONS ---
            // Lookahead ensures we only fire inside a math expression context
            { regex: /\b(sin|cos|tan|log|ln|lim)\b(?=\s|\(|_|\^)/g,
              replacer: (m, func) => `$\\${func}$` },

            // --- CONSTANTS & GREEK LETTERS ---
            { regex: /\b(pi|theta|lambda|alpha|beta|gamma|sigma|Sigma|phi|omega|delta|Delta)\b/g,
              replacer: (m, letter) => `$\\${letter}$` },
            { regex: /\bohm\b|\bOhm\b/g,      replacer: '$\\Omega$' },
            { regex: /\bmicro\b/g,             replacer: '$\\mu$' },
            { regex: /\bdeg\b/g,               replacer: '$^\\circ$' },
            { regex: /\binfinity\b|\binf\b/g,  replacer: '$\\infty$' },

            // --- LOGIC & SETS ---
            { regex: /\b(therefore|because|subset|union|cup|intersect|cap)\b/g,
              replacer: (m, func) => `$\\${func}$` },
            { regex: /\bnotin\b/g,  replacer: '$\\notin$' },
            // 'member' only (not \bin\b) to avoid mangling common English word "in"
            { regex: /\bmember\b/g, replacer: '$\\in$' }
        ];

        for (const rule of rules) {
            const result = replaceOutsideMath(currentText, rule.regex, rule.replacer);
            if (result.changed) {
                currentText = result.text;
                lineChanged = true;
            }
        }

        if (lineChanged) {
            editor.setLine(cursor.line, currentText);

            // Compute new cursor position by running rules on just the prefix
            // (text before the original cursor). This correctly handles cases
            // where the cursor is mid-line, not just at the end.
            let newPrefix = lineText.slice(0, cursor.ch);
            for (const rule of rules) {
                const result = replaceOutsideMath(newPrefix, rule.regex, rule.replacer);
                if (result.changed) {
                    newPrefix = result.text;
                }
            }

            editor.setCursor({
                line: cursor.line,
                ch: newPrefix.length
            });
        }
    }

    /**
     * Parses the trailing charge from a chemical formula string.
     *
     * Handles three cases in priority order:
     *   1. Explicit caret notation (unambiguous):  SO4^2-  Fe^3+  H^+
     *   2. Letter + digit(s) + sign (metal cations): Cu2+  Fe3+  Al3+
     *      - Single-element formulas: digit is charge magnitude
     *      - Polyatomic formulas: digit is subscript, only sign is charge
     *   3. Bare trailing sign: OH-  NH4+  NO3-  MnO4-
     *
     * Known limitation: polyatomic anions WITHOUT caret where the subscript
     * digit precedes the charge digit are ambiguous (SO42- vs SO4 2-).
     * Recommendation: use SO4^2- notation for unambiguous rendering.
     */
    parseCharge(word) {
        // 1. Explicit caret — always unambiguous
        let m = word.match(/\^(\d{0,2}[+-])$/);
        if (m) return { core: word.slice(0, -m[0].length), charge: m[1] };

        // 2. Letter immediately before digit+sign — distinguishes Cu2+ from NO3-
        m = word.match(/([A-Za-z])(\d{1,2})([+-])$/);
        if (m) {
            const elementMatches = word.match(/[A-Z][a-z]?/g);
            const elementCount = elementMatches ? elementMatches.length : 0;
            if (elementCount === 1) {
                // Single element (Cu, Fe, Al): digit is the charge magnitude
                return { core: word.slice(0, -(m[2].length + m[3].length)), charge: m[2] + m[3] };
            }
            // Polyatomic (NH4+, MnO4-): digit belongs to subscript, take only sign
            return { core: word.slice(0, -1), charge: m[3] };
        }

        // 3. Bare trailing sign
        m = word.match(/([+-])$/);
        if (m) return { core: word.slice(0, -1), charge: m[1] };

        return { core: word, charge: null };
    }

    isChemFormula(word) {
        // FIX 2: Real pipe characters in state regex (was \vert{} corruption)
        const stateMatch = word.match(/\((aq|s|l|g)\)$/i);
        let core = word.replace(/\((aq|s|l|g)\)$/i, '');

        const parseResult = this.parseCharge(core);
        core = parseResult.core;
        const charge = parseResult.charge;

        // Reject bare numbers and standalone operators
        if (/^\d+$/.test(core)) return false;

        // Strip stoichiometric coefficient (e.g. 2NaOH → NaOH)
        const coeffMatch = core.match(/^(\d+)(.*)$/);
        if (coeffMatch) {
            if (!coeffMatch[2]) return false; // pure number
            core = coeffMatch[2];
        }

        const tokens = core.split(/([A-Z][a-z]?|\d+|[()\[\]*·•.]|[^A-Za-z0-9()\[\]*·•.])/);

        let hasElement = false;
        let elementCount = 0;
        let hasNumber = false;

        for (const token of tokens) {
            if (!token) continue;
            if (/^[A-Z][a-z]?$/.test(token)) {
                if (!ELEMENTS.has(token)) return false;
                hasElement = true;
                elementCount++;
            } else if (/^\d+$/.test(token)) {
                hasNumber = true;
            } else if (!/^[()\[\]*·•.]$/.test(token)) {
                return false;
            }
        }

        // Single bare element (He, As, In, etc.) with no structural context
        // is almost certainly a plain English word — leave it alone
        if (elementCount === 1 && !hasNumber && !charge && !stateMatch) {
            return false;
        }

        return hasElement;
    }

    formatChemFormula(word) {
        // FIX 2: Real pipe characters in state regex (was \vert{} corruption)
        let stateOfMatter = '';
        const stateMatch = word.match(/\((aq|s|l|g)\)$/i);
        if (stateMatch) {
            stateOfMatter = `\\text{(${stateMatch[1].toLowerCase()})}`;
            word = word.slice(0, -stateMatch[0].length);
        }

        const parseResult = this.parseCharge(word);
        const charge = parseResult.charge ? `^{${parseResult.charge}}` : '';
        word = parseResult.core;

        // Handle hydrates: CuSO4·5H2O, Na2CO3·10H2O
        const hydrateParts = word.split(/[*·•.]/);
        if (hydrateParts.length > 1) {
            const formattedParts = hydrateParts.map((part, index) => {
                if (index === 0) return this.formatCoreChem(part);
                const cm = part.match(/^(\d+)(.*)$/);
                return cm ? `${cm[1]}${this.formatCoreChem(cm[2])}` : this.formatCoreChem(part);
            });
            return `$${formattedParts.join(' \\cdot ')}${charge}${stateOfMatter}$`;
        }

        return `$${this.formatCoreChem(word)}${charge}${stateOfMatter}$`;
    }

    formatCoreChem(core) {
        // Strip leading stoichiometric coefficient (kept as plain number, not subscript)
        let coefficient = '';
        const coeffMatch = core.match(/^(\d+)(.*)$/);
        if (coeffMatch && coeffMatch[2].length > 0) {
            coefficient = coeffMatch[1];
            core = coeffMatch[2];
        }

        // Split on digits and brackets, wrap element symbols in \text{}, digits in _{}
        const tokens = core.split(/(\d+|[()\[\]])/);
        const formattedTokens = tokens.map(token => {
            if (!token) return '';
            return /^\d+$/.test(token) ? `_{${token}}` : `\\text{${token}}`;
        });

        // Merge consecutive \text{} blocks to avoid \text{N}\text{a} → \text{Na}
        let combined = coefficient;
        let currentText = '';
        for (const tok of formattedTokens) {
            if (tok.startsWith('\\text{') && tok.endsWith('}')) {
                currentText += tok.slice(6, -1);
            } else {
                if (currentText) {
                    combined += `\\text{${currentText}}`;
                    currentText = '';
                }
                combined += tok;
            }
        }
        if (currentText) combined += `\\text{${currentText}}`;
        return combined;
    }

    onunload() {
        console.log('Unloading Mathify Notes...');
    }
};