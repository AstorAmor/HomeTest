// Check-in diario (sustituye a la rueda de cuadrantes en Today).
// La primera pregunta sitúa el momento del día y el resto se adapta a ella.

export type DayMoment = 'just_woke_up' | 'mid_day' | 'winding_down';

export type Mood = 'happy' | 'calm' | 'neutral' | 'sad' | 'anxious' | 'stressed' | 'irritable';

export interface CheckInEntry {
  id: string;
  fecha: string; // ISO datetime del check-in
  createdAt: string;
  moment: DayMoment;
  sleep?: number; // 1..5, solo por la mañana
  energy?: number; // 1..5
  stress?: number; // 1..5, a mitad del día
  dayRating?: number; // 1..5, al final del día
  mood?: Mood;
  note?: string;
}

export const MOMENT_OPTIONS: { id: DayMoment; label: string; icon: string }[] = [
  { id: 'just_woke_up', label: 'I just woke up', icon: 'sunny-outline' },
  { id: 'mid_day', label: "I've been up for a few hours", icon: 'partly-sunny-outline' },
  { id: 'winding_down', label: 'My day is winding down', icon: 'moon-outline' },
];

export const MOOD_OPTIONS: { id: Mood; label: string; emoji: string; positive: boolean }[] = [
  { id: 'happy', label: 'Happy', emoji: '😊', positive: true },
  { id: 'calm', label: 'Calm', emoji: '😌', positive: true },
  { id: 'neutral', label: 'Neutral', emoji: '😐', positive: true },
  { id: 'sad', label: 'Sad', emoji: '😔', positive: false },
  { id: 'anxious', label: 'Anxious', emoji: '😟', positive: false },
  { id: 'stressed', label: 'Stressed', emoji: '😣', positive: false },
  { id: 'irritable', label: 'Irritable', emoji: '😤', positive: false },
];
