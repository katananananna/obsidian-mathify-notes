const { Plugin, PluginSettingTab, Setting, Notice } = require('obsidian');

const DEFAULT_SETTINGS = {
	autoConvert: true,
	convertChemistry: true,
	convertEnglishLogicWords: false
};

module.exports = class MathShorthandPlugin extends Plugin {
	async onload() {
		await this.loadSettings();
	}
	async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
	async saveSettings() { await this.saveData(this.settings); }
};
