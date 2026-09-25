// Tipos para la futura integración con wearables (Oura, Whoop, Apple Health,
// Garmin...). NO hay ninguna integración real todavía -- esto es solo la
// forma de los datos que el motor de reglas y el LLM de síntesis van a
// consumir, para poder diseñar RecommendationInput sin bloquear en la
// decisión de qué proveedor usar (Terra API / HealthKit nativo / Health
// Connect / APIs propias de cada marca). Ver prompts/ para el research que
// decidirá el proveedor real.

export type WearableSource = 'oura' | 'whoop' | 'apple_health' | 'health_connect' | 'garmin';

// Resumen de un día. Todos los campos son opcionales porque no todos los
// dispositivos miden todo (p.ej. Apple Health básico no da HRV de calidad
// clínica sin un Apple Watch).
export interface WearableDailySummary {
  date: string; // ISO date (día natural, no timestamp)
  source: WearableSource;
  sleepDurationMinutes: number | null;
  sleepScore: number | null; // 0-100, escala propia de cada proveedor -- no comparar entre proveedores sin normalizar
  hrvMs: number | null; // media nocturna en milisegundos, si el proveedor la da
  restingHeartRateBpm: number | null;
  steps: number | null;
  activeCalories: number | null;
  readinessScore: number | null; // 0-100, si el proveedor lo calcula (Oura/Whoop lo tienen, Apple Health no)
}

// Interfaz mínima que implementará cada integración real. El motor de reglas
// y el LLM de síntesis solo dependen de esta interfaz, nunca de un SDK
// concreto -- así se puede cambiar de proveedor (o soportar varios a la vez)
// sin tocar la lógica de recomendaciones.
export interface WearableDataProvider {
  source: WearableSource;
  isConnected(userId: string): Promise<boolean>;
  getDailySummaries(userId: string, fromDate: string, toDate: string): Promise<WearableDailySummary[]>;
}

// Agregado que consume RecommendationInput: no todo el histórico, solo lo
// relevante a la ventana de tiempo previa al análisis (p.ej. últimas 2-4
// semanas), ya resumido para no mandarle al LLM cientos de filas diarias.
export interface WearableContext {
  windowDays: number;
  summaries: WearableDailySummary[];
  avgSleepDurationMinutes: number | null;
  avgHrvMs: number | null;
  avgRestingHeartRateBpm: number | null;
  avgReadinessScore: number | null;
}
