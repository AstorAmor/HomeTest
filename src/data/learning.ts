import { SpecialistCard } from './planImages';

// "Keep learning" (Today): temas de salud con una pequeña guía cada uno. Las fotos son
// PROVISIONALES: sustituir los JPG de assets/images/learning/ (1024×1024) con el mismo
// nombre (prompts en assets/images/IMAGE_PROMPTS.md). Contenido general y divulgativo,
// pendiente de revisión por el equipo médico.

export interface LearningTopic extends SpecialistCard {
  intro: string;
  lessons: { title: string; body: string }[];
  action?: { label: string; href: string; params?: Record<string, string> };
}

export const LEARNING_TOPICS: LearningTopic[] = [
  {
    id: 'reproductive_health',
    label: 'Reproductive health',
    subtitle: 'Cycle, fertility, hormones',
    image: require('../../assets/images/learning/reproductive_health.jpg'),
    intro: 'Your cycle is a monthly report on your health. Knowing its phases helps you plan training, food and rest.',
    lessons: [
      { title: 'The four phases', body: 'Menstrual, follicular, ovulation and luteal. Energy tends to rise in the first half of the cycle and dip before your period.' },
      { title: 'What counts as regular', body: 'Cycles between 21 and 35 days are usually considered normal. Big changes are worth discussing with a professional.' },
      { title: 'Markers that matter', body: 'Iron (ferritin), vitamin D and thyroid (TSH) often explain tiredness around your period.' },
    ],
    action: { label: 'Log your period', href: '/log-cycle' },
  },
  {
    id: 'training',
    label: 'Training',
    subtitle: 'Strength and cardio',
    image: require('../../assets/images/learning/training.jpg'),
    intro: 'Muscle is one of the best tools for long-term health: it improves blood sugar control, bones and metabolism.',
    lessons: [
      { title: 'Two to three strength sessions a week', body: 'Full-body routines with squats, hinges, pushes and pulls are enough to start.' },
      { title: 'Move every day', body: 'Walking after meals lowers glucose spikes. Aim for around 8,000 steps.' },
      { title: 'Progress slowly', body: 'Add a little weight or a few reps each week, and keep 1-2 reps in reserve.' },
    ],
  },
  {
    id: 'meditation',
    label: 'Meditation',
    subtitle: 'Calm your nervous system',
    image: require('../../assets/images/learning/meditation.jpg'),
    intro: 'A few minutes of slow breathing shift your body towards recovery and can raise your HRV over time.',
    lessons: [
      { title: 'Start with 3 minutes', body: 'Consistency beats length. A short daily practice is better than a long one once a week.' },
      { title: 'Box breathing', body: 'Breathe in for 4, hold for 4, out for 4, hold for 4. Repeat for a few rounds.' },
    ],
    action: { label: 'Try box breathing', href: '/exercise', params: { id: 'box_breathing' } },
  },
  {
    id: 'yoga',
    label: 'Yoga',
    subtitle: 'Mobility and breath',
    image: require('../../assets/images/learning/yoga.jpg'),
    intro: 'Yoga combines mobility, strength and breathing. Gentle flows help with stiffness and stress.',
    lessons: [
      { title: 'Short flows count', body: 'Ten minutes of stretching in the morning improves how you move all day.' },
      { title: 'Listen to your body', body: 'Stretch to mild tension, never pain, and breathe slowly through each pose.' },
    ],
    action: { label: 'Do a 5-minute stretch', href: '/exercise', params: { id: 'stretch' } },
  },
  {
    id: 'nutrition',
    label: 'Nutrition',
    subtitle: 'Eat for your markers',
    image: require('../../assets/images/learning/nutrition.jpg'),
    intro: 'What you eat shows up in your blood tests: glucose, cholesterol, iron and vitamins.',
    lessons: [
      { title: 'Build your plate', body: 'Half vegetables, a quarter protein, a quarter whole grains, plus some healthy fat.' },
      { title: 'Oily fish twice a week', body: 'Salmon, sardines or mackerel help your omega-3 index and triglycerides.' },
      { title: 'Watch added sugar', body: 'Sugary drinks are the easiest place to cut back.' },
    ],
    action: { label: 'Log a meal', href: '/log-meal' },
  },
  {
    id: 'sleep',
    label: 'Sleep',
    subtitle: 'Recover better',
    image: require('../../assets/images/learning/sleep.jpg'),
    intro: 'Short or irregular sleep raises cortisol and glucose the next day. Regularity matters as much as hours.',
    lessons: [
      { title: 'Same wake-up time', body: 'Keep it within 30 minutes every day, weekends included.' },
      { title: 'Wind down', body: 'No screens 30 minutes before bed, and keep the room cool and dark.' },
    ],
    action: { label: 'Body scan before bed', href: '/exercise', params: { id: 'body_scan' } },
  },
  {
    id: 'heart_health',
    label: 'Heart health',
    subtitle: 'Blood pressure and lipids',
    image: require('../../assets/images/learning/heart_health.jpg'),
    intro: 'Blood pressure, LDL, ApoB and Lp(a) tell you a lot about your cardiovascular risk.',
    lessons: [
      { title: 'Measure at home', body: 'Take your blood pressure seated, after 5 minutes of rest, twice in a row.' },
      { title: 'Know your numbers', body: 'Ask a doctor what your LDL target should be: it depends on your overall risk.' },
    ],
    action: { label: 'Log blood pressure', href: '/log-blood-pressure' },
  },
  {
    id: 'stress',
    label: 'Stress',
    subtitle: 'Cortisol and energy',
    image: require('../../assets/images/learning/stress.jpg'),
    intro: 'Chronic stress keeps cortisol high and HRV low. Small daily breaks make a measurable difference.',
    lessons: [
      { title: 'Notice it early', body: 'A quick check-in helps you spot stressful days before they pile up.' },
      { title: 'Move it out', body: 'A brisk 10-minute walk lowers tension and improves your mood.' },
    ],
    action: { label: 'Check in now', href: '/check-in' },
  },
];

export const findTopic = (id?: string) => LEARNING_TOPICS.find((t) => t.id === id) ?? LEARNING_TOPICS[0];
