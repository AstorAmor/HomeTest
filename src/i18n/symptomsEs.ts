// Español de España para el registro de síntomas y el resumen de la semana (rediseño del 2026-11-17). En su propio archivo para no chocar con
// los cambios que entran en es.ts desde otras sesiones; index.ts lo junta con es.ts.
// Lo que ya está en es.ts (Hoy, Ayer, Guardar, Intensidad, Leve, Moderada, Fuerte, Dolor de cabeza…) se usa de allí:
// aquí solo lo nuevo. src/logic/__tests__/symptomsEs.test.ts comprueba que no falta ni sobra nada.
export const symptomsEs: Record<string, string> = {
  // El botón K
  'Symptom': 'Síntoma',

  // Apuntar un síntoma (LogSymptomScreen)
  'This is not a diagnosis. It is your own record of how you feel: it helps you see patterns and tell your doctor.':
    'Esto no es un diagnóstico. Es tu propio registro de cómo te sientes: te sirve para ver patrones y para contárselo a tu médico.',
  'See my symptoms': 'Ver mis síntomas',
  'What do you notice?': '¿Qué notas?',
  'Where?': '¿Dónde?',
  'Somewhere else, or more detail (optional)': 'Otro sitio o más detalle (opcional)',
  'Where do you notice it? (optional)': '¿Dónde lo notas? (opcional)',
  'What you were doing, what you had taken, how it went…': 'Qué estabas haciendo, qué habías tomado, cómo ha ido…',
  'If it is intense, does not ease or worries you, call 112.': 'Si es intenso, no cede o te preocupa, llama al 112.',
  'Write what you notice in «Other».': 'Escribe qué notas en «Otro».',
  'Choose the intensity of each symptom you ticked.': 'Elige la intensidad de cada síntoma que has marcado.',
  'The start cannot be later than now: we have set it to this moment.': 'El inicio no puede ser posterior a ahora: lo hemos dejado en este momento.',

  // Los grupos y los síntomas (src/logic/symptoms.ts)
  'General': 'General',
  'Head': 'Cabeza',
  'Chest and breathing': 'Pecho y respiración',
  'Stomach and gut': 'Digestivo',
  'Muscles, joints and skin': 'Músculos, articulaciones y piel',
  'Mood and rest': 'Ánimo y descanso',
  'Fatigue': 'Cansancio',
  'Fever or chills': 'Fiebre o escalofríos',
  'Dizziness': 'Mareo',
  'Fainting or feeling faint': 'Desmayo o sensación de desmayo',
  'Blurred vision': 'Visión borrosa',
  'Chest pain': 'Dolor en el pecho',
  'Palpitations': 'Palpitaciones',
  'Shortness of breath': 'Falta de aire',
  'Cough': 'Tos',
  'Sore throat': 'Dolor de garganta',
  'Blocked or runny nose': 'Congestión nasal',
  'Abdominal pain': 'Dolor abdominal',
  'Joint or muscle pain': 'Dolor muscular o articular',
  'Tingling or numbness': 'Hormigueo o adormecimiento',
  'Itching or rash': 'Picor o sarpullido',
  'Anxiety or nerves': 'Ansiedad o nervios',
  'Difficulty sleeping': 'Me cuesta dormir',

  // Dónde
  'Forehead': 'Frente',
  'Temples': 'Sienes',
  'Behind the eyes': 'Detrás de los ojos',
  'Back of the head': 'Nuca',
  'One side': 'Un lado',
  'The whole head': 'Toda la cabeza',
  'Centre of the chest': 'Centro del pecho',
  'Left side': 'Lado izquierdo',
  'Right side': 'Lado derecho',
  'Upper back': 'Parte alta de la espalda',
  'Upper abdomen': 'Parte alta del abdomen',
  'Around the navel': 'Alrededor del ombligo',
  'Lower abdomen': 'Parte baja del abdomen',
  'The whole abdomen': 'Todo el abdomen',
  'Shoulder': 'Hombro',
  'Wrist or hand': 'Muñeca o mano',
  'Hip': 'Cadera',
  'Leg': 'Pierna',
  'Knee': 'Rodilla',
  'Ankle or foot': 'Tobillo o pie',
  'Face': 'Cara',
  'Hand': 'Mano',
  'Foot': 'Pie',
  'Torso': 'Tronco',
  'Arms': 'Brazos',
  'Hands': 'Manos',
  'Legs': 'Piernas',
  'Feet': 'Pies',

  // Tus síntomas (SymptomsScreen)
  'Your symptoms': 'Tus síntomas',
  'Your own record of how you feel. It is not a diagnosis.': 'Tu propio registro de cómo te sientes. No es un diagnóstico.',
  'Sample data: log your first symptom to see your own.': 'Datos de ejemplo: apunta tu primer síntoma para ver los tuyos.',
  'I woke up with it after a short night.': 'Me levanté con él después de una noche corta.',
  'Mild intensity': 'Intensidad leve',
  'Moderate intensity': 'Intensidad moderada',
  'Strong intensity': 'Intensidad fuerte',
  'Show older ones': 'Ver anteriores',

  // Resumen de la semana
  'Summary of the week': 'Resumen de la semana',
  'No symptoms logged in the last 7 days.': 'No has apuntado ningún síntoma en los últimos 7 días.',
  'Days with symptoms': 'Días con síntomas',
  '{n} of 7': '{n} de 7',
  'The 7 days before: {n}.': 'Los 7 días anteriores: {n}.',
  'Most frequent': 'Lo más frecuente',
  'This week, {k} of your {n} days with symptoms came after a night under 6 h.': 'Esta semana, {k} de tus {n} días con síntomas llegaron tras una noche de menos de 6 h.',
  'This week, on {k} of your {n} days with symptoms you had said you slept badly.': 'Esta semana, en {k} de tus {n} días con síntomas habías dicho que dormiste mal.',
  'This week, {k} of your {n} days with symptoms fell {phase}.': 'Esta semana, {k} de tus {n} días con síntomas cayeron {phase}.',

  // De pago, aún sin nada detrás
  'Insights about your week': 'Insights sobre tu semana',
  'With Kuova Premium: your week explained from everything you log.': 'Con Kuova Premium: tu semana explicada a partir de todo lo que apuntas.',

  // Patrones: siempre «coincide con», nunca «se debe a»
  'Patterns': 'Patrones',
  '{k} of {n} days, after a night under 6 h.': '{k} de {n} días, tras dormir menos de 6 h.',
  'Over that time, {b} of your {m} nights were under 6 h.': 'En ese tiempo, {b} de tus {m} noches fueron de menos de 6 h.',
  '{k} of {n} days, after a night you said you slept badly.': '{k} de {n} días, tras una noche en la que dijiste que dormiste mal.',
  'Over that time, you said so on {b} of {m} mornings.': 'En ese tiempo lo dijiste {b} de {m} mañanas.',
  '{k} of {n} days, {phase}.': '{k} de {n} días, {phase}.',
  'Those days are about {p} % of your cycle.': 'Esos días son más o menos el {p} % de tu ciclo.',
  'on your period days': 'en los días de regla',
  'in the days after your period': 'en los días después de la regla',
  'around ovulation': 'en torno a la ovulación',
  'in the second half of your cycle': 'en la segunda mitad del ciclo',
  'These are coincidences in your own records, not causes or a diagnosis. Only the days with sleep or cycle data count. If something worries you, talk to your doctor.':
    'Son coincidencias en tus propios registros, no causas ni un diagnóstico. Solo cuentan los días con datos de sueño o de ciclo. Si algo te preocupa, coméntalo con tu médico.',
  'The cycle phases are an estimate from the periods you log.': 'Las fases del ciclo son una estimación a partir de las reglas que apuntas.',
  'Not enough records yet to see patterns. When a symptom repeats, you will see here what it coincides with in your records: your sleep and, if you log your periods, your cycle.':
    'Aún no hay bastantes registros para ver patrones. Cuando un síntoma se repita, aquí verás con qué coincide en tus registros: tu sueño y, si apuntas tus reglas, tu ciclo.',
};
