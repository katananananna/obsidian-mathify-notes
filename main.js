const { Plugin, PluginSettingTab, Setting, Notice, Modal } = require('obsidian');

const DEFAULT_SETTINGS = { autoConvert: true, convertChemistry: true, convertEnglishLogicWords: false };

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));

// Text that must never be touched: math, inline code, URLs, wiki links, LaTeX delimiters, HTML comments, calendar dates.
const PROTECTED = /(\$\$[\s\S]*?\$\$|\$[^$]*\$|`[^`]*`|https?:\/\/[^\s)]+|\[\[[^\]]*\]\]|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|<!--[\s\S]*?(?:-->|$)|\b\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}\b|\b\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4}\b)/g;

// Letter pairs that are abbreviations, not fractions: n/a, w/o, b/c, i/o ...
const NOT_FRACTIONS = new Set(['na', 'wo', 'bc', 'io', 'we', 'co', 'so', 'ac', 'hw', 'rw', 'yn', 'mf', 'tf', 'dc', 'pm', 'am']);

// Chinese character (plus any punctuation/spaces) followed only by Latin words, up to the end of the text.
const PINYIN_ZONE = /[\u3400-\u9FFF\uF900-\uFAFF][\u3000-\u303F\uFF00-\uFFEF\s]*(?:[A-Za-z\u00C0-\u024F\u1E00-\u1EFF][A-Za-z\u00C0-\u024F\u1E00-\u1EFF0-9']*\s+)*$/;

function mapUnprotected(text, fn) {
	const parts = text.split(PROTECTED);
	let changed = false;
	const out = parts.map((part, i) => {
		if (i % 2 === 1 || !part) return part;
		const next = fn(part);
		if (next !== part) changed = true;
		return next;
	});
	return { text: out.join(''), changed };
}

/* ---------- Chemistry ---------- */

function parseCharge(word) {
	let m = word.match(/\^(\d{0,2}[+-])$/);
	if (m) return { core: word.slice(0, -m[0].length), charge: m[1] };
	// After a closing bracket, digits + sign are always the charge: [Cu(NH3)4]2+, (NaCl)2+
	m = word.match(/[)\]](\d{0,2}[+-])$/);
	if (m) return { core: word.slice(0, -m[1].length), charge: m[1] };
	m = word.match(/([A-Za-z])(\d{1,2})([+-])$/);
	if (m) {
		const els = word.match(/[A-Z][a-z]?/g) || [];
		if (els.length === 1) return { core: word.slice(0, -(m[2].length + m[3].length)), charge: m[2] + m[3] };
		const two = word.match(/([A-Za-z])(\d)(\d)([+-])$/);
		if (two) {
			const coreCandidate = word.slice(0, -2);
			if (isChemCore(coreCandidate)) return { core: coreCandidate, charge: two[3] + two[4] };
		}
		return { core: word.slice(0, -1), charge: m[3] };
	}
	m = word.match(/([+-])$/);
	if (m) return { core: word.slice(0, -1), charge: m[1] };
	return { core: word, charge: null };
}

function stripState(word) {
	const m = word.match(/\((aq|s|l|g)\)$/i);
	if (!m) return { core: word, state: null };
	return { core: word.slice(0, -m[0].length), state: m[1].toLowerCase() };
}

function scanChem(core) {
	let hasElement = false, elementCount = 0, hasNumber = false, hasGroup = false, valid = true, depth = 0;
	for (const token of core.split(/([A-Z][a-z]?|\d+|[()\[\]*·•.])/)) {
		if (!token) continue;
		if (/^[A-Z][a-z]?$/.test(token)) {
			if (!ELEMENTS.has(token)) { valid = false; break; }
			hasElement = true; elementCount++;
		} else if (/^\d+$/.test(token)) hasNumber = true;
		else if (token === '(' || token === '[') { depth++; hasGroup = true; }
		else if (token === ')' || token === ']') { depth--; if (depth < 0) { valid = false; break; } }
		else if (!/^[*·•.]$/.test(token)) { valid = false; break; }
	}
	if (depth !== 0) valid = false;
	return { hasElement, elementCount, hasNumber, hasGroup, valid };
}

function isChemCore(raw) {
	let core = raw;
	if (!core || /^\d+$/.test(core)) return false;
	const coeff = core.match(/^(\d+)(.*)$/);
	if (coeff) { if (!coeff[2]) return false; core = coeff[2]; }
	const s = scanChem(core);
	return s.valid && s.hasElement && (s.hasNumber || s.hasGroup);
}

function isChemFormula(word) {
	if (!word || word.length < 2) return false;
	const stripped = stripState(word);
	const parsed = parseCharge(stripped.core);
	let body = parsed.core;
	if (!body || /^\d+$/.test(body)) return false;
	const coeff = body.match(/^(\d+)(.*)$/);
	if (coeff) { if (!coeff[2]) return false; body = coeff[2]; }
	const s = scanChem(body);
	if (!s.valid || !s.hasElement) return false;
	// A digit, charge, state or bracket is required: CO, ISO, OK, He, NaCl stay plain words.
	return s.hasNumber || s.hasGroup || !!parsed.charge || !!stripped.state;
}

function formatCoreChem(core) {
	let out = '';
	const coeff = core.match(/^(\d+)(.*)$/);
	if (coeff && coeff[2]) { out = coeff[1]; core = coeff[2]; }
	let text = '';
	const flush = () => { if (text) { out += `\\text{${text}}`; text = ''; } };
	for (const tok of core.split(/(\d+|[()\[\]])/)) {
		if (!tok) continue;
		if (/^\d+$/.test(tok)) { flush(); out += `_{${tok}}`; }
		else if (/^[()\[\]]$/.test(tok)) { flush(); out += tok; }
		else text += tok;
	}
	flush();
	return out;
}

// Output uses mhchem's \ce{}, which Obsidian's MathJax includes: correct upright symbols, charges, states and arrows.
function formatChemFormula(word) {
	const stripped = stripState(word);
	const parsed = parseCharge(stripped.core);
	const charge = parsed.charge ? `^{${parsed.charge}}` : '';
	const state = stripped.state ? `(${stripped.state})` : '';
	const body = parsed.core.replace(/[·•]/g, '*');
	return `$\\ce{${body}${charge}${state}}$`;
}

/* ---------- Whole reactions ---------- */

// Existing $...$ blocks, code and URLs are swapped for placeholders first, so the
// matcher never looks inside them. \ce blocks become operand placeholders (n),
// everything else becomes an inert placeholder (n).
const SEALED = /(\$\\ce\{[^$]*\}\$|\$[^$]*\$|`[^`]*`|https?:\/\/[^\s)]+)/g;
const OPERAND = '(?:\\uE000\\d+\\uE001|\\d*e-|[A-Z0-9(\\[][A-Za-z0-9()\\[\\]*·•^+-]*)';
const ARROW = '(?:-->|->|<=>|<->|→|⟶|⇌|↔)';
const SIDE = `${OPERAND}(?: \\+ ${OPERAND})*`;
const REACTION = new RegExp(`(?<![\\w\\uE001\\uE003])(${SIDE}) ?(${ARROW}) ?(${SIDE})(?![\\w\\uE000\\uE002])`, 'g');
const ARROW_CE = { '-->': '->', '->': '->', '→': '->', '⟶': '->', '<=>': '<=>', '⇌': '<=>', '<->': '<->', '↔': '<->' };

