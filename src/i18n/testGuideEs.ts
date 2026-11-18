// Para qué puede servir cada producto y cada cuánto repetirlo, en español (España).
// Mismos ids que src/data/testGuide.ts. Sin marcas de género: el texto vale para cualquiera.

import type { TestGuide } from '@/data/testGuide';

const STI: TestGuide = {
  useful: 'Si tienes una pareja nueva o una relación sin preservativo, o simplemente para salir de dudas. Muchas infecciones no dan síntomas.',
  repeat: 'Después de cada posible exposición (algunas tardan unas semanas en detectarse) y cada 3-12 meses si tienes parejas nuevas.',
};

const GENETIC_REPEAT = 'Una vez: tu ADN no cambia.';
const BREATH_REPEAT = 'Una vez. Solo se repite si cambian los síntomas o te lo pide tu médico.';

export const TEST_GUIDE_ES: Record<string, TestGuide> = {
  membership: {
    useful:
      'Para ver cómo estás en conjunto y seguirlo en el tiempo: colesterol y ApoB, azúcar, inflamación, enzimas del hígado, creatinina, hierro y vitaminas, TSH, testosterona y tu Edad KUOVA.',
    repeat: 'Ya va incluido: el análisis Baseline cada año y el mismo seguimiento a los 6 meses, para ver si lo que has cambiado funciona.',
  },
  premium: {
    useful:
      'Si quieres una foto más completa una vez al año (tiroides, hormonas, riñón), o estás haciendo cambios (dieta, entrenamiento, tratamiento) y quieres ver su efecto antes.',
    repeat: 'Ya va incluido: el análisis Kuova Premium cada año y un seguimiento cada 3 meses.',
  },

  // Añadir a tu seguimiento
  vitamin_d: {
    useful: 'Si tu vitamina D salió por debajo del rango del laboratorio y quieres ver si lo que has cambiado (sol, dieta) se nota.',
    repeat: 'En tu seguimiento, a los 6 meses. Ten en cuenta que entre medias cambia la estación: la vitamina D sube en verano y baja en invierno.',
  },
  b12_folate: {
    useful: 'Si tu B12 salió por debajo del rango o tu VCM (el tamaño de los glóbulos rojos) salió por encima. También si comes poca o ninguna carne.',
    repeat: 'En tu seguimiento. Si sigue por debajo del rango, el siguiente paso es hablarlo con tu médico para buscar la causa.',
  },
  magnesium: {
    useful: 'Si tu magnesio salió por debajo del rango del laboratorio.',
    repeat: 'En tu seguimiento, a los 6 meses.',
  },
  calcium: {
    useful: 'Si tu calcio salió fuera del rango, para confirmarlo con una segunda medida.',
    repeat: 'En tu seguimiento. Si sale por encima del rango dos veces, coméntalo con tu médico.',
  },
  sodium_potassium: {
    useful: 'Si salieron fuera del rango, o tomas medicación para la tensión o diuréticos, que pueden moverlos.',
    repeat: 'En tu seguimiento. Si siguen fuera del rango, coméntalo con tu médico: es quien ajusta tu medicación.',
  },
  insulin: {
    useful: 'Si tu insulina en ayunas o tu HOMA-IR salieron por encima del rango, para ver la tendencia junto a tu glucosa y tu HbA1c.',
    repeat: 'En tu seguimiento, a los 6 meses, en el mismo laboratorio.',
  },
  psa: {
    useful: 'Para hombres de 50 años o más (45 con antecedentes en la familia) que eligen el cribado de próstata después de conocer sus pros y sus contras.',
    repeat: 'Si lo eliges, cada cuánto repetirlo lo decides con tu médico, según tu edad y tu resultado.',
  },

  // Confirmar y ampliar
  thyroid: {
    useful:
      'Si tu TSH salió fuera del rango del laboratorio (una sola medida no basta), o si tu médico te controla la tiroides y quieres hacerlo en la misma extracción que tu seguimiento.',
    repeat: 'Una vez, para confirmar. Si tu médico te controla la tiroides, es quien marca cada cuánto.',
  },
  low_testosterone: {
    useful:
      'Para hombres con la testosterona por debajo del rango del laboratorio y síntomas como cansancio o menos deseo sexual. La testosterona cambia de un día a otro, así que se confirma con otra extracción por la mañana.',
    repeat: 'Una vez, para confirmar. Si se confirma por debajo del rango, el siguiente paso es tu médico.',
  },
  androgens: {
    useful: 'Para mujeres con la testosterona por encima del rango del laboratorio, o que han marcado ciclos irregulares.',
    repeat: 'Una vez. Con el resultado, conviene hablarlo con tu ginecólogo.',
  },
  urine_albumin: {
    useful: 'Si tu filtrado salió por debajo del rango o hubo proteína en la orina, o si has marcado diabetes, prediabetes o tensión alta.',
    repeat: 'Con diabetes o tensión alta, las guías la piden al menos una vez al año. Si sale por encima del rango, se confirma con otra muestra.',
  },

  // Objetivos
  ovarian_reserve: {
    useful: 'Si quieres conocer tu reserva ovárica, por ejemplo para planificar cuándo buscar un embarazo, y hablarlo con tu ginecólogo.',
    repeat: 'Solo cuando tengas una pregunta concreta. No se repite de rutina.',
  },
  hormones_f: {
    useful: 'Si tu ciclo es irregular, tienes molestias que cambian con el ciclo o quieres entender tus hormonas y hablarlo con tu ginecólogo.',
    repeat: 'Solo con una pregunta concreta, o cuando cambien tu ciclo o tus síntomas.',
  },
  hormones_m: {
    useful: 'Si notas cansancio, menos deseo sexual o cambios de ánimo y quieres mirar tus hormonas.',
    repeat: 'Solo con síntomas o una pregunta concreta. Lo que salga fuera del rango se repite para confirmarlo.',
  },
  preconception: {
    useful: 'Si estás planificando un embarazo. Con el resultado, tu médico te dice si conviene alguna vacuna antes de buscarlo.',
    repeat: 'Una vez, antes de buscar el embarazo.',
  },
  coeliac: {
    useful: 'Si tienes molestias digestivas a menudo, el hierro bajo sin una causa clara, o un familiar de primer grado con celiaquía.',
    repeat: 'Una vez. Solo se repite si cambian los síntomas o te lo pide tu médico.',
  },
  sibo: {
    useful: 'Si llevas semanas con hinchazón o gases frecuentes (por ejemplo, registrados en Digestión).',
    repeat: BREATH_REPEAT,
  },
  lactose: {
    useful: 'Si notas molestias, hinchazón o diarrea después de tomar lácteos.',
    repeat: BREATH_REPEAT,
  },
  fructose: {
    useful: 'Si notas molestias o hinchazón después de la fruta, los zumos o los dulces.',
    repeat: BREATH_REPEAT,
  },
  hpylori: {
    useful: 'Si tienes molestias de estómago a menudo (ardor, dolor o pesadez en la parte alta del abdomen).',
    repeat: 'Una vez. Después de un tratamiento, solo si te lo pide tu médico.',
  },
  sti_basic: STI,
  sti_full: STI,
  training_load: {
    useful:
      'Si entrenas mucho y notas que te recuperas peor. Lo que más importa para el deporte (hemograma, ferritina, vitamina D, magnesio, testosterona) ya va en tu análisis anual.',
    repeat: 'Cada 3-6 meses, mejor en el mismo momento de tu temporada.',
  },
  omega3: {
    useful: 'Si quieres saber si tu dieta lleva suficiente pescado azul, o ver el efecto de un cambio en tu dieta.',
    repeat: 'Unos 4 meses después de un cambio en la dieta: es lo que tarda en notarse.',
  },
  allergy_alex: {
    useful: 'Si tienes síntomas de alergia (estornudos, picor de ojos o de piel, molestias con algún alimento) y quieres llevar el resultado a tu alergólogo.',
    repeat: 'Una vez. Solo se repite si te lo pide tu alergólogo.',
  },
  gen_carrier: {
    useful: 'Si piensas tener hijos, a ser posible antes del embarazo, o si hay una enfermedad hereditaria en tu familia o en la de tu pareja.',
    repeat: GENETIC_REPEAT,
  },
  gen_coeliac: {
    useful:
      'Si tienes familiares con celiaquía, o para descartarla cuando ya comes sin gluten y la prueba de anticuerpos deja de servir.',
    repeat: GENETIC_REPEAT,
  },
  gen_intolerance: {
    useful:
      'Si los lácteos, la fruta o algunos alimentos te sientan mal a menudo y quieres saber si hay una parte genética. Las pruebas de aliento dicen cómo los absorbes hoy.',
    repeat: GENETIC_REPEAT,
  },
  gen_hfe: {
    useful: 'Si la ferritina y la saturación de transferrina te salen altas, o un familiar cercano tiene hemocromatosis.',
    repeat: GENETIC_REPEAT,
  },
  gen_thrombophilia: {
    useful:
      'Si tú o un familiar cercano habéis tenido una trombosis, sobre todo de jóvenes, antes de empezar con anticonceptivos hormonales o de buscar un embarazo.',
    repeat: GENETIC_REPEAT,
  },
  gen_apoe: {
    useful: 'Si quieres conocerlo después de pensarlo con un profesional: el resultado puede afectarte a ti y a tu familia.',
    repeat: GENETIC_REPEAT,
  },
  doctor_request: {
    useful: 'Si tu médico te ha pedido pruebas: si las haces en la extracción de tu seguimiento, te ahorras una visita.',
    repeat: 'Cuando te lo diga tu médico.',
  },
};
