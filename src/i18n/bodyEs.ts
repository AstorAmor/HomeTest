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
  // ── Apuntar el peso: la pista bajo la casilla de la grasa ──
  'With your measurements from {date} it comes to {v} %. If your scale gives a different figure, type it in and we will use that one.':
    'Con tus medidas del {date} sale {v} %. Si tu báscula da otra cifra, escríbela y usaremos esa.',
  'With sample data it comes to {v} %. If your scale gives a different figure, type it in and we will use that one.':
    'Con datos de ejemplo sale {v} %. Si tu báscula da otra cifra, escríbela y usaremos esa.',
  // ── Demo y cuentas de prueba: altura y persona de ejemplo cuando el perfil está a medias ──
  'With a sample height ({h} cm).': 'Con una altura de ejemplo ({h} cm).',
  'With a sample height ({h} cm). Add yours in your profile.': 'Con una altura de ejemplo ({h} cm). Añade la tuya en tu perfil.',
  'With sample details ({who}). Add yours in your profile.': 'Con datos de ejemplo ({who}). Añade los tuyos en tu perfil.',
  'a {age}-year-old man': 'hombre de {age} años',
};
