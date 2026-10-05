import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Config mínima para testear lógica de negocio pura en src/logic/** sin
// arrastrar Expo/Metro/React Native. Si en el futuro hace falta testear
// componentes, esto se puede ampliar (o convivir con jest-expo aparte) --
// de momento el motor de reglas no importa nada de React Native.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
