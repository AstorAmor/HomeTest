// Permite exportar la web como SPA estática para Vercel sin cambiar el modo "server"
// que usa el desarrollo local (rutas /api):  WEB_OUTPUT=single npx expo export -p web
module.exports = ({ config }) => ({
  ...config,
  web: { ...config.web, output: process.env.WEB_OUTPUT || config.web?.output },
});
