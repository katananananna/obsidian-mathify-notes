function buildRules(settings) {
	const rules = [
		{ regex: /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/g, replacer: (m, a, b, c) => `$\\frac{\\frac{${a}}{${b}}}{${c}}$` },
		{ regex: /\b(\d+)\s*\/\s*(\d+)\b(?!\s*\/)/g, replacer: (m, a, b) => (a.length === 4 || b.length === 4 ? m : `$\\frac{${a}}{${b}}$`) },
		{ regex: /\bdy\s*\/\s*dx\b/g, replacer: '$\\frac{dy}{dx}$' },
		{ regex: /\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g, replacer: (m, a, b) => `$\\frac{${a}}{${b}}$` },
		{ regex: /\b([a-zA-Z_]\w*)\s+\/\s+([a-zA-Z_]\w*)\b/g, replacer: (m, a, b) => `$\\frac{${a}}{${b}}$` },
		{ regex: /\broot\(([^,]+)\s*,\s*([^)]+)\)/g, replacer: (m, i, r) => `$\\sqrt[${i}]{${r}}$` },
		{ regex: /\bsqrt\(([^)]+)\)/g, replacer: (m, c) => `$\\sqrt{${c}}$` },
		{ regex: /<=>/g, replacer: '$\\rightleftharpoons$' },
		{ regex: /<->/g, replacer: '$\\leftrightarrow$' },
		{ regex: /-->/g, replacer: '$\\longrightarrow$' },
		{ regex: /(?<![\-\w])-?->/g, replacer: '$\\rightarrow$' },
		{ regex: /<--/g, replacer: '$\\longleftarrow$' },
		{ regex: /(?<![<\w])<-(?!-)/g, replacer: '$\\leftarrow$' },
		{ regex: /==>/g, replacer: '$\\Longrightarrow$' },
		{ regex: /(?<!=)=>/g, replacer: '$\\Rightarrow$' },
		{ regex: /\bpropto\b/g, replacer: '$\\propto$' },
		{ regex: /(\b\d+)\s+[xX]\s+(\d+\b)/g, replacer: (m, a, b) => `${a} $\\times$ ${b}` },
		{ regex: /(?<=\d)\s+\*\s+(?=\d)/g, replacer: ' $\\times$ ' },
		{ regex: /\s+div\s+/g, replacer: ' $\\div$ ' },
		{ regex: /~~|\bapprox\b/g, replacer: '$\\approx$' },
		{ regex: /!=/g, replacer: '$\\neq$' },
		{ regex: /<=|=</g, replacer: '$\\leq$' },
		{ regex: />=/g, replacer: '$\\geq$' },
		{ regex: /\+-/g, replacer: '$\\pm$' },
		{ regex: /-\+/g, replacer: '$\\mp$' }
	];
	if (settings.convertChemistry) {
		rules.push({ regex: /(?<![A-Za-z])([A-Z0-9][A-Za-z0-9()\[\]*·•.^+-]*)(?![A-Za-z0-9])/g, replacer: (match) => isChemFormula(match) ? formatChemFormula(match) : match });
	}
	rules.push(
		{ regex: /\b([a-zA-Z0-9]+)\^([a-zA-Z0-9-]+)\b/g, replacer: (m, b, e) => `$${b}^{${e}}$` },
		{ regex: /\b([a-zA-Z])_([a-zA-Z0-9]+)\b/g, replacer: (m, b, s) => `$${b}_{${s}}$` },
		{ regex: /\b(sin|cos|tan|log|ln|lim)\b(?=\(|_|\^)/g, replacer: (m, f) => `$\\${f}$` },
		{ regex: /\b(pi|theta|lambda|alpha|gamma|sigma|Sigma|phi|omega|delta|Delta)\b/g, replacer: (m, l) => `$\\${l}$` },
		{ regex: /\bohm\b|\bOhm\b/g, replacer: '$\\Omega$' },
		{ regex: /\bmicro\b/g, replacer: '$\\mu$' },
		{ regex: /\bdeg\b/g, replacer: '$^\\circ$' },
		{ regex: /\binfinity\b|\binf\b/g, replacer: '$\\infty$' },
		{ regex: /\btherefore\b/g, replacer: '$\\therefore$' },
		{ regex: /\bsubset\b/g, replacer: '$\\subset$' },
		{ regex: /\bcup\b/g, replacer: '$\\cup$' },
		{ regex: /\bnotin\b/g, replacer: '$\\notin$' },
		{ regex: /\bmember\b/g, replacer: '$\\in$' }
	);
	if (settings.convertEnglishLogicWords) {
		rules.push({ regex: /\bbecause\b/g, replacer: '$\\because$' }, { regex: /\bunion\b/g, replacer: '$\\cup$' }, { regex: /\bintersect\b/g, replacer: '$\\cap$' }, { regex: /\bcap\b/g, replacer: '$\\cap$' }, { regex: /\bbeta\b/g, replacer: '$\\beta$' });
	}
	return rules;
}
