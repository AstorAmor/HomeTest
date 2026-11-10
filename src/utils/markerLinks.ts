import type { Href } from 'expo-router';
import { OWN_SCREEN } from '@/logic/labMarkers';
import { getMarkerDisplayNameEn } from '@/data/reportContentEn';

// Adónde lleva tocar un valor de una analítica (fundador, 2026-11-06: «pinchar en las analíticas y mostrar
// el marcador en tus datos»): glucosa, colesterol total y cortisol a su ficha de Mis datos (también se
// apuntan a mano); el resto, a la ficha del marcador con todos sus valores. «from» = de qué analítica
// vienes («upload:<id>» o «report:<id>»), para señalarla en la lista.
export const markerHref = (key: string, from?: string): Href =>
  (OWN_SCREEN[key] ?? { pathname: '/lab-marker', params: from ? { key, from } : { key } }) as Href;

// El nombre de un marcador: el del catálogo (el mismo en todas las analíticas) o, si no se reconoce, como lo
// escribe el laboratorio
export const markerName = (key: string, fallback: string) => (key.startsWith('n:') ? fallback : getMarkerDisplayNameEn(key, fallback));
