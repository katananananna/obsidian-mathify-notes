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
        console.log('Loading Mathify Notes: Smart IGCSE Shorthand Converter...');

        this.addCommand({
            id: 'convert-shorthand-math',
            name: 'Convert math shorthand in current line',
            editorCallback: (editor) => this.convertMathInCurrentLine(editor)
        });

        // Event listener: triggers the conversion when Spacebar is pressed
        this.registerDomEvent(document, 'keydown', (evt) => {
            if (evt.key === ' ') {
                const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
                // Safety check: Only trigger if the user is actively typing in the editor
                if (activeView && activeView.editor.hasFocus()) {
                    this.convertMathInCurrentLine(activeView.editor);
                }
            }
        });
    }

    convertMathInCurrentLine(editor) {
        const cursor = editor.getCursor();
        let lineText = editor.getLine(cursor.line);
        
        // Safety Splitter: Only converts patterns outside of existing LaTeX math blocks ($...$)
        const replaceOutsideMath = (text, regex, replacementFn) => {
            const segments = text.split(/(\$[^\$]+\$)/g);
            let changed = false;
            for (let i = 0; i < segments.length; i++) {
                if (i % 2 === 0) { // Plain text segment
                    const original = segments[i];
                    // Handle both string and function replacers safely
                    const replaced = typeof replacementFn === 'string' 
                        ? original.replace(regex, replacementFn) 
                        : original.replace(regex, replacementFn);
                        
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
            // 1. Triple Fractions: "2/3/4"
            { regex: /\b(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\b/g, replacer: (m, n1, n2, n3) => `$\\frac{\\frac{${n1}}{${n2}}}{${n3}}$` },
            // 2. Double Numeric Fractions: "2/3"
            { regex: /\b(\d+)\s*\/\s*(\d+)\b/g, replacer: (m, n1, n2) => `$\\frac{${n1}}{${n2}}$` },
            // 3. Simple Single-Variable Fractions: "y/x"
            { regex: /\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g, replacer: (m, v1, v2) => `$\\frac{${v1}}{${v2}}$` },
            // 4. Word-based formula Fractions: "mass / volume"
            { regex: /\b([a-zA-Z_]\w*)\s+\/\s+([a-zA-Z_]\w*)\b/g, replacer: (m, v1, v2) => `$\\frac{${v1}}{${v2}}$` },
            // 5. Calculus Derivative Fraction
            { regex: /\b(dy)\/(dx)\b/g, replacer: '$\\frac{dy}{dx}$' },
            // 6. Root functions: "root(3, 27)"
            { regex: /\broot\(([^,]+)\s*,\s*([^)]+)\)/g, replacer: (m, index, radicand) => `$\\sqrt[${index}]{${radicand}}$` },
            // 7. Square Roots: "sqrt(x^2 + y)"
            { regex: /\bsqrt\(([^)]+)\)/g, replacer: (m, contents) => `$\\sqrt{${contents}}$` },
            
            // --- ARROWS & REACTIONS ---
            { regex: /<=>/g, replacer: '$\\rightleftharpoons$' },
            { regex: /<—>|<==>/g, replacer: '$\\longleftrightarrow$' },
            { regex: /<->/g, replacer: '$\\leftrightarrow$' },
            { regex: /-->|—>/g, replacer: '$\\longrightarrow$' },
            { regex: /->/g, replacer: '$\\rightarrow$' },
            { regex: /<--/g, replacer: '$\\longleftarrow$' },
            { regex: /<-/g, replacer: '$\\leftarrow$' },
            { regex: /==>/g, replacer: '$\\Longrightarrow$' },
            { regex: /=>/g, replacer: '$\\Rightarrow$' },
            
            // --- MATH & LOGIC OPERATORS ---
            { regex: /\b(propto|prop)\b/g, replacer: '$\\propto$' },
            { regex: /\s+(\*|x)\s+/g, replacer: ' $\\times$ ' },
            { regex: /\s+div\s+/g, replacer: ' $\\div$ ' },
            { regex: /~~|\bapprox\b/g, replacer: '$\\approx$' },
            { regex: /!=/g, replacer: '$\\neq$' },
            { regex: /<=|=</g, replacer: '$\\leq$' }, // Catches both <= and =<
            { regex: />=/g, replacer: '$\\geq$' },
            { regex: /\+-/g, replacer: '$\\pm$' },
            { regex: /-\+/g, replacer: '$\\mp$' }, // Minus-plus
            
            // --- CHEMISTRY PARSER ---
            {
                regex: /\b([A-Z][A-Za-z0-9()\[\]*·•.+-]*)\b/g,
                replacer: (match) => {
                    if (this.isChemFormula(match)) return this.formatChemFormula(match);
                    return match;
                }
            },
            
            // --- PHYSICS & ALGEBRA ---
            { regex: /\b([a-zA-Z0-9]+)\^([a-zA-Z0-9\-]+)\b/g, replacer: (m, base, exp) => `$${base}^${exp.length > 1 ? `{${exp}}` : exp}$` },
            { regex: /\b([a-zA-Z])_([a-zA-Z0-9]{1,3})\b/g, replacer: (m, base, sub) => `$${base}_${sub.length > 1 ? `{${sub}}` : sub}$` },
            
            // --- CORE FUNCTIONS & CONSTANTS ---
            { regex: /\bsin\b/g, replacer: '$\\sin$' },
            { regex: /\bcos\b/g, replacer: '$\\cos$' },
            { regex: /\btan\b/g, replacer: '$\\tan$' },
            { regex: /\blog\b/g, replacer: '$\\log$' },
            { regex: /\bln\b/g, replacer: '$\\ln$' },
            { regex: /\blim\b/g, replacer: '$\\lim$' },
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
            
            // --- LOGIC & SETS ---
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

    isChemFormula(word) {
        if (/^(Step|Fig|Figure|Table|Part|Page|Section|Question|Task|Ex|Example|Year|Grade|Level|Class|Room|Group|Note|No)\d*$/i.test(word)) return false;
        if (word.length === 1 && !ELEMENTS.has(word)) return false;

        let core = word.replace(/\^?(?:\d*[+-]|[+-]\d*)$/, ''); 
        core = core.replace(/\((aq|s|l|g)\)$/i, ''); 

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

        const ambiguous = ['in', 'as', 'be', 'no', 'at', 'so', 'he'];
        if (ambiguous.includes(word.toLowerCase()) && elementCount === 1 && !hasNumber) return false;
        if (elementCount === 1 && !hasNumber && word.length === 1) return false;

        return hasElement;
    }

    formatChemFormula(word) {
        let stateOfMatter = '';
        const stateMatch = word.match(/\((aq|s|l|g)\)$/i);
        if (stateMatch) {
            stateOfMatter = `\\text{(${stateMatch[1].toLowerCase()})}`;
            word = word.slice(0, -stateMatch[0].length);
        }

        let charge = '';
        const chargeMatch = word.match(/\^?(\d*[+-]|[+-]\d*)$/);
        if (chargeMatch) {
            charge = `^{${chargeMatch[1]}}`;
            word = word.slice(0, -chargeMatch[0].length);
        }

        const hydrateParts = word.split(/[*·•.]/);
        if (hydrateParts.length > 1) {
            const formattedParts = hydrateParts.map((part, index) => {
                if (index === 0) return this.formatCoreChem(part);
                const coeffMatch = part.match(/^(\d+)(.*)$/);
                return coeffMatch ? `${coeffMatch[1]}${this.formatCoreChem(coeffMatch[2])}` : this.formatCoreChem(part);
            });
            return `$${formattedParts.join(' \\cdot ')}${charge}${stateOfMatter}$`;
        }

        return `$${this.formatCoreChem(word)}${charge}${stateOfMatter}$`;
    }

    formatCoreChem(core) {
        let coefficient = '';
        const coeffMatch = core.match(/^(\d+)(.*)$/);
        if (coeffMatch && coeffMatch[2].length > 0) {
            coefficient = coeffMatch[1];
            core = coeffMatch[2];
        }

        const tokens = core.split(/(\d+|[()\[\]])/);
        const formattedTokens = tokens.map(token => {
            if (!token) return '';
            return /^\d+$/.test(token) ? `_{${token}}` : `\\text{${token}}`;
        });

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
}