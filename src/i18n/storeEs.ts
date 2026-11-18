// Español de España para la tienda, el buscador de pruebas, el catálogo y la suscripción en el lenguaje fino (2026-11-17). En su propio archivo para no chocar con otras sesiones; index.ts lo junta
// DESPUÉS de es.ts, así que una clave que ya esté en es.ts y se repita aquí gana esta traducción.
export const storeEs: Record<string, string> = {
  // Buscador de pruebas (TestFinderScreen): títulos como etiquetas, no como preguntas
  'Test finder': 'Buscador de pruebas',
  'Suggested tests': 'Pruebas sugeridas',
  'Already in the yearly analysis': 'Ya está en el análisis anual',
  'Based on your answers. Select the ones to order together.': 'Según tus respuestas. Marca las que quieras pedir juntas.',
  'Based on your answers, no separate test adds much: the usual causes are already in the yearly analysis.':
    'Según tus respuestas, ninguna prueba suelta aporta mucho: las causas habituales ya están en el análisis anual.',
  'Your yearly analysis': 'Tu análisis anual',
  'Alternative: the subscription': 'Alternativa: la suscripción',
  // Ya estaban en es.ts con «tests»: en la tienda y el catálogo se dice «pruebas»
  'See my tests': 'Ver las pruebas',
  'Tick at least one test': 'Marca al menos una prueba',
  'Order {n} test': 'Pedir {n} prueba',
  'Order {n} tests': 'Pedir {n} pruebas',
  // Tienda (StoreScreen)
  Subscriptions: 'Suscripciones',
  // Pago (CheckoutScreen): sin exclamaciones
  'Subscription active': 'Suscripción activa',
};