function mergeReactions(text) {
	const sealed = [];
	let work = text.replace(SEALED, (m) => {
		const i = sealed.push(m) - 1;
		return m.startsWith('$\\ce{') ? `${i}` : `${i}`;
	});
	// strict: clearly chemistry on its own. loose: a plain element or element group (Cu, NaCl),
	// accepted only when another operand in the same equation is clearly chemistry.
	const operandCe = (op) => {
		const ph = op.match(/^(\d+)$/);
		if (ph) return { ce: sealed[Number(ph[1])].slice(5, -2), strict: true };
		if (/^\d*e-$/.test(op)) return { ce: op, strict: true };
		if (isChemFormula(op)) return { ce: formatChemFormula(op).slice(5, -2), strict: true };
		const body = op.replace(/^\d+/, '');
		const scan = body ? scanChem(body) : null;
		return scan && scan.valid && scan.hasElement ? { ce: op, strict: false } : null;
	};
	const merged = work.replace(REACTION, (m, lhs, arrow, rhs) => {
		const l = lhs.split(' + ').map(operandCe), r = rhs.split(' + ').map(operandCe);
		const all = [...l, ...r];
		if (all.some((o) => o === null) || !all.some((o) => o.strict)) return m;
		const side = (ops) => ops.map((o) => o.ce).join(' + ');
		return `$\\ce{${side(l)} ${ARROW_CE[arrow]} ${side(r)}}$`;
	});
	if (merged === work) return text;
	// A finished reaction followed by "+ X": fold X into the right-hand side.
	return merged.replace(/(\d+)|(\d+)/g, (m, a, b) => sealed[Number(a ?? b)]);
}

