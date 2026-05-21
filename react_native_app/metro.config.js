const { getDefaultConfig } = require('@expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// Ensure Firebase's .cjs bundles resolve in Expo/Metro.
if (!defaultConfig.resolver.sourceExts.includes('cjs')) {
  defaultConfig.resolver.sourceExts.push('cjs');
}

defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig;
