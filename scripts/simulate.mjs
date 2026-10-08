// Simulador de usuarios y avisos: npm run simulate (opciones en simulation/cli.ts).
// Ejecuta el TypeScript de la app con Vite (ya instalado para los tests), sin compilar nada aparte.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runnerImport } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { module } = await runnerImport(path.join(root, 'simulation', 'cli.ts'), {
  root,
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': path.join(root, 'src') } },
});
process.exitCode = await module.main(process.argv.slice(2), root);
