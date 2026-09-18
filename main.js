const { Plugin, PluginSettingTab, Setting } = require('obsidian');

const DEFAULT_SETTINGS = {
	autoConvert: true,
	convertChemistry: true,
	convertEnglishLogicWords: false
};

const ELEMENTS = new Set([
	'H','He','Li','Be','B','C','N','O','F','Ne',
	'Na','Mg','Al','Si','P','S','Cl','Ar','K','Ca',
	'Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn',
	'Ga','Ge','As','Se','Br','Kr','Rb','Sr','Y','Zr',
	'Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd','In','Sn',
	'Sb','Te','I','Xe','Cs','Ba','La','Ce','Pr','Nd',
	'Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb',
	'Lu','Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg',
	'Tl','Pb','Bi','Po','At','Rn','Fr','Ra','Ac','Th',
	'Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm'
]);

const AMBIGUOUS_TWO_ELEMENT = new Set([
	'NO','CO','US','SO','SI','NI','OS','AS','IN','HE','BE',
	'NE','AL','CA','SC','TI','PO','AT','PA'
]);

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
		const elementMatches = word.match(/[A-Z][a-z]?/g) || [];
		if (elementMatches.length === 1) {
			return { core: word.slice(0, -(m[2].length + m[3].length)), charge: m[2] + m[3] };
		}
		const twoDigitCharge = word.match(/([A-Za-z)\]}])(\d)(\d)([+-])$/);
		if (twoDigitCharge) {
			const coreCandidate = word.slice(0, -(twoDigitCharge[3].length + twoDigitCharge[4].length));
			if (isChemCore(coreCandidate)) {
				return { core: coreCandidate, charge: twoDigitCharge[3] + twoDigitCharge[4] };
			}
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

function isChemCore(raw) {
	let core = raw;
	if (/^\d+$/.test(core) || !core) return false;
	const coeff = core.match(/^(\d+)(.*)$/);
	if (coeff) {
		if (!coeff[2]) return false;
		core = coeff[2];
	}
	const tokens = core.split(/([A-Z][a-z]?|\d+|[()\[\]*·•.])/);
	let hasElement = false;
	let hasNumber = false;
	for (const token of tokens) {
		if (!token) continue;
		if (/^[A-Z][a-z]?$/.test(token)) {
			if (!ELEMENTS.has(token)) return false;
			hasElement = true;
		} else if (/^\d+$/.test(token)) {
			hasNumber = true;
		} else if (!/^[()\[\]*·•.]$/.test(token)) {
			return false;
		}
	}
	const elementCount = (core.match(/[A-Z][a-z]?/g) || []).length;
	return hasElement && (hasNumber || elementCount >= 2);
}

function isChemFormula(word) {
	if (!word || word.length < 2) return false;
	const stripped = stripState(word);
	const parsed = parseCharge(stripped.core);
	if (/^\d+$/.test(parsed.core)) return false;
	let body = parsed.core;
	const coeff = body.match(/^(\d+)(.*)$/);
	if (coeff) {
		if (!coeff[2]) return false;
		body = coeff[2];
	}
	if (AMBIGUOUS_TWO_ELEMENT.has(body) && !parsed.charge && !stripped.state && !/\d/.test(body) && !/[()\[\]*·•.]/.test(body)) {
		return false;
	}
	if (!isChemCore(body) && !parsed.charge && !stripped.state) return false;
	const tokens = body.split(/([A-Z][a-z]?|\d+|[()\[\]*·•.])/);
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
	if (elementCount === 1 && !hasNumber && !parsed.charge && !stripped.state) return false;
	return hasElement;
}

function formatCoreChem(core) {
	let coefficient = '';
	const coeffMatch = core.match(/^(\d+)(.*)$/);
	if (coeffMatch && coeffMatch[2].length > 0) {
		coefficient = coeffMatch[1];
		core = coeffMatch[2];
	}
	const tokens = core.split(/(\d+|[()\[\]])/);
	const formattedTokens = tokens.map((token) => {
		if (!token) return '';
		return /^\d+$/.test(token) ? `_${token}` : `\\text{${token}}`;
	}).map((tok) => tok.startsWith('_') && /^_\d+$/.test('_'+tok.slice(1)) ? `_{${tok.slice(1)}}` : tok);
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
