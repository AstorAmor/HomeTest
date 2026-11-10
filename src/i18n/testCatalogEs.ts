// Tienda en español (España): nombre, descripción, qué incluye, «ten en cuenta», muestra y plazo de
// cada producto de src/data/testCatalog.ts, por id. Los precios no se tocan aquí. Tono neutro y sin
// diagnóstico: el resultado se compara con el rango del laboratorio y lo que lleva a un tratamiento va
// al médico (Kuova no receta).

export interface TestCopyEs {
  name: string;
  description: string;
  includes: string[];
  notes?: string;
  sample?: string;
  delivery?: string;
}

export const DELIVERY_ES = {
  centre: 'Extracción en un centro del laboratorio cerca de ti, en ayunas y por la mañana · resultados en la app en unos días laborables',
  followUp: 'Se mide en la extracción de tu seguimiento, sin otra visita',
  confirm: 'En la extracción de tu seguimiento o en una visita aparte al centro del laboratorio',
  breath: 'Prueba de aliento: el laboratorio te indica cómo prepararte y si se hace en casa o en su centro',
  swab: 'El laboratorio te indica si recoges la muestra en casa o en su centro',
  plan: 'Primera cita en un centro del laboratorio en los 7 días siguientes al alta',
  genetic: 'Después de la primera consulta · el resultado te lo explican en la segunda',
};

export const SAMPLE_ES: Record<string, string> = {
  Blood: 'Sangre',
  Urine: 'Orina',
  Breath: 'Aliento',
  'Blood · 2 draws': 'Sangre · 2 extracciones',
  'Blood + urine or swab': 'Sangre + orina o exudado',
  'Urine (men) or vaginal swab (women)': 'Orina (hombres) o exudado vaginal (mujeres)',
  'Blood and urine, at a lab centre near you': 'Sangre y orina, en un centro del laboratorio cerca de ti',
  'Depends on the test': 'Según la prueba',
  'Cheek swab or blood': 'Frotis bucal o sangre',
};

export const CATEGORY_LABEL_ES: Record<string, string> = {
  membership: 'Suscripciones',
  followup: 'Añadir a tu seguimiento',
  confirm: 'Confirmar y ampliar',
  hormonal: 'Hormonas y fertilidad',
  digestive: 'Salud digestiva',
  sexual: 'Salud sexual (ITS)',
  other: 'Deporte, alergias y omega-3',
  genetic: 'Pruebas genéticas',
  doctor: 'Si te lo pide tu médico',
};

export const CATEGORY_INTRO_ES: Record<string, string> = {
  followup:
    'Para marcadores que salieron fuera del rango en tu análisis anual y que el seguimiento no repite. Se miden en la extracción de tu seguimiento, sin otra visita.',
  confirm:
    'Un resultado fuera del rango no basta por sí solo. Estos módulos lo confirman y añaden lo que ayuda a leerlo, con tu seguimiento o en una visita aparte.',
  hormonal: 'Para una pregunta concreta sobre tu ciclo, tu fertilidad o tus hormonas. Lo que ya mide tu análisis anual no se repite.',
  digestive: 'Si tienes molestias digestivas a menudo. Si una sale positiva, el siguiente paso es llevar el resultado a tu médico: Kuova no receta tratamientos.',
  sexual: 'Confidenciales: los resultados solo los ves tú. Si algo sale positivo, el siguiente paso es tu médico.',
  other: 'Para un objetivo concreto: entrenamiento, alergias u omega-3.',
  genetic:
    'Miran variantes concretas de tu ADN. Por ley necesitan que las pida un médico, tu consentimiento por escrito y asesoramiento genético antes y después de la prueba: empiezan por una consulta, no por un pedido.',
  doctor: 'Pruebas que te pide tu médico, o un médico de la plataforma.',
};

