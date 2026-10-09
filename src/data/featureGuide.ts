import { AppSection } from './appPrefs';

// Qué es cada parte de la app, para la guía de Configure my experience (con vista previa) y para
// el último paso del onboarding. Textos para el usuario: cortos y en lo que él reconoce.

export interface FeatureGuide {
  what: string; // para qué sirve
  youDo: string; // qué hace el usuario
  youGet: string; // qué recibe
  notifications?: string; // qué avisos puede mandar
  evidenceTopic?: string; // tema de How KUOVA works
}

export const FEATURE_GUIDE: Record<AppSection, FeatureGuide> = {
  plan: {
    what: 'Concrete actions built from your results and goals, with the markers each one should improve.',
    youDo: 'Follow the actions and log what you do (workouts, meals, breathing).',
    youGet: 'Your progress each week and, at your next test, how your markers moved.',
    evidenceTopic: 'plan',
  },
  checkin: {
    what: 'A 30-second note on how you slept, your energy and your mood.',
    youDo: 'Check in once a day, whenever suits you.',
    youGet: 'Your energy and mood over time, and ideas for the moment (all optional).',
    notifications: 'A gentle reminder if you stop for a few days, and a heads-up after three low-energy days.',
    evidenceTopic: 'checkin',
  },
  readiness: {
    what: 'A daily score from your sleep, resting heart rate and HRV compared with your own usual values.',
    youDo: 'Nothing: it comes from your wearable.',
    youGet: 'How hard to push today, at a glance.',
    evidenceTopic: 'readiness',
  },
  wearables: {
    what: 'Heart rate, HRV, sleep, steps and temperature from your watch or ring, next to your blood tests.',
    youDo: 'Connect your wearable once.',
    youGet: 'Trends in My Data, and context for your results and your plan.',
    notifications: 'A note after three short nights in a row.',
    evidenceTopic: 'wearables',
  },
  cycle: {
    what: 'Period dates, predictions and, if you want, your morning temperature to confirm ovulation.',
    youDo: 'Log your period and answer a short questionnaire the first time.',
    youGet: 'Your next period and fertile days, and when it is worth seeing a doctor if you are trying to conceive.',
    notifications: 'A note if your period is late, and a temperature reminder if you switch it on.',
    evidenceTopic: 'cycle_prediction',
  },
  gut: {
    what: 'A quick daily note on your bowel movements: how often, colour and consistency.',
    youDo: 'A couple of taps a day, when you remember.',
    youGet: 'Weekly notes on what looks regular and what is worth checking, asking first what could explain a change.',
    notifications: 'A weekly summary, and a question if something unusual shows up, such as an unusual colour.',
    evidenceTopic: 'digestion',
  },
  bladder: {
    what: 'A quick daily note on your urine: how often, how many times at night and the colour.',
    youDo: 'A couple of taps a day, when you remember.',
    youGet: 'How hydrated you are on Today, a tip when you should drink more, and weekly notes.',
    notifications: 'A note if your urine has been dark for a few days, and a weekly summary.',
    evidenceTopic: 'urine',
  },
  medication: {
    what: 'What you take regularly and short courses when you are ill, with reminders if you want them.',
    youDo: 'Write what you take ("vitamin D 1000 IU once a day") and mark each dose.',
    youGet: 'A clear record for you and your doctor, and tips such as when to take it.',
    notifications: 'A reminder for each dose, only if you ask for it. Each one can be muted on its own.',
    evidenceTopic: 'medication',
  },
  badges: {
    what: 'Achievements for what you actually do: streaks, steps, sessions.',
    youDo: 'Nothing extra.',
    youGet: 'A bit of motivation. We never celebrate just receiving something.',
    evidenceTopic: 'badges',
  },
  specialists: {
    what: 'Suggestions to talk to a doctor, dietitian, trainer or physio when it makes sense.',
    youDo: 'Book only if you want to.',
    youGet: 'The right professional, with your data if you choose to share it.',
    evidenceTopic: 'specialists',
  },
  learning: {
    what: 'Short reads about your health, linked to what you see in your results.',
    youDo: 'Read when you feel like it.',
    youGet: 'Context for your numbers, in plain words.',
    evidenceTopic: 'learning',
  },
};
