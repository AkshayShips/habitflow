const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// expo-sqlite on web ships a WebAssembly binary.
config.resolver.assetExts.push('wasm');
config.server = {
  ...config.server,
  // SharedArrayBuffer (used by SQLite on web) needs cross-origin isolation in dev too.
  enhanceMiddleware: (middleware) => (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  },
};
module.exports = config;
