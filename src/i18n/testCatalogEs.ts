// Tienda en español (España): nombre, descripción, qué incluye, muestra y plazo de cada
// producto de src/data/testCatalog.ts, por id. Los precios no se tocan aquí.

export interface TestCopyEs {
  name: string;
  description: string;
  includes: string[];
  sample?: string;
  delivery?: string;
}

export const DELIVERY_ES = {
  blood: 'Kit en casa en 24-48 h · resultados 3-5 días laborables después de que el laboratorio reciba tu muestra',
  breath: 'Kit en casa en 24-48 h · resultados en 7-10 días',
  consult: 'Videoconsulta online · normalmente hay huecos en menos de 48 h',
  plan: 'Primer kit o cita en los 7 días siguientes al alta',
  discreet: 'Envío discreto',
};

export const SAMPLE_ES: Record<string, string> = {
  Blood: 'Sangre',
  'Blood · 2 kits': 'Sangre · 2 kits',
  'Blood + urine': 'Sangre + orina',
  Breath: 'Aliento',
  'Home blood collection or partner clinic': 'Extracción de sangre a domicilio o en una clínica colaboradora',
};

export const CATEGORY_LABEL_ES: Record<string, string> = {
  membership: 'Suscripciones',
  blood: 'Paneles de sangre',
  hormonal: 'Salud hormonal',
  preventive: 'Salud preventiva',
  digestive: 'Salud digestiva',
  sexual: 'Salud sexual (ITS)',
  consultation: 'Consultas',
};

