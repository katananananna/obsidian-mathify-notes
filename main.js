const { Plugin, MarkdownView } = require('obsidian');

const ELEMENTS = new Set([
    'H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar',
    'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn','Ga','Ge','As','Se','Br',
    'Kr','Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn','Sb','Te',
    'I','Xe','Cs','Ba','Pt','Au','Hg','Pb','Bi','U','W'
]);

module.exports = class MathShorthandPlugin extends Plugin {
    async onload() {
        console.log('Loading Mathify Notes: Smart IGCSE Shorthand Converter...');
        this.isConverting = false;

        this.addCommand({
            id: 'convert-shorthand-math',
            name: 'Convert math shorthand in current line',
            editorCallback: (editor) => {
                this.isConverting = true;
                this.convertMathInCurrentLine(editor);
                this.isConverting = false;
            }
        });

        // 1. Mobile-friendly, workspace-scoped editor event
        this.registerEvent(
            this.app.workspace.on('editor-change', (editor) => {
                if (this.isConverting) return;
                
                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line);
                
                // Only trigger if the character just typed is a space
                if (cursor.ch > 0 && lineText[cursor.ch - 1] === ' ') {
                    this.isConverting = true;
                    this.convertMathInCurrentLine(editor);
                    this.isConverting = false;
                }
            })
        );
    }

    convertMathInCurrentLine(editor) {
        const cursor = editor.getCursor();
        let lineText = editor.getLine(cursor.line);
        
        // 4. Safely splits on both inline ($...$) and display ($$...$$) math blocks
        const replaceOutsideMath = (text, regex, replacementFn) => {
            const segments = text.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
            let changed = false;
            for (let i = 0; i < segments.length; i++) {
                if (i % 2 === 0) { // Plain text segment
                    const original = segments[i];
                    // 5. Native replacer behavior
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
            { regex: /\b(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)\b/g, replacer: (m, n1, n2, n3) => `$\\frac{\\frac{${n1}}{${n2}}}{${n3}}$` },
            { regex: /\b(\d+)\s*\/\s*(\d+)\b/g, replacer: (m, n1, n2) => `$\\frac{${n1}}{${n2}}$` },
            { regex: /\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g, replacer: (m, v1, v2) => `$\\frac{${v1}}{${v2}}$` },
            { regex: /\b([a-zA-Z_]\w*)\s+\/\s+([a-zA-Z_]\w*)\b/g, replacer: (m, v1, v2) => `$\\frac{${v1}}{${v2}}$` },
            { regex: /\b(dy)\/(dx)\b/g, replacer: '$\\frac{dy}{dx}$' },
            { regex: /\broot\(([^,]+)\s*,\s*([^)]+)\)/g, replacer: (m, index, radicand) => `$\\sqrt[${index}]{${radicand}}$` },
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
            // 6. Smart Multiply: only targets 'x' between numbers
            { regex: /(\b\d+)\s+x\s+(\d+\b)/g, replacer: (m, n1, n2) => `${n1} $\\times$ ${n2}` },
            { regex: /\s+\*\s+/g, replacer: ' $\\times$ ' },
            { regex: /\s+div\s+/g, replacer: ' $\\div$ ' },
            { regex: /~~|\bapprox\b/g, replacer: '$\\approx$' },
            { regex: /!=/g, replacer: '$\\neq$' },
            { regex: /<=|=</g, replacer: '$\\leq$' },
            { regex: />=/g, replacer: '$\\geq$' },
            { regex: /\+-/g, replacer: '$\\pm$' },
            { regex: /-\+/g, replacer: '$\\mp$' },
            
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
            
            // --- CORE FUNCTIONS (Consolidated for performance) ---
            // Only converts trig/log if followed by space, parenthesis, or math block logic
            { regex: /\b(sin|cos|tan|log|ln|lim)\b(?=\s|\(|_|\^)/g, replacer: (m, func) => `$\\${func}$` },
            
            // --- CONSTANTS & GREEK LETTERS (Consolidated) ---
            { regex: /\b(pi|theta|lambda|alpha|beta|gamma|sigma|Sigma|phi|omega|delta|Delta)\b/g, replacer: (m, letter) => `$\\${letter}$` },
            { regex: /\bohm\b|\bOhm\b/g, replacer: '$\\Omega$' },
            { regex: /\bmicro\b/g, replacer: '$\\mu$' },
            { regex: /\bdeg\b/g, replacer: '$^\\circ$' },
            { regex: /\binfinity\b|\binf\b/g, replacer: '$\\infty$' },
            
            // --- LOGIC & SETS (Consolidated) ---
            { regex: /\b(therefore|because|subset|union|cup|intersect|cap)\b/g, replacer: (m, func) => `$\\${func}$` },
            { regex: /\bnotin\b/g, replacer: '$\\notin$' },
            { regex: /\bmember\b/g, replacer: '$\\in$' } // Changed from \bin\b to prevent English word mangling
        ];

        for (const rule of rules) {
            const result = replaceOutsideMath(currentText, rule.regex, rule.replacer);
            if (result.changed) {
                currentText = result.text;
                lineChanged = true;
            }
        }

        if (lineChanged) {
            // 7. Calculate coordinate offset to prevent cursor jump
            const originalLength = lineText.length;
            editor.setLine(cursor.line, currentText);
            editor.setCursor({ 
                line: cursor.line, 
                ch: cursor.ch + (currentText.length - originalLength) 
            });
        }
    }

    isChemFormula(word) {
        // Isolate states and charges early for accurate structure analysis
        const stateMatch = word.match(/\((aq|s|l|g)\)$/i);
        let core = word.replace(/\((aq|s|l|g)\)$/i, ''); 
        
        const chargeMatch = core.match(/\^?(?:\d*[+-]|[+-]\d*)$/);
        core = core.replace(/\^?(?:\d*[+-]|[+-]\d*)$/, ''); 

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

        // 3. Bulletproof collision fix: If it's just a single element with no numbers, 
        // charges, or states (e.g. He, As, In), leave it as plain English text.
        if (elementCount === 1 && !hasNumber && !chargeMatch && !stateMatch) {
            return false;
        }

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