// Extend $\ce{A -> B}$ + C into $\ce{A -> B + C}$ (C may be raw or already converted).
function extendReactions(text) {
	return text.replace(/\$\\ce\{([^$]*?(?:->|<=>|<->)[^$]*?)\}\$ \+ (\$\\ce\{([^$]*)\}\$|\d*e-(?![\w-])|[A-Z0-9(\[][A-Za-z0-9()\[\]*·•^+-]*(?![\w]))/g, (m, reaction, op, inner) => {
		if (inner !== undefined) return `$\\ce{${reaction} + ${inner}}$`;
		if (/^\d*e-$/.test(op)) return `$\\ce{${reaction} + ${op}}$`;
		return isChemFormula(op) ? `$\\ce{${reaction} + ${formatChemFormula(op).slice(5, -2)}}$` : m;
	});
}

/* ---------- Rules ---------- */

function buildRules(settings) {
	const rules = [
		// Units (before fractions, so m/s2 is not read as a fraction).
		{ regex: /\b(mol|g|kg)\s*\/\s*(dm|cm|m)3\b/g, replacer: (m, a, b) => `${a} ${b}$^{-3}$` },
		{ regex: /\bm\s*\/\s*s2\b/g, replacer: 'm s$^{-2}$' },
		// Calculus, statistics, vectors.
		{ regex: /\bint\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g, replacer: (m, a, b) => `$\\int_{${a}}^{${b}}$` },
		{ regex: /\bsum\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g, replacer: (m, a, b) => `$\\sum_{${a}}^{${b}}$` },
		{ regex: /\b(vec|bar|hat|dot)\(\s*([^()]+?)\s*\)/g, replacer: (m, f, x) => `$\\${f}{${x}}$` },
		{ regex: /\bn([CP])r\(\s*([^,()]+?)\s*,\s*([^()]+?)\s*\)/g, replacer: (m, k, n, r) => `$^{${n}}${k}_{${r}}$` },
		{ regex: /\bdeg([CF])\b/g, replacer: (m, u) => `$^\\circ\\text{${u}}$` },
		{ regex: /\bd([HSG])\b/g, replacer: (m, q) => `$\\Delta ${q}$` },
		{ regex: /\bforall\b/g, replacer: '$\\forall$' },
		// Fractions: digits not glued to a decimal point or another slash (2.0/3.1 and 1/2/2025 stay put).
		{ regex: /(?<![\d.\/])(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{1,2})(?![\d.\/])/g, replacer: (m, a, b, c) => `$\\frac{\\frac{${a}}{${b}}}{${c}}$` },
		{ regex: /(?<![\d.\/])(\d{1,3})\s*\/\s*(\d{1,3})(?![\d.\/])/g, replacer: (m, a, b) => `$\\frac{${a}}{${b}}$` },
		{ regex: /\bd([A-Za-z])\s*\/\s*d([A-Za-z])\b/g, replacer: (m, a, b) => `$\\frac{d${a}}{d${b}}$` },
		{ regex: /(?<![\w\/])([a-z])\s*\/\s*([a-z])(?![\w\/])/g, replacer: (m, a, b) => (NOT_FRACTIONS.has(a + b) ? m : `$\\frac{${a}}{${b}}$`) },
		{ regex: /\broot\(([^,()]+)\s*,\s*([^()]+)\)/g, replacer: (m, i, r) => `$\\sqrt[${i.trim()}]{${r.trim()}}$` },
		{ regex: /\bsqrt\(([^()]+)\)/g, replacer: (m, c) => `$\\sqrt{${c}}$` },
		{ regex: /<=>/g, replacer: '⇌' },
		{ regex: /<->/g, replacer: '↔' },
		{ regex: /-->/g, replacer: '⟶' },
		{ regex: /(?<!-)->/g, replacer: '→' },
		{ regex: /<--/g, replacer: '⟵' },
		{ regex: /(?<!<)<-(?!-)/g, replacer: '←' },
		// Up/down arrows: a lone |^ or |v between spaces (so |x|^2, |v| and table rows are untouched).
		{ regex: /(?<![^\s])\|\^(?![^\s])/g, replacer: (m, offset, whole) => (whole.split('|').length === 2 ? '↑' : m) },
		{ regex: /(?<![^\s])\|v(?![^\s])/g, replacer: (m, offset, whole) => (whole.split('|').length === 2 ? '↓' : m) },
		{ regex: /==>/g, replacer: '⟹' },
		{ regex: /(?<!=)=>/g, replacer: '⇒' },
		{ regex: /\bpropto\b/g, replacer: '$\\propto$' },
		{ regex: /(\b\d+)\s+[xX]\s+(\d+\b)/g, replacer: (m, a, b) => `${a} $\\times$ ${b}` },
		{ regex: /(?<=\d)\s+\*\s+(?=\d)/g, replacer: ' $\\times$ ' },
		{ regex: /(?<=\d)\s+div\s+(?=\d)/g, replacer: ' $\\div$ ' },
		{ regex: /~~|~=|\bapprox\b/g, replacer: '$\\approx$' },
		{ regex: /!=/g, replacer: '$\\neq$' },
		{ regex: /<=|=</g, replacer: '$\\leq$' },
		{ regex: />=/g, replacer: '$\\geq$' },
		{ regex: /\+-/g, replacer: '$\\pm$' },
		{ regex: /-\+/g, replacer: '$\\mp$' },
		{ regex: /\+\/-/g, replacer: '$\\pm$' },
	];
	if (settings.convertChemistry) {
		rules.push(
			{ regex: /(?<![\w\-])e-(?![\w\-])/g, replacer: '$\\ce{e-}$' },
			{ regex: /(?<![A-Za-z0-9])([A-Z0-9(\[][A-Za-z0-9()\[\]*·•^+-]*)(?![A-Za-z0-9])/g, replacer: (m) => (isChemFormula(m) ? formatChemFormula(m) : m) },
		);
	}
	rules.push(
		{ regex: /\b([a-zA-Z0-9]+)\^([a-zA-Z0-9-]+)\b/g, replacer: (m, b, e) => `$${b}^{${e}}$` },
		{ regex: /\b([a-zA-Z])_([a-zA-Z0-9]+)\b/g, replacer: (m, b, s) => `$${b}_{${s}}$` },
		{ regex: /\b(sin|cos|tan|log|ln|lim)\(([^()]*)\)/g, replacer: (m, f, a) => `$\\${f}(${a})$` },
		{ regex: /\b(sin|cos|tan|log|ln|lim)\b(?=\(|_|\^)/g, replacer: (m, f) => `$\\${f}$` },
		// Escape: \pi or /pi always gives π (the slash is removed), even straight after Chinese text.
		{ regex: /(?<![\w\/\\])[\/\\](pi|theta|lambda|alpha|gamma|sigma|Sigma|phi|omega|delta|Delta|epsilon|zeta|eta|kappa|mu|nu|xi|rho|tau|chi|psi|beta)\b(?!\/)/g, replacer: (m, l) => `$\\${l}$` },
		// These five Greek names are also pinyin syllables (批 pi, 學習 xi, 木 mu, 女 nu, 吃 chi), so they are
		// left alone when they follow Chinese text, directly or after other pinyin words: 批評 pi ping.
		{ regex: /(?<!\\)\b(pi|xi|mu|nu|chi)\b/g, replacer: (m, l, offset, whole) => (PINYIN_ZONE.test(whole.slice(0, offset)) ? m : `$\\${l}$`) },
		{ regex: /(?<!\\)\b(theta|lambda|alpha|gamma|sigma|Sigma|phi|omega|delta|Delta|epsilon|zeta|eta|kappa|rho|tau|psi)\b/g, replacer: (m, l) => `$\\${l}$` },
		{ regex: /\b[oO]hm\b/g, replacer: '$\\Omega$' },
		{ regex: /\bmicro(?=\s*(?:m|g|l|s|mol|A|F|V|W|Pa|N|J|C)\b)/g, replacer: '$\\mu$' },
		{ regex: /\bdeg\b/g, replacer: '$^\\circ$' },
		{ regex: /\binfinity\b|\binf\b/g, replacer: '$\\infty$' },
		{ regex: /\bnotin\b/g, replacer: '$\\notin$' },
	);
	if (settings.convertEnglishLogicWords) {
		// Ordinary English words: only when the user opts in.
		rules.push(
			{ regex: /\bbecause\b/g, replacer: '$\\because$' },
			{ regex: /\bunion\b|\bcup\b/g, replacer: '$\\cup$' },
			{ regex: /\bintersect\b|\bcap\b/g, replacer: '$\\cap$' },
			{ regex: /\bsubset\b/g, replacer: '$\\subset$' },
			{ regex: /\bmember\b/g, replacer: '$\\in$' },
			{ regex: /\bbeta\b/g, replacer: '$\\beta$' },
			{ regex: /\btherefore\b/g, replacer: '$\\therefore$' },
			{ regex: /\bexists\b/g, replacer: '$\\exists$' },
		);
	} else {
		// "subset" is rarely ordinary English, keep it on by default as documented.
		rules.push({ regex: /\bsubset\b/g, replacer: '$\\subset$' });
	}
	return rules;
}

function convertLine(lineText, settings) {
	settings = Object.assign({}, DEFAULT_SETTINGS, settings);
	const rules = buildRules(settings);
	let text = lineText, changed = false;
	for (const rule of rules) {
		const result = mapUnprotected(text, (plain) => plain.replace(rule.regex, rule.replacer));
		if (result.changed) { text = result.text; changed = true; }
	}
	if (settings.convertChemistry !== false) {
		const merged = extendReactions(mergeReactions(text));
		if (merged !== text) { text = merged; changed = true; }
	}
	return { text, changed };
}

/* ---------- Editor helpers ---------- */

function blockContext(editor, lineNo) {
	let fence = null;
	const first = editor.getLine(0);
	let inFrontmatter = first !== undefined && first.trim() === '---' && lineNo > 0;
	if (lineNo === 0 && first !== undefined && first.trim() === '---') return 'frontmatter';
	for (let i = inFrontmatter ? 1 : 0; i <= lineNo; i++) {
		const line = editor.getLine(i);
		if (inFrontmatter) {
			if (i === lineNo) return 'frontmatter';
			if (/^(---|\.\.\.)\s*$/.test(line)) inFrontmatter = false;
			continue;
		}
		const m = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/);
		if (fence) {
			if (i === lineNo) return 'code';
			if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
			continue;
		}
		if (m) { if (i === lineNo) return 'code'; fence = m[1]; }
	}
	return 'none';
}

// Shortcut guide: shown in settings and in the 'Show shortcut guide' command.
// [what to type, what you get, note]
const SHORTCUTS = [
	{ group: 'Arrows', rows: [
		['->', '→', 'right arrow'],
		['<-', '←', 'left arrow'],
		['<->', '↔', 'two-way arrow'],
		['-->', '⟶', 'long right arrow'],
		['<--', '⟵', 'long left arrow'],
		['=>', '⇒', 'implies'],
		['==>', '⟹', 'long implies'],
		['<=>', '⇌', 'equilibrium'],
		['|^', '↑', 'up arrow (gas given off); on its own between spaces'],
		['|v', '↓', 'down arrow (precipitate); on its own between spaces'],
	] },
	{ group: 'Chemistry', rows: [
		['H2O, CO2, Ca(OH)2', 'H₂O, CO₂, Ca(OH)₂', 'formulas (need a digit, charge, bracket or state)'],
		['SO4^2- or SO42-', 'SO₄²⁻', 'ion charge'],
		['Fe3+, Cu2+', 'Fe³⁺, Cu²⁺', 'ion charge'],
		['CuSO4*5H2O', 'CuSO₄·5H₂O', 'hydrate'],
		['H2O(l) (aq) (g) (s)', 'states of matter', 'state'],
		['H2 + O2 -> H2O', 'one \\ce equation', 'whole equation, upright formulas and a proper arrow'],
		['N2 + 3H2 <=> 2NH3', 'equilibrium equation', 'also <-> for two-way'],
		['Cu2+ + 2e- -> Cu', 'half-equation', 'plain elements are fine once one formula is clear'],
		['e-', 'e⁻', 'electron'],
		['dH  dS  dG', 'ΔH  ΔS  ΔG', 'enthalpy, entropy, Gibbs'],
		['mol/dm3, g/cm3, kg/m3', 'mol dm⁻³ …', 'concentration and density units'],
	] },
	{ group: 'Operators', rows: [
		['!=', '≠', ''],
		['<=  >=', '≤  ≥', ''],
		['~~ or ~=', '≈', 'approximately'],
		['+- or +/-', '±', 'plus or minus'],
		['-+', '∓', 'minus or plus'],
		['2 x 3 or 2 * 3', '2 × 3', 'needs numbers either side'],
		['a div b', '÷', 'needs numbers either side'],
		['propto', '∝', 'proportional to'],
	] },
	{ group: 'Fractions, powers, roots', rows: [
		['1/2', 'fraction', 'single letters too: a/b'],
		['1/2/3', 'nested fraction', ''],
		['dy/dx, dT/dt', 'derivative', ''],
		['x^2, x^y', 'superscript', ''],
		['x_i, a_n', 'subscript', ''],
		['sqrt(x)', '√x', ''],
		['root(3, x)', '∛x', 'nth root'],
	] },
	{ group: 'Calculus, statistics, vectors', rows: [
		['int(0,1)', '∫₀¹', 'definite integral'],
		['sum(i=1,n)', 'Σ from i=1 to n', 'series'],
		['vec(F), hat(i)', 'F⃗, î', 'vectors, unit vectors'],
		['bar(x), dot(x)', 'x̄, ẋ', 'mean, time derivative'],
		['nCr(5,2), nPr(5,2)', '⁵C₂, ⁵P₂', 'combinations, permutations'],
	] },
	{ group: 'Functions', rows: [
		['log( ln( sin( cos( tan( lim', 'log sin cos …', 'typeset as functions'],
	] },
	{ group: 'Symbols', rows: [
		['inf or infinity', '∞', ''],
		['deg', '°', 'degree'],
		['degC, degF', '°C, °F', 'temperature'],
		['m/s2', 'm s⁻²', 'acceleration'],
		['forall', '∀', 'for all'],
		['ohm', 'Ω', ''],
		['micro', 'μ', ''],
		['notin', '∉', 'not an element of'],
		['subset', '⊂', 'always on'],
	] },
	{ group: 'Greek', rows: [
		['pi, theta, lambda, alpha, gamma', 'π θ λ α γ', 'pi, xi, mu, nu, chi are skipped straight after Chinese (they are pinyin); type \\pi or /pi to force π'],
		['\\pi  /theta  \\alpha', 'π  θ  α', 'a slash or backslash first always converts, and the slash is removed'],
		['sigma, Sigma, phi, omega', 'σ Σ φ ω', ''],
		['delta, Delta, epsilon, zeta, eta', 'δ Δ ε ζ η', ''],
		['kappa, mu, nu, xi, rho, tau, chi, psi', 'κ μ ν ξ ρ τ χ ψ', ''],
	] },
	{ group: 'English logic words (off by default)', rows: [
		['because', '∵', 'turn on in settings'],
		['therefore', '∴', 'turn on in settings'],
		['union or cup', '∪', 'turn on in settings'],
		['intersect or cap', '∩', 'turn on in settings'],
		['member', '∈', 'turn on in settings'],
		['beta', 'β', 'turn on in settings'],
		['exists', '∃', 'turn on in settings'],
	] },
];

function renderGuide(parent) {
	for (const section of SHORTCUTS) {
		parent.createEl('h4', { cls: 'mathify-guide-group', text: section.group });
		const table = parent.createEl('table', { cls: 'mathify-guide-table' });
		const head = table.createEl('tr');
		['Type', 'Get', 'Notes'].forEach((t) => head.createEl('th', { text: t }));
		for (const [typed, out, note] of section.rows) {
			const tr = table.createEl('tr');
			tr.createEl('td', { cls: 'mathify-guide-in', text: typed });
			tr.createEl('td', { cls: 'mathify-guide-out', text: out });
			tr.createEl('td', { cls: 'mathify-guide-note', text: note });
		}
	}
}

class GuideModal extends Modal {
	onOpen() {
		this.modalEl.addClass('mathify-guide-modal');
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Mathify shortcut guide' });
		this.contentEl.createEl('p', { cls: 'mathify-guide-intro', text: 'Type the shortcut, then press Space. Most shortcuts need the space to convert.' });
		renderGuide(this.contentEl);
	}
	onClose() { this.contentEl.empty(); }
}

class MathifySettingTab extends PluginSettingTab {
	constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
	display() {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		new Setting(containerEl).setName('Convert as you type').setDesc('Press Space to convert the current line.')
			.addToggle((t) => t.setValue(s.autoConvert).onChange(async (v) => { s.autoConvert = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('Chemistry formulas').setDesc('Detect H2O, Ca(OH)2, SO4^2-, [Cu(NH3)4]2+, hydrates, states.')
			.addToggle((t) => t.setValue(s.convertChemistry).onChange(async (v) => { s.convertChemistry = v; await this.plugin.saveSettings(); }));
		new Setting(containerEl).setName('English logic words').setDesc('Also convert because, therefore, union, cup, intersect, cap, member, beta. Off by default.')
			.addToggle((t) => t.setValue(s.convertEnglishLogicWords).onChange(async (v) => { s.convertEnglishLogicWords = v; await this.plugin.saveSettings(); }));
		containerEl.createEl('h3', { text: 'Shortcut guide' });
		new Setting(containerEl).setName('Open as a pop-up').setDesc('The same guide, in a window you can read while you write.')
			.addButton((b) => b.setButtonText('Open guide').onClick(() => new GuideModal(this.app).open()));
		renderGuide(containerEl);
	}
}

class MathShorthandPlugin extends Plugin {
	async onload() {
		await this.loadSettings();
		this.isConverting = false;
		this.lastUndo = null;
		this.addCommand({ id: 'convert-shorthand-math', name: 'Convert math shorthand in current line', editorCallback: (editor) => this.runConvert(editor) });
		this.addCommand({ id: 'convert-selection', name: 'Convert math shorthand in selection', editorCallback: (editor) => this.convertSelection(editor) });
		this.addCommand({ id: 'show-guide', name: 'Show shortcut guide', callback: () => new GuideModal(this.app).open() });
		this.addCommand({ id: 'convert-note', name: 'Convert math shorthand in whole note', editorCallback: (editor) => this.convertNote(editor) });
		this.addSettingTab(new MathifySettingTab(this.app, this));
		this.registerEvent(this.app.workspace.on('editor-change', (editor) => {
			if (!this.settings.autoConvert || this.isConverting) return;
			if (editor.listSelections && editor.listSelections().length !== 1) return;
			const cursor = editor.getCursor();
			const lineText = editor.getLine(cursor.line);
			if (cursor.ch > 0 && lineText[cursor.ch - 1] === ' ') this.runConvert(editor);
		}));
	}
	runConvert(editor) {
		this.isConverting = true;
		try { this.convertMathInCurrentLine(editor); }
		catch (e) { console.error('Mathify Notes:', e); }
		finally { this.isConverting = false; }
	}
	convertMathInCurrentLine(editor) {
		const cursor = editor.getCursor();
		if (blockContext(editor, cursor.line) !== 'none') return;
		const lineText = editor.getLine(cursor.line);
		// Only convert text before the cursor so a half-typed word after it is never touched.
		const before = lineText.slice(0, cursor.ch);
		const result = convertLine(before, this.settings);
		if (!result.changed) return;
		editor.replaceRange(result.text, { line: cursor.line, ch: 0 }, { line: cursor.line, ch: cursor.ch });
		editor.setCursor({ line: cursor.line, ch: result.text.length });
	}
	convertSelection(editor) {
		const from = editor.getCursor('from'), to = editor.getCursor('to');
		if (from.line === to.line && from.ch === to.ch) { new Notice('Select some text first.'); return; }
		const lines = [];
		let count = 0;
		for (let l = from.line; l <= to.line; l++) {
			const text = editor.getLine(l);
			const a = l === from.line ? from.ch : 0, b = l === to.line ? to.ch : text.length;
			if (blockContext(editor, l) !== 'none') { lines.push(text.slice(a, b)); continue; }
			const r = convertLine(text.slice(a, b), this.settings);
			if (r.changed) count++;
			lines.push(r.text);
		}
		if (!count) { new Notice('Nothing to convert.'); return; }
		editor.replaceRange(lines.join('\n'), from, to);
		new Notice(`Converted ${count} line${count === 1 ? '' : 's'}.`);
	}
	convertNote(editor) {
		const out = [];
		let count = 0;
		for (let l = 0; l < editor.lineCount(); l++) {
			const text = editor.getLine(l);
			if (blockContext(editor, l) !== 'none') { out.push(text); continue; }
			const r = convertLine(text, this.settings);
			if (r.changed) count++;
			out.push(r.text);
		}
		if (!count) { new Notice('Nothing to convert.'); return; }
		// One editor transaction, so a single Ctrl/Cmd+Z undoes the whole conversion.
		editor.setValue(out.join('\n'));
		new Notice(`Converted ${count} line${count === 1 ? '' : 's'}. Undo with Ctrl/Cmd+Z.`);
	}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
}

MathShorthandPlugin.__test = { convertLine, isChemFormula, SHORTCUTS };
module.exports = MathShorthandPlugin;
