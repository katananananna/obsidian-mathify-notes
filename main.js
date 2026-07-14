const { Plugin, MarkdownView } = require('obsidian');

// Supported chemical elements for smart validation
const ELEMENTS = new Set([
    'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
    'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br',
    'Kr','Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te',
    'I','Xe','Cs','Ba','Pt','Au','Hg','Pb','Bi','U','W'
]);

module.exports = class MathShorthandPlugin extends Plugin {
    async onload() {
        console.log('Loading Smart IGCSE Science & Math Shorthand Converter...');

        this.addCommand({
            id: 'convert-shorthand-math',
            name: 'Convert math shorthand in current line',
            editorCallback: (editor) => this.convertMathInCurrentLine(editor)
        });

        // Event listener: triggers the conversion when Spacebar is pressed
        this.registerDomEvent(document, 'keydown', (evt) => {
            if (evt.key === ' ') {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (activeView) {
                    this.convertMathInCurrentLine(activeView.editor);
                }
            }
        });
    }

    convertMathInCurrentLine(editor) {
        const cursor = editor.getCursor();
        let lineText = editor.getLine(cursor.line);
        
        // Safety Splitter: Only converts patterns that sit outside of existing LaTeX math blocks ($...$)
        const replaceOutsideMath = (text, regex, replacementFn) => {
            const segments = text.split(/(\$[^\$]+\$)/g);
            let changed = false;
            for (let i = 0; i < segments.length; i++) {
                if (i % 2 === 0) { // Plain text segment
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
            // 1. Triple Fractions: "2/3/4" -> "\frac{\frac{2}{3}}{4}"
            {
                regex: /\b(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\b/g,
                replacer: (match, n1, n2, n3) => `$\\frac{\\frac{${n1}}{${n2}}}{${n3}}$`
            },
            // 2. Double Numeric Fractions: "2/3" -> "\frac{2}{3}"
            {
                regex: /\b(\d+)\s*\/\s*(\d+)\b/g,
                replacer: (match, n1, n2) => `$\\frac{${n1}}{${n2}}$`
            },
            // 3. Simple Single-Variable Fractions: "y/x" or "d/t" -> "\frac{y}{x}"
            {
                regex: /\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g,
                replacer: (match, v1, v2) => `$\\frac{${v1}}{${v2}}$`
            },
            // 4. Word-based formula Fractions (demands spaces around "/"): "mass / volume" -> "\frac{mass}{volume}"
            {
                regex: /\b([a-zA-Z_]\w*)\s+\/\s+([a-zA-Z_]\w*)\b/g,
                replacer: (match, v1, v2) => `$\\frac{${v1}}{${v2}}$`
            },
            // 5. Calculus Derivative Fraction: "dy/dx" -> "\frac{dy}{dx}"
            {
                regex: /\b(dy)\/(dx)\b/g,
                replacer: '$\\frac{dy}{dx}$'
            },
            // 6. Root functions: "root(3, 27)" -> "\sqrt[3]{27}"
            {
                regex: /\broot\(([^,]+)\s*,\s*([^)]+)\)/g,
                replacer: (match, index, radicand) => `$\\sqrt[${index}]{${radicand}}$`
            },
            // 7. Square Roots: "sqrt(x^2 + y)" -> "\sqrt{x^2 + y}"
            {
                regex: /\bsqrt\(([^)]+)\)/g,
                replacer: (match, contents) => `$\\sqrt{${contents}}$`
            },
            // 8. Chemistry Reversible Reaction Arrow: "<=>" -> "\rightleftharpoons"
            {
                regex: /<=>/g,
                replacer: '$\\rightleftharpoons$'
            },
            // 9. Long Double-ended Arrow: "<—>" (em-dash) or "<==>" -> "\longleftrightarrow"
            {
                regex: /<—>|<==>/g,
                replacer: '$\\longleftrightarrow$'
            },
            // 10. Short Double-ended Process Arrow: "<->" -> "\leftrightarrow"
            {
                regex: /<->/g,
                replacer: '$\\leftrightarrow$'
            },
            // 11. Long Single-headed Reaction Arrow: "-->" or "—>" -> "\longrightarrow"
            {
                regex: /-->|—>/g,
                replacer: '$\\longrightarrow$'
            },
            // 12. Standard Reaction Arrow: "->" -> "\rightarrow"
            {
                regex: /->/g,
                replacer: '$\\rightarrow$'
            },
            // 13. Double Left Arrow: "<--" -> "\longleftarrow"
            {
                regex: /<--/g,
                replacer: '$\\longleftarrow$'
            },
            // 14. Standard Left Arrow: "<-" -> "\leftarrow"
            {
                regex: /<-/g,
                replacer: '$\\leftarrow$'
            },
            // 15. Implication Arrows: "==>" -> "\Longrightarrow", "=>" -> "\Rightarrow"
            { regex: /==>/g, replacer: '$\\Longrightarrow$' },
            { regex: /=>/g, replacer: '$\\Rightarrow$' },
            
            // 16. Proportionality: "propto" or "prop" -> "\propto"
            {
                regex: /\b(propto|prop)\b/g,
                replacer: '$\\propto$'
            },
            
            // 17. Intelligent Chemistry Formula Parser
            // Matches alphanumeric sequences starting with uppercase letters, including charges, brackets, and crystal dots.
            {
                regex: /\b([A-Z][A-Za-z0-9()\[\]*·•.+-]*)\b/g,
                replacer: (match) => {
                    if (this.isChemFormula(match)) {
                        return this.formatChemFormula(match);
                    }
                    return match;
                }
            },
            
            // 18. Physics Powers: "v^2" or "10^-3" -> "$v^2$", "$10^{-3}$"
            {
                regex: /\b([a-zA-Z0-9]+)\^([a-zA-Z0-9\-]+)\b/g,
                replacer: (match, base, exp) => {
                    const formattedExp = exp.length > 1 ? `{${exp}}` : exp;
                    return `$${base}^${formattedExp}$`;
                }
            },
            // 19. Subscripts: "v_i" or "E_gp" -> "$v_i$", "$E_{gp}$"
            {
                regex: /\b([a-zA-Z])_([a-zA-Z0-9]{1,3})\b/g,
                replacer: (match, base, sub) => {
                    const formattedSub = sub.length > 1 ? `{${sub}}` : sub;
                    return `$${base}_${formattedSub}$`;
                }
            },
            // 20. Standard Biology Genetics Cross / Physics Multiplication: " x " or " * " -> "\times"
            {
                regex: /\s+(\*|x)\s+/g,
                replacer: ' $\\times$ '
            },
            // 21. Standard division operator: " div " -> "\div"
            {
                regex: /\s+div\s+/g,
                replacer: ' $\\div$ '
            },
            // 22. Approximation operator: "~~" or "approx" -> "\approx"
            {
                regex: /~~|\bapprox\b/g,
                replacer: '$\\approx$'
            },
            // 23. Inequality operators: "!=" -> "\neq", "<=" -> "\leq", ">=" -> "\geq"
            { regex: /!=/g, replacer: '$\\neq$' },
            { regex: /<=/g, replacer: '$\\leq$' },
            { regex: />=/g, replacer: '$\\geq$' },
            // 24. Plus-Minus operator: "+-" -> "\pm"
            { regex: /\+-/g, replacer: '$\\pm$' },
            
            // 25. Core Math Functions (styled beautifully in upright Roman font)
            { regex: /\bsin\b/g, replacer: '$\\sin$' },
            { regex: /\bcos\b/g, replacer: '$\\cos$' },
            { regex: /\btan\b/g, replacer: '$\\tan$' },
            { regex: /\blog\b/g, replacer: '$\\log$' },
            { regex: /\bln\b/g, replacer: '$\\ln$' },
            { regex: /\blim\b/g, replacer: '$\\lim$' },
            
            // 26. Essential Greek Letters & Math constants
            { regex: /\bpi\b/g, replacer: '$\\pi$' },
            { regex: /\btheta\b/g, replacer: '$\\theta$' },
            { regex: /\blambda\b/g, replacer: '$\\lambda$' },
            { regex: /\balpha\b/g, replacer: '$\\alpha$' },
            { regex: /\bbeta\b/g, replacer: '$\\beta$' },
            { regex: /\bgamma\b/g, replacer: '$\\gamma$' },
            { regex: /\bsigma\b/g, replacer: '$\\sigma$' },
            { regex: /\bSigma\b/g, replacer: '$\\Sigma$' },
            { regex: /\bphi\b/g, replacer: '$\\phi$' },
            { regex: /\bomega\b/g, replacer: '$\\omega$' },
            { regex: /\bohm\b|\bOhm\b/g, replacer: '$\\Omega$' },
            { regex: /\bmicro\b/g, replacer: '$\\mu$' },
            { regex: /\bdeg\b/g, replacer: '$^\\circ$' },
            { regex: /\bdelta\b/g, replacer: '$\\delta$' },
            { regex: /\bDelta\b/g, replacer: '$\\Delta$' },
            { regex: /\binfinity\b|\binf\b/g, replacer: '$\\infty$' },
            
            // 27. Set Theory and Logical Connectives
            { regex: /\btherefore\b/g, replacer: '$\\therefore$' },
            { regex: /\bbecause\b/g, replacer: '$\\because$' },
            { regex: /\bmember\b|\bin\b/g, replacer: '$\\in$' },
            { regex: /\bnotin\b/g, replacer: '$\\notin$' },
            { regex: /\bsubset\b/g, replacer: '$\\subset$' },
            { regex: /\bunion\b|\bcup\b/g, replacer: '$\\cup$' },
            { regex: /\bintersect\b|\bcap\b/g, replacer: '$\\cap$' }
        ];

        // Execute processing sequence
        for (const rule of rules) {
            const result = replaceOutsideMath(currentText, rule.regex, rule.replacer);
            if (result.changed) {
                currentText = result.text;
                lineChanged = true;
            }
        }

        if (lineChanged) {
            editor.setLine(cursor.line, currentText);
        }
    }

    // Helper validation method
    isChemFormula(word) {
        // Exclude standard note-taking titles paired with numbers
        if (/^(Step|Fig|Figure|Table|Part|Page|Section|Question|Task|Ex|Example|Year|Grade|Level|Class|Room|Group|Note|No)\d*$/i.test(word)) {
            return false;
        }

        // Prevent treating standard single letters as shorthand math formulae (unless valid)
        if (word.length === 1 && !ELEMENTS.has(word)) {
            return false;
        }

        // Strip charges and state of matter at the end to evaluate the core chemical structure
        let core = word.replace(/\^?(?:\d*[+-]|[+-]\d*)$/, ''); 
        core = core.replace(/\((aq|s|l|g)\)$/i, ''); 

        // Tokenize into elements, numbers, brackets, and dots
        const tokens = core.split(/([A-Z][a-z]?|\d+|[()\[\]*·•.]|[^A-Za-z0-9()\[\]*·•.])/);
        
        let hasElement = false;
        let elementCount = 0;
        let hasNumber = false;

        for (const token of tokens) {
            if (!token) continue;
            if (/^[A-Z][a-z]?$/.test(token)) {
                if (!ELEMENTS.has(token)) {
                    return false; // contains non-chemical element letters
                }
                hasElement = true;
                elementCount++;
            } else if (/^\d+$/.test(token)) {
                hasNumber = true;
            } else if (/^[()\[\]*·•.]$/.test(token)) {
                // Ignore valid chemistry delimiters
            } else {
                return false; // encountered non-chemical formatting
            }
        }

        // Catch common ambiguous English words that look like elements
        if (word.toLowerCase() === 'in' || word.toLowerCase() === 'as' || word.toLowerCase() === 'be' || word.toLowerCase() === 'no' || word.toLowerCase() === 'at' || word.toLowerCase() === 'so') {
            if (elementCount === 1 && !hasNumber) {
                return false;
            }
        }

        // Single elements with no charge/numbers are left as normal text
        if (elementCount === 1 && !hasNumber) {
            if (word.length === 1) {
                return false; 
            }
            if (word === 'He' || word === 'Be' || word === 'In' || word === 'As' || word === 'At' || word === 'So') {
                return false;
            }
        }

        return hasElement;
    }

    // Formatter logic: translates verified strings into clean IUPAC upright chemical notation
    formatChemFormula(word) {
        // 1. Isolate and preserve states of matter: (aq), (g), (l), (s)
        let stateOfMatter = '';
        const stateMatch = word.match(/\((aq|s|l|g)\)$/i);
        if (stateMatch) {
            stateOfMatter = `\\text{(${stateMatch[1].toLowerCase()})}`;
            word = word.slice(0, -stateMatch[0].length);
        }

        // 2. Isolate and preserve trailing charges
        let charge = '';
        const chargeMatch = word.match(/\^?(\d*[+-]|[+-]\d*)$/);
        if (chargeMatch) {
            charge = `^{${chargeMatch[1]}}`;
            word = word.slice(0, -chargeMatch[0].length);
        }

        // 3. Handle dot markers for hydrates (e.g., CuSO4.5H2O)
        const hydrateParts = word.split(/[*·•.]/);
        if (hydrateParts.length > 1) {
            const formattedParts = hydrateParts.map((part, index) => {
                if (index === 0) {
                    return this.formatCoreChem(part);
                } else {
                    const coeffMatch = part.match(/^(\d+)(.*)$/);
                    if (coeffMatch) {
                        return `${coeffMatch[1]}${this.formatCoreChem(coeffMatch[2])}`;
                    }
                    return this.formatCoreChem(part);
                }
            });
            
            let result = formattedParts.join(' \\cdot ');
            if (charge) result += charge;
            if (stateOfMatter) result += stateOfMatter;
            return `$${result}$`;
        }

        let result = this.formatCoreChem(word);
        if (charge) result += charge;
        if (stateOfMatter) result += stateOfMatter;
        return `$${result}$`;
    }

    formatCoreChem(core) {
        let coefficient = '';
        const coeffMatch = core.match(/^(\d+)(.*)$/);
        if (coeffMatch && coeffMatch[2].length > 0) {
            coefficient = coeffMatch[1];
            core = coeffMatch[2];
        }

        const tokens = core.split(/(\d+|[()\[\]])/);
        const formattedTokens = tokens.map((token) => {
            if (!token) return '';
            if (/^\d+$/.test(token)) {
                return `_{${token}}`;
            } else {
                return `\\text{${token}}`;
            }
        });

        // Optimization step: merges adjacent \text{...} wrappers
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
        if (currentText) {
            combined += `\\text{${currentText}}`;
        }
        return combined;
    }

    onunload() {
        console.log('Unloading Smart IGCSE Science & Math Shorthand Converter...');
    }
}