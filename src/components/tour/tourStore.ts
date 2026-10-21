import { createRef, RefObject, useSyncExternalStore } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Tutorial guiado («cómo se usa Kuova»): una pantalla oscurecida con un hueco sobre cada parte
// principal y un bocadillo que la explica. Sale al terminar los cuestionarios del inicio y desde Más.
// Aquí: los pasos, qué elemento de la pantalla es cada uno (TourTarget lo registra) y cómo empezar.
// Lo pinta TourOverlay, dentro de las pestañas.

export interface TourStep {
  target: string; // id de TourTarget
  tab: number; // pestaña en la que está (TAB.*)
  title: string;
  text: string;
}

// Si un paso no tiene su elemento (sección apagada en «Configura tu experiencia»), se salta
export const TOUR_STEPS: TourStep[] = [
  { target: 'tab.0', tab: 0, title: 'Today', text: 'Your day starts here: what is coming up, your doses and your plan.' },
  { target: 'today.checkin', tab: 0, title: 'Your check-in', text: 'How you feel each day: energy and mood in a few seconds. Tap here whenever you want to log it.' },
  { target: 'today.readiness', tab: 0, title: 'Daily readiness', text: 'Sleep, heart rate and activity from your watch. Tap the circles to set your daily goals.' },
  { target: 'today.plan', tab: 0, title: 'Your plan', text: 'The actions that can help you most, with their targets. Tap to see the full plan.' },
  { target: 'tab.1', tab: 1, title: 'My Data', text: 'Your biomarkers, your measurements and your wearable, with how they change over time.' },
  { target: 'mydata.age', tab: 1, title: 'Your KUOVA age', text: 'The age your blood test shows. Tap it to see what moves it.' },
  { target: 'lab.upload', tab: 2, title: 'Upload a report', text: 'Take a photo or upload the PDF of any blood test: we read it and explain each value.' },
  { target: 'tab.3', tab: 3, title: 'Schedule', text: 'Your appointments, deliveries and results, and a button to add them to your calendar.' },
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
