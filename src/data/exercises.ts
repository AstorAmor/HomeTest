// Ejercicios guiados de las sugerencias del check-in (siempre opcionales).
// - breath: el círculo sigue el patrón de respiración (inspirar/aguantar/espirar).
// - guided: pasos con tiempo; el círculo respira despacio de fondo.

export interface BreathPhase {
  label: string; // lo que ve el usuario
  seconds: number;
  to: 'in' | 'out' | 'hold'; // hacia dónde va el círculo
}

export interface GuidedStep {
  text: string;
  seconds: number;
}

export interface Exercise {
  id: string;
  title: string;
  intro: string;
  minutes: number;
  color: string;
  type: 'breath' | 'guided';
  pattern?: BreathPhase[];
  steps?: GuidedStep[];
  countsAsCalm: boolean; // suma para el logro "Calm mind" y el plan de mindfulness
}

const BOX: BreathPhase[] = [
  { label: 'Breathe in', seconds: 4, to: 'in' },
  { label: 'Hold', seconds: 4, to: 'hold' },
  { label: 'Breathe out', seconds: 4, to: 'out' },
  { label: 'Hold', seconds: 4, to: 'hold' },
];

// ~6 respiraciones por minuto: el ritmo que más sube la variabilidad cardiaca
const RESONANT: BreathPhase[] = [
  { label: 'Breathe in', seconds: 4, to: 'in' },
  { label: 'Breathe out', seconds: 6, to: 'out' },
];

export const EXERCISES: Record<string, Exercise> = {
  box_breathing: {
    id: 'box_breathing',
    title: 'Box breathing',
    intro: 'Four counts in, hold, four out, hold. Used by pilots and athletes to calm down under pressure.',
    minutes: 3,
    color: '#5AB8F0',
    type: 'breath',
    pattern: BOX,
    countsAsCalm: true,
  },
  breathing_am: {
    id: 'breathing_am',
    title: 'Morning breathing',
    intro: 'Slow, steady breaths to start the day calm and focused. In through the nose, out through the mouth.',
    minutes: 2,
    color: '#3ECDB8',
    type: 'breath',
    pattern: RESONANT,
    countsAsCalm: true,
  },
  mindful_pause: {
    id: 'mindful_pause',
    title: 'Mindful pause',
    intro: 'Two minutes to reset between tasks. Follow the circle and let your shoulders drop.',
    minutes: 2,
    color: '#9B8CFF',
    type: 'breath',
    pattern: RESONANT,
    countsAsCalm: true,
  },
  body_scan: {
    id: 'body_scan',
    title: 'Body scan',
    intro: 'Lie down or sit comfortably. Move your attention slowly through your body and let each part relax.',
    minutes: 10,
    color: '#9B8CFF',
    type: 'guided',
    steps: [
      { text: 'Close your eyes. Take three slow, deep breaths.', seconds: 45 },
      { text: 'Notice your feet and toes. Let them soften.', seconds: 60 },
      { text: 'Move up to your calves and knees. Release any tension.', seconds: 60 },
      { text: 'Feel your thighs and hips grow heavy.', seconds: 60 },
      { text: 'Notice your belly rising and falling with each breath.', seconds: 60 },
      { text: 'Relax your chest and your back against the surface.', seconds: 60 },
      { text: 'Let your shoulders drop away from your ears.', seconds: 60 },
      { text: 'Soften your arms, hands and fingers.', seconds: 60 },
      { text: 'Relax your jaw, your eyes and your forehead.', seconds: 60 },
      { text: 'Feel your whole body at once, calm and heavy. Rest here.', seconds: 75 },
    ],
    countsAsCalm: true,
  },
  stretch: {
    id: 'stretch',
    title: 'Gentle stretching',
    intro: 'Slow stretches to release the tension of the day. Never stretch into pain.',
    minutes: 8,
    color: '#F7B6D2',
    type: 'guided',
    steps: [
      { text: 'Neck: slowly tilt your head to each side. Breathe out as you lean.', seconds: 60 },
      { text: 'Shoulders: roll them back ten times, then forward ten times.', seconds: 60 },
      { text: 'Cat-cow on all fours: arch and round your back with your breath.', seconds: 75 },
      { text: "Child's pose: sit back on your heels, arms long, forehead down.", seconds: 75 },
      { text: 'Hip flexor: half-kneeling lunge, 40 seconds each side.', seconds: 80 },
      { text: 'Hamstrings: sitting, reach gently towards your toes.', seconds: 60 },
      { text: 'Lying twist: knees to one side, then the other.', seconds: 70 },
    ],
    countsAsCalm: true,
  },
  activation: {
    id: 'activation',
    title: 'Wake-up activation',
    intro: 'Five minutes of easy movement to get your blood flowing. Go at your own pace.',
    minutes: 5,
    color: '#FF8A65',
    type: 'guided',
    steps: [
      { text: 'March on the spot, swinging your arms.', seconds: 45 },
      { text: 'Big arm circles, forwards and backwards.', seconds: 40 },
      { text: 'Bodyweight squats, slow and controlled.', seconds: 45 },
      { text: 'Hip circles, both directions.', seconds: 35 },
      { text: 'Step jacks (or jumping jacks if you feel good).', seconds: 45 },
      { text: 'Reach up tall, then fold forward and hang loosely.', seconds: 45 },
      { text: 'Finish with five deep breaths. You are ready.', seconds: 45 },
    ],
    countsAsCalm: false,
  },
  sunlight: {
    id: 'sunlight',
    title: 'Get some daylight',
    intro: 'Morning light resets your body clock and helps you sleep better tonight.',
    minutes: 10,
    color: '#F0B84D',
    type: 'guided',
    steps: [
      { text: 'Step outside or sit by an open window. No sunglasses if it is safe.', seconds: 180 },
      { text: 'Look towards the sky (never directly at the sun). Breathe slowly.', seconds: 240 },
      { text: 'Walk a little if you can. Notice the light and the air.', seconds: 180 },
    ],
    countsAsCalm: false,
  },
  walk: {
    id: 'walk',
    title: 'Short walk outside',
    intro: 'A 10-minute walk lifts energy better than another coffee.',
    minutes: 10,
    color: '#5AB8F0',
    type: 'guided',
    steps: [
      { text: 'Head out at an easy pace. Leave your phone in your pocket.', seconds: 180 },
      { text: 'Pick up the pace a little. Swing your arms.', seconds: 240 },
      { text: 'Slow down again and breathe deeply on the way back.', seconds: 180 },
    ],
    countsAsCalm: false,
  },
  journal: {
    id: 'journal',
    title: 'Write it down',
    intro: 'Three lines about your day to clear your head. Paper or notes app, whatever you prefer.',
    minutes: 3,
    color: '#9B8CFF',
    type: 'guided',
    steps: [
      { text: 'What was the hardest part of today?', seconds: 60 },
      { text: 'What went better than you expected?', seconds: 60 },
      { text: "What is one thing you'll do differently tomorrow?", seconds: 60 },
    ],
    countsAsCalm: true,
  },
};
