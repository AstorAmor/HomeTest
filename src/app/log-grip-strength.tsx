import { LogSimpleMetricScreen } from '@/screens/LogSimpleMetricScreen';
import { gripStrengthRepository } from '@/data/gripStrengthRepository';

// Apunte de la fuerza de agarre: el mejor intento con el dinamómetro, en kg y con un decimal (los digitales lo dan),
// solo con la fecha (como el VO2max)
export default function LogGripStrength() {
  return (
    <LogSimpleMetricScreen
      title="Grip strength"
      unit="kg"
      min={2}
      max={120}
      decimals
      initial={35}
      withTime={false}
      hint="Best of your attempts: 3 with each hand, seated, elbow at 90°."
      repo={gripStrengthRepository}
    />
  );
}
