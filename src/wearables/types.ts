// Formato PROPIO de HomeTest para datos de wearables.
// Ninguna pantalla debe leer el formato de ningún proveedor:
// cada proveedor tiene un adaptador en src/wearables/providers/ que traduce a
// estos tipos. Cambiar de proveedor = escribir un adaptador nuevo.

// huawei_dummy: datos de prueba mientras la cuenta de desarrollador de Huawei no
// tenga acceso a pulso y sueño. huawei: conexión directa (Health Kit, pendiente).
// health_connect: Android (Xiaomi, Garmin, Oura, Samsung, Google...).
export type WearableProviderId = 'huawei_dummy' | 'huawei' | 'health_connect';

// Métricas canónicas que usa HomeTest. 'other' conserva lo que aún no mapeamos.
export type WearableMetric =
  | 'steps'
  | 'resting_heart_rate'
  | 'heart_rate_avg'
  | 'hrv'
  | 'sleep_duration'
  | 'active_energy'
  | 'body_temperature'
  | 'other';

export interface DailyWearableRecord {
  date: string; // YYYY-MM-DD
  metric: WearableMetric;
  value: number;
  sourceName: string; // p. ej. "Huawei Health", "Garmin Connect"
  provider: WearableProviderId;
  rawTypeId: string; // id del tipo en el proveedor, para depurar el mapeo
  rawTypeName: string; // nombre del tipo en el proveedor
}

export interface ConnectedSource {
  sourceName: string;
  connectedAt: string | null;
}
