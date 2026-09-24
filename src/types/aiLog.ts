export type MoodQuadrant = 'anxious' | 'happy' | 'sad' | 'calm';

// Distribución 2x2: eje X = Ánimo (Negativo/Positivo), eje Y = Energía (Alta/Baja).
// anxious = alta energía + negativo, happy = alta energía + positivo,
// sad = baja energía + negativo, calm = baja energía + positivo.
export const MOOD_QUADRANTS: MoodQuadrant[] = ['anxious', 'happy', 'sad', 'calm'];

export const MOOD_QUADRANT_INFO: Record<MoodQuadrant, { label: string; emoji: string; color: string }> = {
  anxious: { label: 'Anxious', emoji: '⛈️', color: '#E8615C' },
  happy: { label: 'Happy', emoji: '☀️', color: '#F0B84D' },
  sad: { label: 'Sad', emoji: '🌧️', color: '#5B8DEF' },
  calm: { label: 'Calm', emoji: '🌴', color: '#3ECDB8' },
};

export interface AiLogEntry {
  id: string;
  fecha: string; // ISO timestamp del registro
  createdAt: string;
  quadrant: MoodQuadrant;
  intensity: number; // 0-100, marcado en la escala de energía vertical
  note: string; // texto escrito por el usuario, vacío si solo se usó audio
  hasAudio: boolean;
  transcript: string | null; // rellenado por la IA (transcripción del audio o eco del texto)
  summary: string | null; // resumen extraído por la IA
  tags: string[]; // palabras clave extraídas por la IA
}

export interface AiLogExtraction {
  transcript: string | null;
  summary: string;
  tags: string[];
}
