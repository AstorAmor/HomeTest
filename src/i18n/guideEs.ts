// Español de España para «Cómo funciona cada parte», sus vistas previas y «Cómo lo calculamos» (2026-11-17). En su propio archivo para no chocar con otras sesiones; index.ts lo junta
// DESPUÉS de es.ts, así que una clave que ya esté en es.ts y se repita aquí gana esta traducción.
export const guideEs: Record<string, string> = {
  // Vistas previas de «Cómo funciona cada parte» (FeaturePreview)
  'Steps · Cardio · Strength': 'Pasos · Cardio · Fuerza',
  'Vegetables · Added sugar': 'Verdura · Azúcar añadido',
  'Sleep · Water': 'Sueño · Agua',
  'Full body · 6 exercises · 45 min': 'Cuerpo completo · 6 ejercicios · 45 min',
  'Sleep, HRV and resting heart rate against your own values': 'Sueño, VFC y pulso en reposo frente a tus propios valores',
  'Sleep · last 7 nights': 'Sueño · últimas 7 noches',
  'Ferritin below the lab range: a dietitian can review the iron in your meals.': 'Ferritina por debajo del rango del laboratorio: un dietista-nutricionista puede revisar el hierro de tus comidas.',
  'Tetanus · 2023': 'Tétanos · 2023',
  // «Cómo lo calculamos» de tu estado de hoy (evidence.ts, tema readiness)
  'A score from 0 to 100 from last night’s sleep, your HRV and your resting heart rate, each compared with your own values.': 'Una cifra de 0 a 100 a partir del sueño de anoche, tu VFC y tu pulso en reposo, cada uno comparado con tus propios valores.',
  'What goes in': 'Qué datos usa',
  'Last night’s sleep, and this morning’s HRV and resting heart rate, all from your wearable. Each is compared with your own values, not with a population average.': 'El sueño de anoche y la VFC y el pulso en reposo de esta mañana, todo de tu reloj o anillo. Cada uno se compara con tus propios valores, no con la media de la población.',
  'Against your sleep goal: reaching it scores 90; each 10% short subtracts 15.': 'Frente a tu objetivo de sueño: alcanzarlo da 90 y cada 10 % que falta resta 15.',
  'HRV and resting heart rate': 'VFC y pulso en reposo',
  'Today against your previous 28 days, in standard deviations of your own day-to-day variation (HRV on a log scale). A typical day scores 65 and each deviation adds or subtracts 15: higher HRV and lower resting heart rate score higher. With less than 14 days of history, the deviation counts in proportion (half at 7 days).': 'Hoy frente a tus 28 días anteriores, en desviaciones típicas de tu propia variación diaria (la VFC, en escala logarítmica). Un día típico da 65 y cada desviación suma o resta 15: una VFC más alta y un pulso en reposo más bajo puntúan más. Con menos de 14 días de historial, la desviación cuenta en proporción (la mitad con 7 días).',
  'Weighting': 'Peso de cada parte',
  'If a signal is missing, the others share its weight. There is no score when both last night’s sleep and today’s resting heart rate are missing.': 'Si falta una señal, las demás se reparten su peso. Sin el sueño de anoche ni el pulso en reposo de hoy, no hay cifra.',
  'What the number means': 'Qué indica la cifra',
  'A typical day is around 65.': 'Un día típico ronda los 65.',
  'If you log your periods, in the luteal phase we offset the change that is normal then (resting heart rate about 2 bpm higher, HRV slightly lower), so it does not lower your score.': 'Si apuntas tus reglas, en la fase lútea descontamos el cambio que es normal entonces (el pulso en reposo, unos 2 lpm más alto; la VFC, algo más baja), así que no baja tu cifra.',
  'Not a medical measure or a diagnosis, and not your watch’s own score: each brand uses its own formula. Training load, illness, alcohol or stress only count through these three signals.': 'No es una medida médica ni un diagnóstico, ni la puntuación propia de tu reloj: cada marca usa su propia fórmula. La carga de entrenamiento, una enfermedad, el alcohol o el estrés solo cuentan a través de estas tres señales.',
};
