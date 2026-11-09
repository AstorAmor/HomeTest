import Constants from 'expo-constants';
import { isSupabaseConfigured, supabaseUrl } from '@/lib/supabase';

// ¿Es «Kuova Pruebas» (APP_VARIANT=staging, app.config.js) o, en general, una app conectada a una base que
// no es la de producción? Se marca en la pantalla de entrar para no confundir nunca las dos.
const PROD_REF = 'jpqtposdxexdvdfeorzh';

export const isStagingApp = Constants.expoConfig?.extra?.appVariant === 'staging';
export const isTestDatabase = isSupabaseConfigured && !supabaseUrl.includes(PROD_REF);
