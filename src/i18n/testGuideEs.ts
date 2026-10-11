// Para qué puede servir cada producto y cada cuánto repetirlo, en español (España).
// Mismos ids que src/data/testGuide.ts. Sin marcas de género: el texto vale para cualquiera.

import type { TestGuide } from '@/data/testGuide';

const STI: TestGuide = {
  useful: 'Si tienes una pareja nueva o una relación sin preservativo, o simplemente para salir de dudas. Muchas infecciones no dan síntomas.',
  repeat: 'Después de cada posible exposición (algunas tardan unas semanas en detectarse) y cada 3-12 meses si tienes parejas nuevas.',
};

export const TEST_GUIDE_ES: Record<string, TestGuide> = {
  membership: {
    useful: 'Para saber cómo está todo tu cuerpo y seguirlo en el tiempo, no solo una cosa.',
    repeat: 'Ya va incluido: panel completo al empezar y seguimiento a los 6 meses.',
  },
  premium: {
    useful: 'Si estás haciendo cambios (dieta, entrenamiento, tratamiento) y quieres ver su efecto pronto.',
    repeat: 'Ya va incluido: una analítica cada 3 meses.',
  },
  essential: {
    useful: 'Un chequeo general si hace tiempo que no te haces una analítica o si no te notas bien y no sabes por qué.',
    repeat: 'Una vez al año, o a los 3 meses de cambiar hábitos si algo salió fuera de rango.',
  },
  weight: {
    useful: 'Si te cuesta perder peso aunque comas bien y te muevas, o tu peso ha cambiado sin un motivo claro.',
    repeat: 'A los 3-6 meses de hacer cambios, para ver si los valores mejoran.',
  },
  performance: {
    useful: 'Si entrenas a menudo y notas que te recuperas peor, te lesionas más o rindes por debajo de lo habitual.',
    repeat: 'Cada 3-6 meses, mejor en el mismo momento de tu temporada.',
  },
  vitamin_d: {
    useful: 'Si te da poco el sol (otoño e invierno, trabajo en interior), te notas sin energía o de bajón, o quieres comprobar que el suplemento funciona.',
    repeat: 'Una vez al año, mejor al final del invierno; a los 3 meses de empezar o cambiar un suplemento.',
  },
  vitamin_b: {
    useful: 'Si comes poca carne o ninguna, te notas sin energía, tienes hormigueos o tomas metformina u omeprazol desde hace tiempo.',
    repeat: 'Una vez al año; a los 3 meses de empezar un suplemento.',
  },
  vitamins: {
    useful: 'Si te notas sin energía, sigues una dieta restrictiva o te da poco el sol: mira las tres vitaminas que más a menudo están bajas.',
    repeat: 'Una vez al año; a los 3 meses de empezar a tomar suplementos.',
  },
  iron: {
    useful: 'Si te notas sin energía, se te cae más el pelo, tienes reglas abundantes o comes poca carne: es lo primero que conviene descartar cuando falta energía.',
    repeat: 'Una vez al año; a los 3 meses de empezar a tomar hierro, para ver si funciona.',
  },
  cycle_hormones: {
    useful: 'Si tu ciclo es irregular, tienes síntomas premenstruales fuertes o quieres entender cómo cambian tus hormonas a lo largo del mes.',
    repeat: 'Cuando cambien tu ciclo o tus síntomas, o cuando te lo indique tu médico.',
  },
  cortisol: {
    useful: 'Si llevas una temporada de estrés, duermes mal o te despiertas sin energía.',
    repeat: 'A los 3 meses de hacer cambios (sueño, estrés, rutina). La muestra se toma por la mañana.',
  },
  stress: {
    useful: 'Si el estrés dura semanas o meses y lo notas en el sueño, la energía o el ánimo.',
    repeat: 'Cada 3-6 meses mientras trabajas en ello.',
  },
  fertility_f: {
    useful: 'Si piensas en quedarte embarazada ahora o en los próximos años y quieres una foto de tu fertilidad.',
    repeat: 'Una vez al año mientras lo planificas.',
  },
  thyroid: {
    useful: 'Si te notas sin energía o con frío, ha cambiado tu peso o tu ánimo o se te cae más el pelo: el tiroides está detrás más a menudo de lo que parece.',
    repeat: 'Una vez al año; a las 6-8 semanas de un cambio en la medicación del tiroides, si te lo pide tu médico.',
  },
  thyroid_adv: {
    useful: 'Si hay problemas de tiroides en tu familia o una TSH anterior salió fuera de rango: los anticuerpos dicen si es autoinmune.',
    repeat: 'Las hormonas, una vez al año; los anticuerpos suelen bastar una vez, salvo que tu médico diga otra cosa.',
  },
  amh: {
    useful: 'Para conocer tu reserva ovárica si piensas en cuándo tener hijos o en congelar óvulos.',
    repeat: 'Una vez al año si lo estás planificando.',
  },
  testosterone: {
    useful: 'Si notas menos energía, menos deseo sexual o el ánimo bajo, o pierdes músculo con más facilidad.',
    repeat: 'A los 3-6 meses de hacer cambios. La muestra se toma por la mañana.',
  },
  t1d_antibodies: {
    useful: 'Si tu madre, tu padre, un hermano o un hijo tiene diabetes tipo 1: puede mostrar el riesgo años antes de que aparezcan síntomas.',
    repeat: 'Normalmente una vez; tu médico te dirá si hay que repetirlo.',
  },
  cardio: {
    useful: 'Si hay problemas de corazón en tu familia, has tenido el colesterol alto, fumas o tomas medicación para el colesterol o la tensión.',
    repeat: 'Una vez al año; a los 3 meses de cambiar de dieta o de medicación.',
  },
  diabetes: {
    useful: 'Si tienes más sed o vas más al baño, hay diabetes en tu familia, o has ganado peso o te mueves poco.',
    repeat: 'Una vez al año; cada 3-6 meses si has tenido valores altos.',
  },
  psa: {
    useful: 'Para hombres a partir de los 50 años (o 45 con antecedentes familiares) que lo hayan hablado con su médico.',
    repeat: 'Cada 1-2 años, según lo que acuerdes con tu médico.',
  },
  lpa: {
    useful: 'Si alguien de tu familia tuvo un infarto o un ictus joven: la Lp(a) se hereda y un colesterol normal no la descarta.',
    repeat: 'Normalmente una vez en la vida: apenas cambia.',
  },
  coeliac: {
    useful: 'Si tienes hinchazón, diarrea o el hierro bajo sin motivo claro, o alguien de tu familia es celíaco. Sigue comiendo gluten antes de la prueba.',
    repeat: 'Si los síntomas siguen o diagnostican a un familiar.',
  },
  fructose: {
    useful: 'Si la fruta, los zumos o la miel te dan gases, hinchazón o diarrea.',
    repeat: 'Normalmente una vez.',
  },
  lactose: {
    useful: 'Si la leche o los lácteos te dan gases, hinchazón o diarrea.',
    repeat: 'Normalmente una vez.',
  },
  lactose_fructose: {
    useful: 'Si te hinchas después de comer y no sabes si es por los lácteos, por la fruta o por las dos cosas.',
    repeat: 'Normalmente una vez.',
  },
  sibo: {
    useful: 'Si te hinchas casi a diario, sobre todo al poco de comer, o tienes gases y cambios en el ritmo intestinal.',
    repeat: 'Después del tratamiento, si te lo pide tu médico.',
  },
  digestive_pack: {
    useful: 'Si tu digestión te da guerra y quieres descartar las tres causas más habituales de una vez.',
    repeat: 'Normalmente una vez; el SIBO, otra vez después del tratamiento si te lo pide tu médico.',
  },
  sti_4: STI,
  sti_7: STI,
  sti_11: STI,
  consult_digestive: {
    useful: 'Cuando tengas tus resultados de intolerancias o SIBO y quieras que un médico te los explique y te diga los siguientes pasos.',
    repeat: 'Cada vez que tengas resultados nuevos.',
  },
  consult_sti: {
    useful: 'Cuando tengas tus resultados de ITS y quieras que un médico te los explique y te diga los siguientes pasos.',
    repeat: 'Cada vez que tengas resultados nuevos.',
  },
};
