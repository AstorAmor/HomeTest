// Español de España para Peso → composición corporal estimada con las medidas (cinta y pliegues). En su propio
// archivo para no chocar con los cambios que entran en es.ts desde otras sesiones; index.ts lo junta con es.ts.
export const bodyEs: Record<string, string> = {
  // ── Composición corporal estimada con las medidas (Peso, 2026-11-16) ──
  'Fat-free mass': 'Masa sin grasa',
  'Body fat estimated from your skinfolds on {date}.': 'Grasa estimada con tus pliegues del {date}.',
  'Body fat estimated from your tape measure (neck, waist and height) on {date}.': 'Grasa estimada con tu cinta métrica (cuello, cintura y altura) del {date}.',
  'Body fat estimated from your tape measure (neck, waist, hips and height) on {date}.': 'Grasa estimada con tu cinta métrica (cuello, cintura, cadera y altura) del {date}.',
  'It is an estimate: compare it between measurements taken the same way. If you type the body fat from your scale when you weigh in, we will use that instead.':
    'Es una estimación: compárala entre mediciones hechas igual. Si al pesarte apuntas la grasa que da tu báscula, usaremos esa.',
  'Last figure from your scale: {v} % on {date}.': 'Lo último de tu báscula: {v} % el {date}.',
  // ── Medidas: para qué sirven y la grasa estimada con la cinta ──
  'With them we work out your waist / height and estimate your body fat and body composition.': 'Con ellas calculamos tu cintura / altura y estimamos tu grasa y tu composición corporal.',
  'Estimated body fat (tape)': 'Grasa estimada (cinta)',
  'Estimate from your neck, waist and height; compare it between measurements taken the same way.': 'Estimación a partir de tu cuello, tu cintura y tu altura; compárala entre mediciones hechas igual.',
  'Estimate from your neck, waist, hips and height; compare it between measurements taken the same way.':
    'Estimación a partir de tu cuello, tu cintura, tu cadera y tu altura; compárala entre mediciones hechas igual.',
  'US Navy circumference formula.': 'Fórmula de perímetros de la Marina de EE. UU.',
  'For a body fat estimate with the tape we need your sex and height in your profile: the formula depends on them.':
    'Para estimar tu grasa con la cinta necesitamos tu sexo y tu altura en el perfil: la fórmula depende de ellos.',
  'With these measurements the formula does not give an estimate.': 'Con estas medidas la fórmula no da una estimación.',
  // ── Demo y cuentas de prueba: altura y persona de ejemplo cuando el perfil está a medias ──
  'With a sample height ({h} cm).': 'Con una altura de ejemplo ({h} cm).',
  'With a sample height ({h} cm). Add yours in your profile.': 'Con una altura de ejemplo ({h} cm). Añade la tuya en tu perfil.',
  'With sample details ({who}). Add yours in your profile.': 'Con datos de ejemplo ({who}). Añade los tuyos en tu perfil.',
  'a {age}-year-old man': 'hombre de {age} años',
  // ── Apuntar el peso con las medidas y la composición (2026-11-18) ──
  'Tape measure and skinfolds': 'Cinta métrica y pliegues',
  'Not logged yet': 'Sin apuntar todavía',
  'Sample data for now': 'Por ahora, datos de ejemplo',
  'From your measurements': 'Con tus medidas',
  'From your scale': 'De tu báscula',
  'With your neck, waist and height, or with your 3 skinfolds, we work it out.': 'Con el cuello, la cintura y tu altura, o con los 3 pliegues, la calculamos.',
  'With your neck, waist, hips and height, or with your 3 skinfolds, we work it out.':
    'Con el cuello, la cintura, la cadera y tu altura, o con los 3 pliegues, la calculamos.',
  'To work it out from your measurements we need your sex in your profile.': 'Para calcularla con tus medidas hace falta tu sexo en el perfil.',
  'Saving removes what you copied from your scale for this weigh-in.': 'Al guardar se quita lo copiado de la báscula en esta pesada.',
  // ── El IMC en una línea y el anillo de la composición (2026-11-18) ──
  'The band is the WHO range for adults.': 'La franja es el rango de la OMS para adultos.',
  'Water is spread across everything else, so it goes in the inner ring and not as one more part.':
    'El agua está repartida en todo lo demás: por eso va en el anillo de dentro y no como una parte más.',
  'Copy it from your scale or estimate it from your measurements when you log your weight.':
    'Cópiala de tu báscula o estímala con tus medidas al apuntar el peso.',
};
