import { DailyWearableRecord } from '../types';

// Lo que comparten appleHealth.ts (Android y web) y appleHealth.ios.ts (iPhone). Va en un archivo
// aparte, sin versión .ios, porque en iOS './appleHealth' es el propio appleHealth.ios.ts: si se
// reexportara de ahí, la constante se leería a sí misma sin fin y la pantalla Wearables cerraría la
// app (pasó en la compilación 1.1.0 (3), 2026-11-02).

export interface AppleHealthRead {
  records: DailyWearableRecord[];
  from: string; // primer día leído (YYYY-MM-DD)
  // Por tipo: cuántos días traen datos y de qué apps (para explicar qué llega y qué no)
  found: Record<string, { days: number; sources: string[] }>;
}

// Tipos que se leen, en el orden en que se enseñan, y su métrica de Kuova
export const APPLE_READ_TYPES = ['Steps', 'SleepSession', 'RestingHeartRate', 'HeartRate', 'HeartRateVariabilitySDNN', 'ActiveCaloriesBurned', 'Distance'] as const;
export const APPLE_TYPE_LABEL: Record<string, string> = {
  Steps: 'Steps',
  SleepSession: 'Sleep',
  RestingHeartRate: 'Resting heart rate',
  HeartRate: 'Heart rate',
  HeartRateVariabilitySDNN: 'HRV',
  ActiveCaloriesBurned: 'Active energy',
  Distance: 'Distance',
};
