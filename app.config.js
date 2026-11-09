// Configuración dinámica sobre app.json.
//
// 1. Web: permite exportar la web como SPA estática para Vercel sin cambiar el modo "server" que usa el
//    desarrollo local (rutas /api):  WEB_OUTPUT=single npx expo export -p web
//
// 2. «Kuova Pruebas» (APP_VARIANT=staging): segunda app conectada a la base de pruebas de Supabase
//    («Kuova pruebas»), con otro nombre, icono, identificador y esquema, para que conviva en el mismo
//    móvil con «Kuova». La base a la que apunta NO sale de aquí: la ponen las variables EXPO_PUBLIC_SUPABASE_*
//    del entorno `development` de EAS (perfiles staging/staging-ios de eas.json y npm run release:staging).
//    Ver docs/entorno-de-pruebas.md.
const IS_STAGING = process.env.APP_VARIANT === 'staging';

const staging = (config) => ({
  ...config,
  name: 'Kuova Pruebas',
  scheme: 'kuovapruebas',
  icon: './assets/images/pruebas/icon.png',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.kuovahealth.app.pruebas',
  },
  android: {
    ...config.android,
    package: 'com.kuovahealth.app.pruebas',
    adaptiveIcon: {
      ...config.android?.adaptiveIcon,
      backgroundColor: '#D6621E',
      foregroundImage: './assets/images/pruebas/android-icon-foreground.png',
      backgroundImage: './assets/images/pruebas/android-icon-background.png',
      monochromeImage: './assets/images/pruebas/android-icon-monochrome.png',
    },
  },
});

module.exports = ({ config }) => {
  const base = {
    ...config,
    web: { ...config.web, output: process.env.WEB_OUTPUT || config.web?.output },
    extra: { ...config.extra, appVariant: IS_STAGING ? 'staging' : 'production' },
  };
  return IS_STAGING ? staging(base) : base;
};
