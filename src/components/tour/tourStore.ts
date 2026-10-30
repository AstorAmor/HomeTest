import { createRef, RefObject, useSyncExternalStore } from 'react';
import type { Href } from 'expo-router';
import { Platform, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tutorial guiado («cómo se usa Kuova»): una pantalla oscurecida con un hueco sobre cada parte
// principal y un bocadillo que la explica. Sale al terminar los cuestionarios del inicio y desde Más.
// Aquí: los pasos, qué elemento de la pantalla es cada uno (TourTarget lo registra) y cómo empezar.
// Lo pinta TourOverlay, dentro de las pestañas.

export interface TourStep {
  target: string; // id de TourTarget
  tab: number; // pestaña en la que está (TAB.*)
  route?: Href; // pantalla que abre encima (y cierra al seguir) para enseñar cómo se edita
  always?: boolean; // sale aunque su elemento no esté (el bocadillo solo, en el centro)
  title: string;
  text: string;
}

const GUT: Href = { pathname: '/digestive', params: { part: 'gut' } };
const BLADDER: Href = { pathname: '/digestive', params: { part: 'bladder' } };

// Si un paso no tiene su elemento (sección apagada en «Configura tu experiencia»), se salta
export const TOUR_STEPS: TourStep[] = [
  { target: 'tab.0', tab: 0, title: 'Today', text: 'Your day starts here: what is coming up, your doses and your plan.' },
  { target: 'today.checkin', tab: 0, title: 'Your check-in', text: 'How you feel each day: energy and mood in a few seconds. Tap here whenever you want to log it.' },
  { target: 'today.medication', tab: 0, always: true, title: 'Medication & supplements', text: 'Note what you take and, if you want, get a reminder for each dose. If you do not see it in Today, turn it on in More → Configure my experience.' },
  { target: 'today.readiness', tab: 0, title: 'Daily readiness', text: 'Sleep, heart rate and activity from your watch, in one number for today.' },
  { target: 'today.goals', tab: 0, title: 'Your daily goals', text: 'Steps, active calories, sleep and water against your goals. Tap the circles to change them.' },
  { target: 'goals.first', tab: 0, route: '/daily-goals', title: 'Change a goal', text: 'Turn the wheel to set your own goal, for example how many steps you aim for. Underneath, what we suggest and why.' },
  { target: 'goals.first.shown', tab: 0, route: '/daily-goals', title: 'Choose your circles', text: 'Show or hide each goal in Today: steps, calories, distance, sleep or water. Save with the tick at the top.' },
  { target: 'today.bp', tab: 0, title: 'Blood pressure', text: 'Log each reading from your monitor and see how your blood pressure changes over time. Tap the card to add one.' },
  { target: 'today.gut', tab: 0, title: 'Digestion', text: 'Two parts: tap a face for how your tummy feels today, and + each time you go to the bathroom.' },
  { target: 'digestive.gut', tab: 0, route: GUT, title: 'Your digestion', text: 'Your days at a glance. Add what you feel and what you ate before, and the colour and shape of your stools: each week we tell you what we notice.' },
  { target: 'today.hydration', tab: 0, title: 'Hydration', text: 'Two parts too: + for each drink (a glass, or your own amount) and + each time you pee. Tap the card for the colour and more.' },
  { target: 'digestive.water', tab: 0, route: BLADDER, title: 'Water', text: 'Your day and your week. With “Other amount” you choose any amount and can make it your usual one, like your water bottle.' },
  { target: 'digestive.urine', tab: 0, route: BLADDER, title: 'Urine', text: 'Add the colour of each time, or a whole day at once. Each week we tell you what we notice.' },
  { target: 'today.plan', tab: 0, title: 'Your personalised plan', text: 'The actions that can help you most, with where you are now and your target. Your full plan is just below.' },
  { target: 'today.plan.strength', tab: 0, title: 'Physical activity', text: 'Your strength workouts: each exercise explained, a timer for the rests and what you have done this week. Tap to start one.' },
  { target: 'today.learning', tab: 0, title: 'Keep learning', text: 'Short guides on training, sleep, nutrition, stress, heart health and more. Swipe through them or tap More for every topic.' },
  { target: 'tab.1', tab: 1, title: 'My Data', text: 'Your biomarkers, your measurements and your wearable, with how they change over time.' },
  { target: 'mydata.age', tab: 1, title: 'Your KUOVA age', text: 'The age your blood test shows. Tap it to see what moves it.' },
  { target: 'mydata.genetics', tab: 1, title: 'Your genetic profile', text: 'Know your roots: a few questions on what runs in your family, to see whether it is worth talking to a professional. Genetic test results will appear here too.' },
  { target: 'lab.upload', tab: 2, title: 'Upload a report', text: 'Take a photo or upload the PDF of any blood test: we read it and explain each value.' },
  { target: 'tab.3', tab: 3, title: 'Schedule', text: 'Your appointments, deliveries and results, and a button to add them to your calendar.' },
  { target: 'more.experience', tab: 4, title: 'Make it yours', text: 'Your experience can be customised in More → Configure my experience: choose what you see, like the plan, digestion, hydration or medication.' },
  { target: 'more.tutorial', tab: 4, title: 'Watch it again', text: 'Settings, professionals, your subscription… and this tutorial, whenever you want.' },
];

// --- Elementos de la pantalla ------------------------------------------------------------------

export interface TourScroll {
  ref: RefObject<ScrollView | null>;
  innerViewRef: RefObject<View | null>;
}

export interface RegisteredTarget {
  view: RefObject<View | null>;
  scroll?: TourScroll;
  inset?: number; // margen lateral de lo que envuelve, para que el hueco se ajuste a la tarjeta
}

const targets = new Map<string, RegisteredTarget>();

export const registerTarget = (id: string, target: RegisteredTarget) => {
  targets.set(id, target);
  return () => {
    if (targets.get(id) === target) targets.delete(id);
  };
};
export const getTarget = (id: string) => targets.get(id);

// Si un paso sale: el suyo está en pantalla; uno que abre otra pantalla, si está el paso de debajo (el
// anterior sin pantalla: sin la tarjeta de Digestión en Hoy, tampoco se abre Digestión)
export function stepAvailable(i: number): boolean {
  const step = TOUR_STEPS[i];
  if (step.always) return true;
  if (!step.route) return !!getTarget(step.target);
  for (let j = i - 1; j >= 0; j--) if (!TOUR_STEPS[j].route) return !!getTarget(TOUR_STEPS[j].target);
  return true;
}

// Para las pantallas largas: las props del ScrollView y el objeto que se pasa a sus TourTarget, para
// que el tutorial pueda bajar hasta el elemento antes de señalarlo. En la web baja el navegador
// (scrollIntoView) y no hace falta la vista interior.
export function makeTourScroll(): TourScroll & { props: Record<string, unknown> } {
  const ref = createRef<ScrollView>();
  const innerViewRef = createRef<View>();
  return { ref, innerViewRef, props: Platform.OS === 'web' ? { ref } : { ref, innerViewRef } };
}

// --- En marcha ---------------------------------------------------------------------------------
// Mientras dura, otras ventanas (los avisos de bienvenida de Hoy) esperan a que acabe.
let active = false;
const activeListeners = new Set<() => void>();
export const setTourActive = (on: boolean) => {
  if (active === on) return;
  active = on;
  activeListeners.forEach((fn) => fn());
};
const subscribeActive = (fn: () => void) => {
  activeListeners.add(fn);
  return () => {
    activeListeners.delete(fn);
  };
};
export const useTourActive = () => useSyncExternalStore(subscribeActive, () => active, () => active);

// --- Empezar -----------------------------------------------------------------------------------

const PENDING_KEY = 'tour.pending.v1';
const listeners = new Set<() => void>();

export const onTourStart = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

// Desde Más: ahora mismo
export const startTour = () => listeners.forEach((fn) => fn());

// Al terminar los cuestionarios: en cuanto se llegue a las pestañas
export const requestTourAfterOnboarding = () => AsyncStorage.setItem(PENDING_KEY, '1').catch(() => undefined);

export async function takeTourPending(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(PENDING_KEY);
    if (v) await AsyncStorage.removeItem(PENDING_KEY);
    return !!v;
  } catch {
    return false;
  }
}
