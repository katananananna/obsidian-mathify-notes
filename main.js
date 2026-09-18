const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = { autoConvert: true, convertChemistry: true, convertEnglishLogicWords: false };

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm'.split(' '));
const AMBIGUOUS_TWO_ELEMENT = new Set('NO CO US SO SI NI OS AS IN HE BE NE AL CA SC TI PO AT PA'.split(' '));

function mapUnprotected(text, fn) {
	const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$]*\$|`[^`]*`|https?:\/\/[^\s)]+|\[\[[^\]]*\]\])/g);
	let changed = false;
	const out = parts.map((part, i) => {
		if (i % 2 === 1) return part;
		const next = fn(part);
		if (next !== part) changed = true;
		return next;
	});
	return { text: out.join(''), changed };
}

function parseCharge(word) {
	let m = word.match(/\^(\d{0,2}[+-])$/);
	if (m) return { core: word.slice(0, -m[0].length), charge: m[1] };
	m = word.match(/([A-Za-z)\]}])(\d{1,2})([+-])$/);
	if (m) {
		const els = word.match(/[A-Z][a-z]?/g) || [];
		if (els.length === 1) return { core: word.slice(0, -(m[2].length + m[3].length)), charge: m[2] + m[3] };
		const two = word.match(/([A-Za-z)\]}])(\d)(\d)([+-])$/);
		if (two) {
			const coreCandidate = word.slice(0, -(two[3].length + two[4].length));
			if (isChemCore(coreCandidate)) return { core: coreCandidate, charge: two[3] + two[4] };
		}
		return { core: word.slice(0, -1), charge: m[3] };
	}
	m = word.match(/([+-])$/);
	if (m) return { core: word.slice(0, -1), charge: m[1] };
	return { core: word, charge: null };
}

function stripState(word) {
	const stateMatch = word.match(/\((aq|s|l|g)\)$/i);
	if (!stateMatch) return { core: word, state: null };
	return { core: word.slice(0, -stateMatch[0].length), state: stateMatch[1].toLowerCase() };
}

function tokenizeChem(core) {
	return core.split(/([A-Z][a-z]?|\d+|[()\[\]*·•.])/);
}

function scanChem(core) {
	let hasElement = false, elementCount = 0, hasNumber = false, valid = true;
	for (const token of tokenizeChem(core)) {
		if (!token) continue;
		if (/^[A-Z][a-z]?$/.test(token)) {
			if (!ELEMENTS.has(token)) { valid = false; break; }
			hasElement = true; elementCount++;
		} else if (/^\d+$/.test(token)) hasNumber = true;
		else if (!/^[()\[\]*·•.]$/.test(token)) { valid = false; break; }
	}
	return { hasElement, elementCount, hasNumber, valid };
}

function isChemCore(raw) {
	let core = raw;
	if (!core || /^\d+$/.test(core)) return false;
	const coeff = core.match(/^(\d+)(.*)$/);
	if (coeff) { if (!coeff[2]) return false; core = coeff[2]; }
	const s = scanChem(core);
	return s.valid && s.hasElement && (s.hasNumber || s.elementCount >= 2);
}

function isChemFormula(word) {
	if (!word || word.length < 2) return false;
	const stripped = stripState(word);
	const parsed = parseCharge(stripped.core);
	if (/^\d+$/.test(parsed.core)) return false;
	let body = parsed.core;
	const coeff = body.match(/^(\d+)(.*)$/);
	if (coeff) { if (!coeff[2]) return false; body = coeff[2]; }
	if (AMBIGUOUS_TWO_ELEMENT.has(body) && !parsed.charge && !stripped.state && !/\d/.test(body) && !/[()\[\]*·•.]/.test(body)) return false;
	if (!isChemCore(body) && !parsed.charge && !stripped.state) return false;
	const s = scanChem(body);
	if (!s.valid) return false;
	if (s.elementCount === 1 && !s.hasNumber && !parsed.charge && !stripped.state) return false;
	return s.hasElement;
}

function formatCoreChem(core) {
	let coefficient = '';
	const coeffMatch = core.match(/^(\d+)(.*)$/);
	if (coeffMatch && coeffMatch[2].length > 0) { coefficient = coeffMatch[1]; core = coeffMatch[2]; }
	const formattedTokens = core.split(/(\d+|[()\[\]])/).map((token) => {
		if (!token) return '';
		return /^\d+$/.test(token) ? `_{${token}}` : `\\text{${token}}`;
	});
	let combined = coefficient, currentText = '';
	for (const tok of formattedTokens) {
		if (tok.startsWith('\\text{') && tok.endsWith('}')) currentText += tok.slice(6, -1);
		else {
			if (currentText) { combined += `\\text{${currentText}}`; currentText = ''; }
			combined += tok;
		}
	}
	if (currentText) combined += `\\text{${currentText}}`;
	return combined;
}

function formatChemFormula(word) {
	const stripped = stripState(word);
	const stateOfMatter = stripped.state ? `\\text{(${stripped.state})}` : '';
	const parsed = parseCharge(stripped.core);
	const charge = parsed.charge ? `^{${parsed.charge}}` : '';
	const hydrateParts = parsed.core.split(/[*·•.]/);
	if (hydrateParts.length > 1) {
		const formattedParts = hydrateParts.map((part, index) => {
			if (index === 0) return formatCoreChem(part);
			const cm = part.match(/^(\d+)(.*)$/);
			return cm ? `${cm[1]}${formatCoreChem(cm[2])}` : formatCoreChem(part);
		});
		return `$${formattedParts.join(' \\cdot ')}${charge}${stateOfMatter}$`;
	}
	return `$${formatCoreChem(parsed.core)}${charge}${stateOfMatter}$`;
}

function buildRules(settings) {
	const rules = [
		{ regex: /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/g, replacer: (m, a, b, c) => `$\\frac{\\frac{${a}}{${b}}}{${c}}$` },
		{ regex: /\b(\d+)\s*\/\s*(\d+)\b(?!\s*\/)/g, replacer: (m, a, b) => (a.length === 4 || b.length === 4 ? m : `$\\frac{${a}}{${b}}$`) },
		{ regex: /\bdy\s*\/\s*dx\b/g, replacer: '$\\frac{dy}{dx}$' },
		{ regex: /\b([a-zA-Z])\s*\/\s*([a-zA-Z])\b/g, replacer: (m, a, b) => `$\\frac{${a}}{${b}}$` },
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

function convertLine(lineText, settings) {
	const opts = Object.assign({}, DEFAULT_SETTINGS, settings);
	const rules = buildRules(opts);
	let currentText = lineText, lineChanged = false;
	for (const rule of rules) {
		const result = mapUnprotected(currentText, (plain) => plain.replace(rule.regex, rule.replacer));
		if (result.changed) { currentText = result.text; lineChanged = true; }
	}
	return { text: currentText, changed: lineChanged };
}

function convertPrefix(lineText, cursorCh, settings) {
	return convertLine(lineText.slice(0, cursorCh), settings).text;
}

function lineIsInsideFencedCode(editor, lineNo) {
	let fences = 0;
	for (let i = 0; i <= lineNo; i++) {
		if (/^\s*```/.test(editor.getLine(i))) {
			if (i === lineNo) return true;
			fences++;
		}
	}
	return fences % 2 === 1;
}

