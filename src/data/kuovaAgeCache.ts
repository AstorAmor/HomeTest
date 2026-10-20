import { getCurrentUserId } from '@/lib/supabase';
import type { KuovaAgeResult } from '@/logic/kuovaAge';

// Último cálculo de la Edad KUOVA mientras la app está abierta. Mis datos la calcula al pintarse y la
// pantalla de detalle sale ya con ella (sin esperar a leer las analíticas, que hacía aparecer la parte
// de arriba medio segundo tarde); después la vuelve a calcular por si ha cambiado algo.
let last: { userId: string | null; result: KuovaAgeResult } | null = null;

export const rememberKuovaAge = (result: KuovaAgeResult) => {
  last = { userId: getCurrentUserId(), result };
};

export const lastKuovaAge = (): KuovaAgeResult | null => (last && last.userId === getCurrentUserId() ? last.result : null);
