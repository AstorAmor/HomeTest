// Español de España para Mediciones, medidas y fuerza de agarre (2026-11-17). En su propio archivo para no chocar con otras sesiones; index.ts lo junta
// DESPUÉS de es.ts, así que una clave que ya esté en es.ts y se repita aquí gana esta traducción.
export const measuresEs: Record<string, string> = {
  // Fuerza de agarre (como el VO2max): ficha, registro y Mediciones. Los niveles van con «nivel» para que concuerden
  // (en español «fuerza» es femenino y los del VO2max, «Bueno para tu edad», no valdrían)
  'Grip strength': 'Fuerza de agarre',
  'Low level for your age': 'Nivel bajo para tu edad',
  'Fair level for your age': 'Nivel aceptable para tu edad',
  'Good level for your age': 'Buen nivel para tu edad',
  'Excellent level for your age': 'Nivel excelente para tu edad',
  'Superior level for your age': 'Nivel superior para tu edad',
  'The greatest force your hand can squeeze, in kilograms. It is a simple marker of overall muscle strength: in large population studies, higher grip strength for your age goes with better mobility and healthier ageing.':
    'La fuerza máxima con la que aprieta tu mano, en kilos. Es un indicador sencillo de la fuerza muscular general: en grandes estudios de población, más fuerza de agarre para tu edad se asocia a mejor movilidad y a un envejecimiento más sano.',
  'With a hand dynamometer, seated, elbow bent at 90° and wrist straight. Squeeze as hard as you can for about 3 seconds, 3 times with each hand, resting in between, and log the best attempt. Physiotherapists and sports medicine centres have one; a home dynamometer also works if you always use the same one.':
    'Con un dinamómetro de mano, en una silla, con el codo a 90° y la muñeca recta. Aprieta al máximo unos 3 segundos, 3 veces con cada mano y descansando entre medias, y apunta el mejor intento. Lo tienen fisioterapeutas y centros de medicina deportiva; uno de casa también sirve si usas siempre el mismo.',
  'kg, best attempt. Low: below the 25th percentile; fair: 25th-50th; good: 50th-75th; excellent: above the 75th.':
    'kg, mejor intento. Bajo: por debajo del percentil 25; aceptable: del 25 al 50; bueno: del 50 al 75; excelente: por encima del 75.',
  'Source: Dodds RM et al. PLoS One 2014, centiles from 12 general population studies in Great Britain (about 50,000 people aged 4 to 90+, best of up to 6 attempts with both hands). Each row is the value at its central age.':
    'Fuente: Dodds RM y cols. PLoS One 2014, percentiles de 12 estudios de población general en Gran Bretaña (unas 50.000 personas de 4 a más de 90 años; el mejor de hasta 6 intentos con las dos manos). Cada fila da el valor de su edad central.',
  'Log your best attempt with a hand dynamometer to see your own line here.': 'Apunta tu mejor intento con un dinamómetro de mano para ver aquí tu propia línea.',
  'Best of your attempts: 3 with each hand, seated, elbow at 90°.': 'El mejor de tus intentos: 3 con cada mano, en una silla y con el codo a 90°.',
};
