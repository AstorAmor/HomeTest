// Español de España para Wearables en el lenguaje fino (2026-11-17). En su propio archivo para no chocar con otras sesiones; index.ts lo junta
// DESPUÉS de storeEs, así que una clave que ya esté en es.ts y se repita aquí gana esta traducción.
// Lo que ya está en es.ts (Apple Salud, Conexiones, Conectar, Sincronizar ahora, Abrir Salud, Sin permiso, Sin datos…) se usa de allí.
// Tono del fundador (2026-11-17): preciso y condensado; etiquetas, no preguntas; sin exclamaciones.
export const wearablesEs: Record<string, string> = {
  // La caja de la conexión activa
  'Last sync': 'Última sincronización',
  'Not yet': 'Todavía no',
  'Syncs automatically each time Today opens.': 'Se sincroniza automáticamente al abrir Hoy.',
  // Huawei Health en la demo: datos de ejemplo
  'Load sample Huawei data': 'Cargar datos de ejemplo de Huawei',
  'Loaded 14 days of sample Huawei Health data.': 'Cargados 14 días de datos de ejemplo de Huawei Health.',
  // Datos recibidos por tipo y sus avisos
  'Data received · 30 days': 'Datos recibidos · 30 días',
  'Only the iPhone is sending data. For a watch or ring, turn on sharing with Apple Health in its app (Oura, Garmin Connect, WHOOP, Huawei Health…), then sync.':
    'Solo llegan datos del iPhone. Para un reloj o un anillo, activa en su app (Oura, Garmin Connect, WHOOP, Huawei Health…) la opción de compartir con Salud y sincroniza.',
  'Only the phone is sending data (steps). For a watch, turn on sharing with Health Connect in its app (Fitbit, Mi Fitness, Samsung Health…), then sync.':
    'Solo llegan datos del móvil (pasos). Para un reloj, activa en su app (Fitbit, Mi Fitness, Samsung Health…) la opción de compartir con Health Connect y sincroniza.',
  'Types with no data: allow them in Health → your photo → Apps → Kuova, and check that the watch or ring app writes them to Health.':
    'Tipos sin datos: permítelos en Salud → tu foto → Apps → Kuova y comprueba que la app del reloj o del anillo los escribe en Salud.',
  'Types without permission are not read.': 'Los tipos sin permiso no se leen.',
  // Días recientes (antes «Tus últimos días», que en español suena a despedida)
  'Recent days': 'Días recientes',
};
