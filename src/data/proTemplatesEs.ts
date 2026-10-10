import type { TemplateDraft } from './proTemplates';

// Plantillas de ejemplo en español de España (las mismas que SAMPLE_TEMPLATES, escritas como las
// escribiría una médica, de tú). Se usan cuando la app está en español: en la demo del portal y
// con "Empezar con plantillas de ejemplo" en una cuenta real. Los huecos [ ] son lo que cambia de
// un paciente a otro; [nombre] y [doctora] se rellenan solos.
export const SAMPLE_TEMPLATES_ES: TemplateDraft[] = [
  {
    title: 'Ferritina baja y cansancio',
    topic: 'energy',
    keywords: ['ferritina', 'ferritin', 'hierro', 'iron', 'cansancio', 'cansada', 'tired'],
    body: `Hola, [nombre]:

Gracias por tu mensaje. Tu ferritina está en [valor] ng/mL, lo que indica que tus reservas de hierro están bajas. Encaja con el cansancio que me cuentas.

Te propongo:
• Alimentos ricos en hierro casi todos los días (carne roja 2-3 veces por semana, lentejas, garbanzos, espinacas), acompañados de vitamina C (naranja, pimiento, kiwi).
• Nada de té ni café en la hora de antes y de después de las comidas: reducen el hierro que absorbes.
• [Algo específico para esta paciente]

Repetimos la analítica dentro de [8-12 semanas]. Si antes notas falta de aire, palpitaciones o reglas muy abundantes, dímelo.

Un saludo,
[doctora]`,
  },
  {
    title: 'Vitamina D por debajo del rango',
    topic: 'energy',
    keywords: ['vitamina d', 'vitamin d', '25-oh'],
    body: `Hola, [nombre]:

Tu vitamina D está en [valor] ng/mL; buscamos que esté por encima de 30. Es muy frecuente, sobre todo después del invierno o si pasas casi todo el día en interiores.

La mayor parte de la vitamina D viene del sol: 15-20 minutos al aire libre a mediodía, con los brazos descubiertos, casi todos los días, ayudan mucho en primavera y verano. Con la alimentación sola (pescado azul, huevos) rara vez se corrige.

[Indicaciones sobre suplemento, si procede]

La volvemos a mirar dentro de [3 meses].

Un saludo,
[doctora]`,
  },
  {
    title: 'Colesterol LDL algo alto',
    topic: 'cholesterol',
    keywords: ['ldl', 'colesterol', 'cholesterol', 'triglicéridos'],
    body: `Hola, [nombre]:

Tu colesterol LDL está en [valor] mg/dL, algo por encima de donde nos gustaría. [Contexto: antecedentes familiares, otros valores]

Los cambios que más efecto tienen:
• Más fibra: avena, legumbres, fruta y verdura todos los días.
• Aceite de oliva, frutos secos y pescado en lugar de mantequilla, embutidos y bollería.
• Al menos 150 minutos de actividad a la semana (caminar a buen paso cuenta).

Estos cambios suelen notarse en los resultados en unos 3 meses. Repetimos la analítica dentro de [3 meses] y decidimos entonces si hace falta algo más.

Un saludo,
[doctora]`,
  },
  {
    title: 'Ciclo irregular',
    topic: 'cycle',
    keywords: ['irregular', 'regla', 'retraso', 'ciclo', 'period'],
    body: `Hola, [nombre]:

Los ciclos de entre 21 y 35 días se consideran normales, y que alguno se alargue de vez en cuando es frecuente (estrés, viajes, entrenamiento intenso, cambios de peso). Los tuyos están durando unos [duración] días desde hace [cuánto tiempo].

[Si puede haber embarazo: haz primero un test de embarazo, por favor.]

Me gustaría que miráramos [pruebas, por ejemplo TSH, prolactina y hormonas entre los días 2 y 5 del ciclo]. Mientras tanto, sigue registrando tus reglas en Kuova: con tres ciclos más veremos el patrón mucho mejor.

Un saludo,
[doctora]`,
  },
  {
    title: 'TSH algo alta (tiroides)',
    topic: 'hormones',
    keywords: ['tsh', 'tiroides', 'thyroid', 't4'],
    body: `Hola, [nombre]:

Tu TSH está en [valor] mU/L, un poco por encima del rango, con una T4 libre de [valor]. Una TSH algo alta en una sola analítica es frecuente y muchas veces se normaliza sola; puede subir tras una enfermedad, si duermes mal o con algunos suplementos (la biotina interfiere en la prueba).

Repetimos TSH y T4 libre dentro de [6-8 semanas], por la mañana, y deja la biotina 2-3 días antes. Si sigue alta, añadimos los anticuerpos del tiroides (anti-TPO).

Si estás buscando un embarazo, dímelo: en ese caso actuamos antes.

Un saludo,
[doctora]`,
  },
  {
    title: 'HbA1c en rango de prediabetes',
    topic: 'glucose',
    keywords: ['hba1c', 'glucosa', 'glucose', 'prediabetes', 'azúcar'],
    body: `Hola, [nombre]:

Tu HbA1c está en [valor] %. Entre 5,7 y 6,4 % es lo que llamamos rango de prediabetes: es un aviso, no un diagnóstico, y es el mejor momento para actuar, porque a menudo vuelve a la normalidad.

Lo que más ayuda:
• Un paseo de 10 minutos después de las comidas principales.
• Menos bebidas azucaradas y harinas refinadas; más fibra, verdura y proteína.
• Dormir 7 horas o más.
• [Si hay sobrepeso: perder un 5-7 % del peso marca una gran diferencia.]

La repetimos dentro de [3-6 meses].

Un saludo,
[doctora]`,
  },
  {
    title: 'Todos los resultados en rango',
    topic: 'blood_test',
    keywords: ['todo bien', 'todo normal', 'en rango', 'resultados', 'all normal'],
    body: `Hola, [nombre]:

Buenas noticias: todos tus valores están dentro del rango. [Algo que merezca la pena comentar]

Sigue así. Repetiría la analítica dentro de [12 meses], o antes si notas algún cambio.

Un saludo,
[doctora]`,
  },
];
