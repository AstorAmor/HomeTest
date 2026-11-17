import { createRef, RefObject, useSyncExternalStore } from 'react';
import type { Href } from 'expo-router';
import { Platform, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TAB } from '@/constants/tabs';

// Tutorial guiado («cómo se usa Kuova»): una pantalla oscurecida con un hueco sobre cada parte
// principal y un bocadillo que la explica. Sale al terminar los cuestionarios del inicio y desde Tú.
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

// Si un paso no tiene su elemento (sección apagada en «Configura tu experiencia»), se salta. Desde el
// 2026-11-16, por las cuatro pestañas: Hoy, el botón K, Plan, Análisis y Tú (TAB en src/constants/tabs.ts).
export const TOUR_STEPS: TourStep[] = [
  { target: 'tab.0', tab: TAB.today, title: 'Today', text: 'Your day: your check-in, how your week is going and what you measure.' },
  { target: 'today.checkin', tab: TAB.today, title: 'Your check-in', text: 'How you feel: energy and mood in a few seconds. The ring fills with up to 3 check-ins a day: morning, midday and night.' },
  { target: 'today.week', tab: TAB.today, title: 'Week', text: 'How your weekly targets are going, in one figure. Tap it to open your plan.' },
  { target: 'today.readiness', tab: TAB.today, title: 'Today', text: 'How you are today, from the sleep, heart rate and activity of your watch.' },
  { target: 'today.goals', tab: TAB.today, title: 'Your daily goals', text: 'Steps, active calories, sleep and water against your goals. Tap them to change them.' },
  { target: 'goals.first', tab: TAB.today, route: '/daily-goals', title: 'Change a goal', text: 'Use − and + to set your own goal, for example how many steps you aim for. Underneath, what we suggest and why.' },
  { target: 'goals.first.shown', tab: TAB.today, route: '/daily-goals', title: 'Choose what you see', text: 'Show or hide each goal in Today: steps, calories, distance, sleep or water. Then tap Save.' },
  { target: 'today.bp', tab: TAB.today, title: 'Blood pressure', text: 'Log each reading from your monitor and see how your blood pressure changes over time. Tap the card to add one.' },
  { target: 'today.gut', tab: TAB.today, title: 'Digestion', text: 'Two parts: tap a face for how your tummy feels today, and + each time you go to the bathroom.' },
  { target: 'digestive.gut', tab: TAB.today, route: GUT, title: 'Your digestion', text: 'Your days at a glance. Add what you feel and what you ate before, and the colour and shape of your stools: each week we tell you what we notice.' },
  { target: 'today.hydration', tab: TAB.today, title: 'Hydration', text: 'Two parts too: + for each drink (a glass, or your own amount) and + each time you pee. Tap the card for the colour and more.' },
  { target: 'digestive.water', tab: TAB.today, route: BLADDER, title: 'Water', text: 'Your day and your week. With “Other amount” you choose any amount and can make it your usual one, like your water bottle.' },
  { target: 'digestive.urine', tab: TAB.today, route: BLADDER, title: 'Urine', text: 'Add the colour of each time, or a whole day at once. Each week we tell you what we notice.' },
  { target: 'today.medication', tab: TAB.today, always: true, title: 'Medication & supplements', text: 'Note what you take and, if you want, get a reminder for each dose. If you do not see it in Today, turn it on in You → Configure my experience.' },
  { target: 'tab.log', tab: TAB.today, title: 'Log', text: 'The K button: log anything from any tab, like a check-in, your weight, blood pressure, a meal, a workout or a report.' },
  { target: 'tab.1', tab: TAB.plan, title: 'Plan', text: 'Your goals, your weekly targets, your commitment and your badges. Workouts and meals too.' },
  { target: 'plan.targets', tab: TAB.plan, title: 'Your week', text: 'The same figure as the Week circle in Today, with each area, the days left and how each day went.' },
  { target: 'plan.targets.ej', tab: TAB.plan, title: 'Exercise', text: 'Your exercise targets: steps, cardio or strength. Tap it to see each day and mark today.' },
  { target: 'tab.2', tab: TAB.analysis, title: 'Analysis', text: 'Your next test, your results, your appointments and how to order a test.' },
  { target: 'analysis.age', tab: TAB.analysis, title: 'Your KUOVA age', text: 'The age your blood test shows. Tap it to see what moves it.' },
  { target: 'lab.upload', tab: TAB.analysis, title: 'Your files', text: 'Your reports, and where you upload one you already have: a photo or the PDF.' },
  { target: 'tab.3', tab: TAB.you, title: 'You', text: 'Your health record, sharing, your watch, short reads and settings.' },
  { target: 'more.genetics', tab: TAB.you, title: 'Your genetic profile', text: 'Know your roots: a few questions on what runs in your family, to see whether it is worth talking to a professional. Genetic test results will appear here too.' },
  { target: 'more.experience', tab: TAB.you, title: 'Make it yours', text: 'What you use Kuova for shapes your experience: it decides what you see, like the plan, the daily check-in or your wearable data. Change it, or each part, in You → Configure my experience.' },
  { target: 'more.tutorial', tab: TAB.you, title: 'Watch it again', text: 'Settings, professionals, your subscription… and this tutorial, whenever you want.' },
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
