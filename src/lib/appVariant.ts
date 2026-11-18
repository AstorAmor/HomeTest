import Constants from 'expo-constants';
import { isTestDatabase } from '@/lib/supabase';

// ¿Es «Kuova Pruebas» (APP_VARIANT=staging, app.config.js) o, en general, una app conectada a una base que
// no es la de producción? Se marca en la pantalla de entrar para no confundir nunca las dos.

export const isStagingApp = Constants.expoConfig?.extra?.appVariant === 'staging';
export { isTestDatabase };