function lineIsFrontmatter(editor, lineNo) {
	if (editor.getLine(0).trim() !== '---') return false;
	for (let i = 1; i < lineNo; i++) {
		if (editor.getLine(i).trim() === '---') return false;
	}
	return true;
}

class MathifySettingTab extends PluginSettingTab {
	constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Mathify Notes' });
		new Setting(containerEl).setName('Convert as you type').setDesc('Press Space to convert the current line.')
			.addToggle((t) => t.setValue(this.plugin.settings.autoConvert).onChange(async (v) => { this.plugin.settings.autoConvert = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('Chemistry formulas').setDesc('Detect H2O, Ca(OH)2, SO4^2-, hydrates.')
			.addToggle((t) => t.setValue(this.plugin.settings.convertChemistry).onChange(async (v) => { this.plugin.settings.convertChemistry = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('English logic words').setDesc('Also convert because / union / intersect / cap / beta. Off by default.')
			.addToggle((t) => t.setValue(this.plugin.settings.convertEnglishLogicWords).onChange(async (v) => { this.plugin.settings.convertEnglishLogicWords = v; await this.plugin.saveSettings(); }));
	}
}

module.exports = class MathShorthandPlugin extends Plugin {
	async onload() {
		await this.loadSettings();
		this.isConverting = false;
		this.addCommand({ id: 'convert-shorthand-math', name: 'Convert math shorthand in current line', editorCallback: (editor) => this.runConvert(editor) });
		this.addSettingTab(new MathifySettingTab(this.app, this));
		this.registerEvent(this.app.workspace.on('editor-change', (editor) => {
			if (!this.settings.autoConvert || this.isConverting) return;
			const cursor = editor.getCursor();
			const lineText = editor.getLine(cursor.line);
			if (cursor.ch > 0 && lineText[cursor.ch - 1] === ' ') this.runConvert(editor);
		}));
	}
	runConvert(editor) {
		this.isConverting = true;
		try { this.convertMathInCurrentLine(editor); } finally { this.isConverting = false; }
	}
	convertMathInCurrentLine(editor) {
		const cursor = editor.getCursor();
		if (lineIsInsideFencedCode(editor, cursor.line) || lineIsFrontmatter(editor, cursor.line)) return;
		const lineText = editor.getLine(cursor.line);
		const result = convertLine(lineText, this.settings);
		if (!result.changed) return;
		editor.replaceRange(result.text, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: lineText.length });
		editor.setCursor({ line: cursor.line, ch: convertPrefix(lineText, cursor.ch, this.settings).length });
	}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
	onunload() {}
};
