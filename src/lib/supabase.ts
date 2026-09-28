import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Cliente de Supabase. Si faltan las variables de entorno, la app funciona en
// modo demo (login simulado + datos en AsyncStorage), como antes de migrar.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = !!url && !!publishableKey;

// En la exportación web del servidor no hay window: sin storage persistente ahí.
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        storage: canPersist ? AsyncStorage : undefined,
        autoRefreshToken: true,
        persistSession: canPersist,
        detectSessionInUrl: false,
      },
    })
  : null;

export const supabaseUrl = url ?? '';
export const supabasePublishableKey = publishableKey ?? '';

// Usuario con sesión activa (lo mantiene AuthContext). Los repositorios lo
// consultan para decidir si leer/escribir en Supabase o en local.
let currentUserId: string | null = null;
export const setCurrentUserId = (id: string | null) => {
  currentUserId = id;
};
export const getCurrentUserId = () => currentUserId;
export const isRemoteActive = () => !!supabase && !!currentUserId;

// El token solo se refresca con la app en primer plano (recomendación de Supabase para RN).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
