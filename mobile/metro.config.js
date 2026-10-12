// O app usa as regras do sistema (pasta packages/regras/src) sem copiar: o Metro precisa ser avisado dessa pasta.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../packages/regras/src")];
module.exports = config;
