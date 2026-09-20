const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
	autoConvert: true,
	convertChemistry: true,
	convertEnglishLogicWords: false
};

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' '));
const AMBIGUOUS_TWO = new Set('NO CO US SO SI NI OS AS IN HE BE NE AL CA SC TI PO AT PA'.split(' '));

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
