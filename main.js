const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
	autoConvert: true,
	convertChemistry: true,
	convertEnglishLogicWords: false
};

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
const AMBIGUOUS_TWO_ELEMENT = new Set('NO CO US SO SI NI OS AS IN HE BE NE AL CA SC TI PO AT PA'.split(' '));

const DATE_RE = /\b(?:\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}|\d{1,2}[.\/-]\d{1,2}[.\/-]\d{2,4})\b/g;

const UNPROTECTED = /(\$\$[\s\S]*?\$\$|\$[^$]*\$|`[^`]*`|https?:\/\/[^\s)]+|\[\[[^\]]*\]\]|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|<!--[\s\S]*?-->)/g;

function mapUnprotected(text, fn) {
	const parts = text.split(UNPROTECTED);
	let changed = false;
	const out = parts.map((part, i) => {
		if (i % 2 === 1) return part;
		const next = fn(part);
		if (next !== part) changed = true;
		return next;
	});
	return { text: out.join(''), changed };
}

function maskDates(text) {
	const saved = [];
	const masked = text.replace(DATE_RE, (m) => {
		saved.push(m);
		return `\u0000D${saved.length - 1}\u0000`;
	});
	return { masked, saved };
}

function unmaskDates(text, saved) {
	return text.replace(/\u0000D(\d+)\u0000/g, (_, i) => saved[Number(i)] ?? '');
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
	if (!s.hasNumber && !parsed.charge && !stripped.state && !/[()\[\]]/.test(body) && !/[A-Z][a-z]/.test(body)) return false;
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
