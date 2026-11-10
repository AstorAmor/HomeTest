import { WorkoutSessionScreen } from '@/screens/workouts/WorkoutSessionScreen';
import { gated } from '@/components/FeatureGate';

// Entrenamientos va con la suscripción: en modo gratis, su candado (fundador, 2026-11-06)
export default gated('workouts', WorkoutSessionScreen);
