const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Conservar los nombres de funciones y componentes al minificar. Sin esto, en las webs publicadas
// el modo Señalar apunta a "v" o "y" en vez de "MyDataScreen › MetricCard", y las notas no se
// pueden localizar en el código. Cuesta unos pocos KB más de bundle.
const minifier = config.transformer.minifierConfig ?? {};
config.transformer.minifierConfig = {
  ...minifier,
  keep_fnames: true,
  mangle: { ...(minifier.mangle ?? {}), keep_fnames: true },
  compress: { ...(minifier.compress ?? {}), keep_fnames: true },
};

module.exports = config;