export const TEST_COPY_ES: Record<string, TestCopyEs> = {
  membership: {
    name: 'Suscripción Kuova Basic',
    description:
      'Tu análisis anual Kuova Baseline y un seguimiento fijo a los 6 meses, tus propios informes escaneados y explicados, y tu plan personalizado en la app.',
    includes: [
      'Análisis anual Kuova Baseline: 31 pruebas de laboratorio (más la Lp(a) el primer año)',
      'Seguimiento a los 6 meses: 23 pruebas, siempre las mismas',
      'Escanea tus propios informes de análisis y entiéndelos',
      'Plan personalizado, tendencias y recordatorios',
    ],
  },
  premium: {
    name: 'Suscripción Kuova Premium',
    description:
      'Todo lo de Basic, con un análisis anual más completo, el Kuova Premium (tiroides completo, tus hormonas, ácido fólico y albúmina en orina), y el seguimiento cada 3 meses en lugar de cada 6.',
    includes: [
      'Análisis anual Kuova Premium: 42 pruebas de laboratorio (más la Lp(a) el primer año)',
      'Además de lo de Basic: tiroides completo, tus hormonas, ácido fólico y albúmina en orina',
      'Seguimiento cada 3 meses (3 al año): 23 pruebas, siempre las mismas',
      'Escanea tus propios informes de análisis y entiéndelos',
      'Plan personalizado, tendencias y recordatorios',
    ],
  },

  // Añadir a tu seguimiento
  vitamin_d: {
    name: 'Vitamina D',
    description: 'Vuelve a medir tu vitamina D en el seguimiento si salió por debajo del rango.',
    includes: ['Vitamina D (25-OH)'],
  },
  b12_folate: {
    name: 'B12 y ácido fólico',
    description: 'La B12 y el ácido fólico otra vez en tu seguimiento, si tu B12 salió baja o tus glóbulos rojos salieron grandes.',
    includes: ['Vitamina B12', 'Ácido fólico'],
  },
  magnesium: {
    name: 'Magnesio',
    description: 'Vuelve a medir tu magnesio en el seguimiento si salió por debajo del rango.',
    includes: ['Magnesio'],
    notes: 'Un valor bajo dice algo; uno dentro del rango no descarta que falte, porque casi todo el magnesio está dentro de las células.',
  },
  calcium: {
    name: 'Calcio',
    description: 'Confirma tu calcio en el seguimiento si salió fuera del rango.',
    includes: ['Calcio total'],
  },
  sodium_potassium: {
    name: 'Sodio y potasio',
    description: 'El sodio y el potasio otra vez en tu seguimiento, si salieron fuera del rango o tomas medicación para la tensión.',
    includes: ['Sodio', 'Potasio'],
  },
  insulin: {
    name: 'Insulina (HOMA-IR)',
    description: 'La insulina en ayunas otra vez en tu seguimiento, para ver la tendencia junto a la glucosa y la HbA1c.',
    includes: ['Insulina en ayunas', 'HOMA-IR (se calcula con la glucosa)'],
    notes: 'En ayunas estricto. No hay un corte universal de HOMA-IR: se lee como tendencia, en el mismo laboratorio.',
  },
  psa: {
    name: 'PSA total',
    description: 'Para hombres de 50 años o más que eligen el cribado de próstata después de conocer sus pros y sus contras.',
    includes: ['PSA total'],
    notes: 'El cribado con PSA tiene pros y contras (falsas alarmas, pruebas que quizá no necesitas): conviene decidirlo con información, y mejor con tu médico.',
  },

  // Confirmar y ampliar
  thyroid: {
    name: 'Tiroides: confirmar y ampliar',
    description: 'Si tu TSH salió fuera del rango: la confirma y añade la T4 libre y los anticuerpos de tiroides.',
    includes: ['TSH', 'T4 libre', 'Anticuerpos anti-TPO'],
    notes: 'Si tomas biotina, díselo al laboratorio: puede alterar el resultado de la TSH.',
  },
  low_testosterone: {
    name: 'Testosterona baja: confirmar y ampliar',
    description: 'Si tu testosterona salió por debajo del rango y notas síntomas: la confirma y añade lo que ayuda a entenderla.',
    includes: ['Testosterona total (repetida)', 'SHBG', 'LH', 'FSH', 'Prolactina'],
    notes: 'Por la mañana y en ayunas. Si lo haces con tu seguimiento, la testosterona ya va incluida y no la pagas dos veces.',
  },
  androgens: {
    name: 'Andrógenos: confirmar y ampliar',
    description: 'Si tu testosterona salió por encima del rango o tus ciclos son irregulares: añade SHBG, DHEA-S y prolactina.',
    includes: ['Testosterona total', 'SHBG', 'DHEA-S', 'Prolactina'],
    notes: 'El síndrome de ovario poliquístico lo diagnostica un médico, con tu ciclo y una ecografía: el análisis ayuda, no decide.',
  },
  urine_albumin: {
    name: 'Albúmina en orina',
    description: 'Mide la albúmina que pasa a la orina, algo que la creatinina y el filtrado en sangre no enseñan.',
    includes: ['Microalbúmina en orina', 'Creatinina en orina (cociente albúmina/creatinina)'],
    notes: 'Cambia de un día a otro: si sale por encima del rango, se confirma con otra muestra.',
  },

  // Objetivos
  ovarian_reserve: {
    name: 'Reserva ovárica',
    description: 'Una foto de tu reserva ovárica de hoy, con las hormonas que ayudan a leerla.',
    includes: ['AMH (hormona antimülleriana)', 'FSH', 'LH', 'Estradiol', 'Prolactina'],
    notes:
      'La AMH estima la reserva, pero no predice si llegará un embarazo de forma natural. FSH, LH y estradiol se miden entre los días 2 y 5 del ciclo. Los anticonceptivos hormonales alteran estas hormonas.',
  },
  hormones_f: {
    name: 'Salud hormonal de la mujer',
    description: 'Las hormonas de tu ciclo, en dos extracciones según el día del ciclo.',
    includes: ['LH', 'FSH', 'Estradiol', 'Progesterona', 'Prolactina', 'Testosterona total', 'SHBG', 'DHEA-S', 'AMH'],
    notes:
      'Dos extracciones: entre los días 2 y 5 del ciclo, y unos 7 días antes de la regla. Los anticonceptivos hormonales alteran el resultado. Sin síntomas, el resultado rara vez cambia lo que puedes hacer.',
  },
  hormones_m: {
    name: 'Salud hormonal del hombre',
    description: 'La testosterona y las hormonas que la regulan, en una extracción por la mañana.',
    includes: ['Testosterona total', 'SHBG', 'LH', 'FSH', 'Estradiol', 'Prolactina', 'DHEA-S', 'PSA total'],
    notes:
      'Por la mañana y en ayunas. Sin síntomas, el resultado rara vez cambia lo que puedes hacer. Si la testosterona sale baja, se confirma con otra extracción.',
  },
  preconception: {
    name: 'Antes de buscar un embarazo',
    description: 'Tu inmunidad frente a infecciones que importan en el embarazo, serologías básicas y tu grupo sanguíneo.',
    includes: ['Rubéola IgG', 'Toxoplasma IgG', 'Varicela IgG', 'VIH', 'Sífilis', 'Hepatitis B', 'Hepatitis C', 'Grupo sanguíneo y Rh'],
    notes: 'Lo que ya mide tu análisis anual (hemograma, ferritina, TSH, vitamina D, B12) no se repite aquí.',
  },
  coeliac: {
    name: 'Celiaquía',
    description: 'Anticuerpos que aparecen cuando el cuerpo reacciona al gluten.',
    includes: ['Antitransglutaminasa IgA', 'IgA total'],
    notes: 'Solo vale si estás comiendo gluten: no lo quites antes de la prueba sin hablarlo con tu médico. El diagnóstico lo confirma el especialista de digestivo.',
  },
  sibo: {
    name: 'Aliento: SIBO',
    description: 'Mira si hay un sobrecrecimiento de bacterias en el intestino delgado.',
    includes: ['Test de aliento con lactulosa (hidrógeno y metano)'],
    notes: 'Solo tiene sentido con síntomas. Si sale positivo, el tratamiento lo pauta un médico: Kuova no receta.',
  },
  lactose: {
    name: 'Aliento: lactosa',
    description: 'Mira si absorbes bien la lactosa de los lácteos.',
    includes: ['Test de aliento con lactosa (hidrógeno y metano)'],
  },
  fructose: {
    name: 'Aliento: fructosa',
    description: 'Mira si absorbes bien la fructosa (fruta, zumos, dulces).',
    includes: ['Test de aliento con fructosa (hidrógeno y metano)'],
    notes: 'Es una prueba menos establecida que la de la lactosa.',
  },
  hpylori: {
    name: 'Aliento: Helicobacter pylori',
    description: 'Mira si hay Helicobacter pylori en el estómago.',
    includes: ['Test de aliento con urea'],
    notes:
      'Los antibióticos y los protectores de estómago de las semanas anteriores pueden alterar el resultado: si los tomas, díselo a tu médico antes de pedirla. Si sale positivo, el tratamiento lo pauta un médico.',
  },
  sti_basic: {
    name: 'ITS: 6 infecciones por PCR',
    description: 'Seis infecciones de transmisión sexual en una muestra de orina o un exudado.',
    includes: ['Clamidia', 'Gonorrea', 'Tricomonas', 'Mycoplasma genitalium', 'Mycoplasma hominis', 'Ureaplasma'],
  },
  sti_full: {
    name: 'ITS: completo',
    description: 'Las 6 infecciones del básico más las serologías en sangre.',
    includes: ['Las 6 infecciones del básico', 'VIH', 'Sífilis', 'Hepatitis B', 'Hepatitis C'],
  },
  training_load: {
    name: 'Rendimiento: carga de entrenamiento',
    description: 'CK y cortisol, para ver cómo llevas la carga de entrenamiento.',
    includes: ['CK (creatina quinasa)', 'Cortisol'],
    notes:
      'La CK refleja el entrenamiento de los días anteriores: deja 72 h sin entrenar fuerte antes de la extracción. Un cortisol suelto no mide el sobreentrenamiento.',
  },
  omega3: {
    name: 'Índice omega-3',
    description: 'Cuánto omega-3 (EPA y DHA) hay en tus glóbulos rojos.',
    includes: ['Índice omega-3 (EPA + DHA en los glóbulos rojos)'],
    notes: 'Se asocia al riesgo cardiovascular en estudios observacionales; los ensayos con suplementos dan resultados mixtos.',
  },
  allergy_alex: {
    name: 'Alergias (ALEX, 295 alérgenos)',
    description: 'Mira a qué alérgenos está sensibilizado tu cuerpo.',
    includes: ['IgE frente a 295 alérgenos (alimentos, pólenes, ácaros, animales…)'],
    notes: 'Estar sensibilizado no es lo mismo que ser alérgico: el resultado lo interpreta un alergólogo junto con tus síntomas.',
  },

  // Lo que pida un médico
  gen_carrier: {
    name: 'Test de portadores',
    description:
      'Si llevas variantes de enfermedades hereditarias que a ti no te dan síntomas, pero que podrían pasar a tus hijos. Muy recomendable si piensas tener hijos.',
    includes: [
      'Consulta de asesoramiento genético antes y después de la prueba',
      'Panel de enfermedades hereditarias recesivas y ligadas al cromosoma X (por ejemplo, fibrosis quística, atrofia muscular espinal o síndrome X frágil)',
    ],
    notes:
      'Es frecuente llevar alguna variante sin saberlo. Lo que importa es si los dos miembros de la pareja llevan una de la misma enfermedad: entonces, en la mayoría de estas enfermedades, cada hijo tiene 1 posibilidad entre 4 de tenerla. Por eso lo mejor es que lo hagan los dos, a ser posible antes del embarazo. Qué enfermedades incluye el panel depende del laboratorio.',
  },
  gen_coeliac: {
    name: 'Celiaquía genética (HLA-DQ2 / DQ8)',
    description: 'Si tienes la predisposición genética que hace posible la celiaquía.',
    includes: ['Consulta de asesoramiento genético antes y después de la prueba', 'HLA-DQ2', 'HLA-DQ8'],
    notes:
      'Si no la tienes, la celiaquía es muy improbable. Tenerla es frecuente y no significa que seas celíaco: eso lo mira la prueba de anticuerpos («Celiaquía»).',
  },
  gen_intolerance: {
    name: 'Intolerancias genéticas',
    description:
      'Si tu genética favorece la intolerancia a la lactosa en la edad adulta, la intolerancia hereditaria a la fructosa o una menor actividad de la enzima DAO.',
    includes: [
      'Consulta de asesoramiento genético antes y después de la prueba',
      'Lactasa (LCT / MCM6)',
      'Intolerancia hereditaria a la fructosa (ALDOB)',
      'Enzima DAO (AOC1)',
      'HLA-DQ2 / DQ8 (predisposición a la celiaquía)',
    ],
    notes:
      'La intolerancia hereditaria a la fructosa es una enfermedad seria que también importa a tu familia. La relación entre las variantes de AOC1 y los síntomas tiene una evidencia científica limitada.',
  },
  gen_hfe: {
    name: 'Hemocromatosis (gen HFE)',
    description: 'Si tienes las variantes asociadas a la hemocromatosis hereditaria, que hace que el cuerpo acumule hierro.',
    includes: ['Consulta de asesoramiento genético antes y después de la prueba', 'Gen HFE: C282Y', 'Gen HFE: H63D'],
    notes:
      'Tener las variantes no significa que vayas a desarrollarla. El resultado se lee junto con la ferritina y la saturación de transferrina, que ya mide tu análisis anual.',
  },
  gen_thrombophilia: {
    name: 'Trombofilia',
    description: 'Si tienes variantes que aumentan el riesgo de trombosis venosa.',
    includes: ['Consulta de asesoramiento genético antes y después de la prueba', 'Factor V Leiden (F5)', 'Protrombina (F2 G20210A)'],
    notes:
      'Ayuda a decidir con tu médico sobre anticonceptivos hormonales, embarazo o cirugías. No incluye MTHFR: por sí sola tiene poca utilidad clínica y las guías no la recomiendan para estudiar la trombosis.',
  },
  gen_apoe: {
    name: 'APOE',
    description: 'Tu combinación de las variantes ε2, ε3 y ε4, relacionada con cómo maneja las grasas tu cuerpo y con el riesgo de enfermedad de Alzheimer.',
    includes: ['Consulta de asesoramiento genético antes y después de la prueba', 'Genotipo APOE: ε2, ε3 y ε4'],
    notes:
      'El Alzheimer no tiene hoy un tratamiento curativo. Tener ε4 aumenta el riesgo, pero no significa que vayas a desarrollarlo, y no tenerlo no lo descarta. Por eso el asesoramiento antes y después de la prueba es obligatorio.',
  },
  doctor_request: {
    name: 'Pruebas que pida tu médico',
    description: 'Si tu médico, o un médico de la plataforma, te pide otras pruebas, puedes hacerlas con nosotros.',
    includes: ['Cualquier prueba de la cartera del laboratorio (más de 400)'],
    delivery: 'En la extracción de tu seguimiento (una visita menos) o en una visita aparte',
    notes: 'Kuova no receta ni pide pruebas por su cuenta: estas las pide tu médico.',
  },
};
