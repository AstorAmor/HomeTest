import { createMetricRepository } from './metricRepository';
import { CheckInEntry, DayMoment, Mood } from '@/types/checkIn';

export const checkInRepository = createMetricRepository<CheckInEntry>('hometest:check_ins');

// Puntuación de ánimo 1..5 a partir del estado elegido, para poder dibujarlo.
const MOOD_SCORE: Record<Mood, number> = {
  happy: 5,
  calm: 4.5,
  neutral: 3,
  sad: 2,
  anxious: 1.8,
  stressed: 1.8,
  irritable: 2,
};

export interface DailyCheckInPoint {
  date: string; // YYYY-MM-DD
  energy: number;
  mood: number;
}

// Agrega por día (media) para el gráfico diario: si alguien hace varios
// check-ins en el mismo día, se promedian.
export function dailyCheckInSeries(entries: CheckInEntry[], days = 7): DailyCheckInPoint[] {
  const byDay = new Map<string, { energy: number[]; mood: number[] }>();
  for (const e of entries) {
    const day = e.fecha.slice(0, 10);
    const bucket = byDay.get(day) ?? { energy: [], mood: [] };
    if (e.energy) bucket.energy.push(e.energy);
    if (e.mood) bucket.mood.push(MOOD_SCORE[e.mood]);
    byDay.set(day, bucket);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  return [...byDay.entries()]
    .map(([date, b]) => ({ date, energy: avg(b.energy), mood: avg(b.mood) }))
    .filter((p) => !Number.isNaN(p.energy) && !Number.isNaN(p.mood))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

// Serie de ejemplo para que el gráfico no salga vacío en la demo.
export function sampleCheckInSeries(days = 7, today = new Date()): DailyCheckInPoint[] {
  const energy = [3.5, 4, 3, 4, 3.5, 2.5, 2];
  const mood = [4, 4.5, 3.5, 4, 4, 3, 2.5];
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * 24 * 3600 * 1000);
    return { date: d.toISOString().slice(0, 10), energy: energy[i % 7], mood: mood[i % 7] };
  });
}

export function suggestMoment(date = new Date()): DayMoment {
  const h = date.getHours();
  if (h < 11) return 'just_woke_up';
  if (h < 19) return 'mid_day';
  return 'winding_down';
}

export interface Suggestion {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  minutes: number;
}

// Recomendaciones del check-in: SIEMPRE opcionales. Reglas simples por ahora;
// se sustituirán por el motor de recomendaciones.
export function checkInSuggestions(entry: Omit<CheckInEntry, 'id' | 'createdAt'>): Suggestion[] {
  const out: Suggestion[] = [];
  const negativeMood = entry.mood && ['sad', 'anxious', 'stressed', 'irritable'].includes(entry.mood);
  const lowEnergy = (entry.energy ?? 3) <= 2;

  if (entry.moment === 'just_woke_up') {
    if (lowEnergy || (entry.sleep ?? 3) <= 2) {
      out.push({ id: 'activation', title: 'Wake-up activation', subtitle: 'Mobility + light cardio to get going', icon: 'body-outline', minutes: 5 });
    }
    out.push({ id: 'breathing_am', title: 'Morning breathing', subtitle: 'Set the tone for the day', icon: 'leaf-outline', minutes: 2 });
    if ((entry.sleep ?? 3) <= 2) {
      out.push({ id: 'sunlight', title: 'Get some daylight', subtitle: 'Helps reset your body clock after a bad night', icon: 'sunny-outline', minutes: 10 });
    }
  }

  if (entry.moment === 'mid_day') {
    if (negativeMood || (entry.stress ?? 3) >= 4) {
      out.push({ id: 'box_breathing', title: 'Box breathing', subtitle: 'Four counts in, hold, out, hold', icon: 'square-outline', minutes: 3 });
    }
    if (lowEnergy) {
      out.push({ id: 'walk', title: 'Short walk outside', subtitle: 'A better pick-me-up than more coffee', icon: 'walk-outline', minutes: 10 });
    }
    out.push({ id: 'mindful_pause', title: 'Mindful pause', subtitle: 'A quick reset between tasks', icon: 'pause-circle-outline', minutes: 2 });
  }

  if (entry.moment === 'winding_down') {
    out.push({ id: 'body_scan', title: 'Body scan meditation', subtitle: 'Wind down before bed', icon: 'moon-outline', minutes: 10 });
    out.push({ id: 'stretch', title: 'Gentle stretching', subtitle: 'Release the tension of the day', icon: 'accessibility-outline', minutes: 8 });
    if (negativeMood) {
      out.push({ id: 'journal', title: 'Write it down', subtitle: 'Three lines about your day to clear your head', icon: 'create-outline', minutes: 3 });
    }
  }

  return out.slice(0, 3);
}
