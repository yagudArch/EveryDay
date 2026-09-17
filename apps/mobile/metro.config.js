// Expo CNG: native папки (android/, ios/) в репозитории не хранятся и здесь не создаются.
// Этот конфиг нужен только для двух вещей: корректная работа npm workspaces (хоisting
// зависимостей в корневой node_modules) и bundling пакета @everyday/contracts напрямую
// из TypeScript-исходника (тот же файл, что указан в tsconfig paths), чтобы Metro
// не зависел от наличия packages/contracts/dist.
const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');
const contractsSource = path.resolve(workspaceRoot, 'packages', 'contracts', 'src', 'index.ts');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@everyday/contracts' && fs.existsSync(contractsSource)) {
    return { type: 'sourceFile', filePath: contractsSource };
  }
  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