export const TEST_COPY_ES: Record<string, TestCopyEs> = {
  membership: {
    name: 'Suscripción Kuova Basic',
    description:
      'Dos analíticas completas al año (panel completo al empezar y seguimiento a los 6 meses), revisión médica de cada resultado y tu plan personalizado en la app. 1 € al día.',
    includes: [
      'Panel completo (~100 marcadores) + seguimiento a los 6 meses (~60 marcadores)',
      'Un médico revisa cada resultado (≈15 min)',
      'Plan personalizado, tendencias y recordatorios',
    ],
  },
  premium: {
    name: 'Suscripción Kuova Premium',
    description:
      'Todo lo de Basic, con una analítica cada 3 meses en lugar de cada 6 y 5 videoconsultas con nuestros profesionales incluidas.',
    includes: [
      'Panel completo + 3 seguimientos al año (cada 3 meses)',
      'Un médico revisa cada resultado (≈15 min)',
      '5 videoconsultas incluidas (médico, nutricionista, entrenador…)',
      'Plan personalizado, tendencias y recordatorios',
    ],
  },
  essential: {
    name: 'Análisis de sangre esencial',
    description: 'Perfil lipídico, hepático, renal y tiroideo, además de glucosa.',
    includes: ['Glucosa', 'Perfil lipídico', 'Hígado (ALT, AST, GGT)', 'Riñón (creatinina, FGe)', 'TSH'],
  },
  weight: {
    name: 'Control de peso',
    description: 'Causas hormonales que pueden frenar la pérdida de peso.',
    includes: ['Insulina', 'Glucosa', 'TSH', 'Cortisol'],
  },
  performance: {
    name: 'Rendimiento deportivo',
    description: 'Recuperación, inflamación y estado hormonal para quienes entrenan.',
    includes: ['CK', 'PCR ultrasensible', 'Testosterona', 'Cortisol', 'Ferritina'],
  },
  vitamin_d: {
    name: 'Vitamina D',
    description: 'Niveles de vitamina D con interpretación médica.',
    includes: ['Vitamina D (25-OH)'],
  },
  vitamin_b: {
    name: 'Vitaminas del grupo B',
    description: 'Déficit de vitamina B12 y ácido fólico.',
    includes: ['Vitamina B12', 'Ácido fólico'],
  },
  vitamins: {
    name: 'Vitaminas esenciales',
    description: 'Vitamina D, B12 y ácido fólico con interpretación médica.',
    includes: ['Vitamina D', 'Vitamina B12', 'Ácido fólico'],
  },
  cycle_hormones: {
    name: 'Seguimiento hormonal del ciclo',
    description: 'Dos kits para medir tus hormonas en las fases clave del ciclo.',
    includes: ['Estradiol', 'Progesterona', 'LH', 'FSH'],
    delivery: 'Dos kits en casa en 24-48 h · resultados 3-5 días laborables después de cada muestra',
  },
  cortisol: {
    name: 'Cortisol',
    description: 'Niveles de cortisol para valorar el estrés.',
    includes: ['Cortisol por la mañana'],
  },
  stress: {
    name: 'Estrés',
    description: 'El impacto del estrés crónico: cortisol, TSH y PCR.',
    includes: ['Cortisol', 'TSH', 'PCR'],
  },
  fertility_f: {
    name: 'Fertilidad femenina',
    description: 'Reserva ovárica y tiroides.',
    includes: ['AMH', 'TSH', 'FSH'],
  },
  thyroid: {
    name: 'Función tiroidea',
    description: 'TSH y T4 libre.',
    includes: ['TSH', 'T4 libre'],
  },
  thyroid_adv: {
    name: 'Función tiroidea avanzada',
    description: 'Hormonas tiroideas y anticuerpos autoinmunes.',
    includes: ['TSH', 'T4 libre', 'T3 libre', 'Anti-TPO', 'Antitiroglobulina'],
  },
  amh: {
    name: 'Reserva ovárica (AMH)',
    description: 'AMH: tu reserva ovárica y tu fertilidad en este momento.',
    includes: ['AMH'],
  },
  testosterone: {
    name: 'Testosterona',
    description: 'Cambios en la testosterona que pueden estar detrás del cansancio, la libido o el estado de ánimo.',
    includes: ['Testosterona total'],
  },
  t1d_antibodies: {
    name: 'Anticuerpos de diabetes tipo 1',
    description: 'Riesgo de diabetes tipo 1 antes de que aparezcan síntomas.',
    includes: ['Autoanticuerpos relacionados con la diabetes'],
  },
  cardio: {
    name: 'Chequeo cardiovascular',
    description: 'Marcadores cardiovasculares clave y colesterol.',
    includes: ['Perfil lipídico', 'ApoB', 'PCR ultrasensible'],
  },
  diabetes: {
    name: 'Diabetes',
    description: 'HbA1c y función renal.',
    includes: ['HbA1c', 'Glucosa', 'Creatinina', 'FGe'],
  },
  psa: {
    name: 'Cribado de cáncer de próstata',
    description: 'PSA total para la detección precoz.',
    includes: ['PSA total'],
  },
  lpa: {
    name: 'Riesgo cardiovascular: Lp(a)',
    description: 'Lipoproteína(a), un marcador genético de riesgo cardíaco. Normalmente basta con medirla una vez.',
    includes: ['Lipoproteína(a)'],
  },
  coeliac: {
    name: 'Celiaquía',
    description: 'Prueba de cribado de la celiaquía avalada por el Ministerio de Sanidad.',
    includes: ['IgA antitransglutaminasa tisular', 'IgA total'],
  },
  fructose: {
    name: 'Intolerancia a la fructosa',
    description: 'Test de aliento.',
    includes: ['Test de aliento de hidrógeno y metano (fructosa)'],
  },
  lactose: {
    name: 'Intolerancia a la lactosa',
    description: 'Test de aliento.',
    includes: ['Test de aliento de hidrógeno y metano (lactosa)'],
  },
  lactose_fructose: {
    name: 'Lactosa y fructosa',
    description: 'Tolerancia a la lactosa y a la fructosa.',
    includes: ['Test de aliento de lactosa', 'Test de aliento de fructosa'],
  },
  sibo: {
    name: 'SIBO',
    description: 'Sobrecrecimiento bacteriano en el intestino delgado.',
    includes: ['Test de aliento con lactulosa'],
  },
  digestive_pack: {
    name: 'Pack digestivo',
    description: 'SIBO e intolerancia a la lactosa y a la fructosa en un solo pack.',
    includes: ['SIBO', 'Lactosa', 'Fructosa'],
  },
  sti_4: {
    name: 'Test de 4 ITS',
    description: 'VIH, sífilis, hepatitis B y C, con informe médico.',
    includes: ['VIH 1/2', 'Sífilis', 'Hepatitis B', 'Hepatitis C'],
  },
  sti_7: {
    name: 'Test de 7 ITS',
    description: 'VIH, sífilis, hepatitis B y C, clamidia, gonorrea y tricomoniasis.',
    includes: ['VIH 1/2', 'Sífilis', 'Hepatitis B', 'Hepatitis C', 'Clamidia', 'Gonorrea', 'Tricomoniasis'],
  },
  sti_11: {
    name: 'Test de 11 ITS',
    description: '11 infecciones analizadas en sangre y orina.',
    includes: ['VIH', 'Sífilis', 'Hepatitis B y C', 'Clamidia', 'Gonorrea', 'Tricomoniasis', 'Mycoplasma', 'Ureaplasma', 'Herpes 1/2'],
  },
  consult_digestive: {
    name: 'Consulta digestiva y de intolerancias',
    description:
      'Revisión online de tus resultados de intolerancias o SIBO. Si necesitas tratamiento, el médico te explica los siguientes pasos.',
    includes: ['Videoconsulta', 'Siguientes pasos si necesitas tratamiento'],
  },
  consult_sti: {
    name: 'Consulta médica de ITS',
    description:
      'Revisión online de tus resultados de ITS. Si necesitas tratamiento, el médico te explica los siguientes pasos.',
    includes: ['Videoconsulta', 'Siguientes pasos si necesitas tratamiento'],
  },
};
