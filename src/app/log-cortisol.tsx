import { LogSimpleMetricScreen } from '@/screens/LogSimpleMetricScreen';
import { cortisolRepository } from '@/data/cortisolRepository';
import { Colors } from '@/constants/colors';

export default function LogCortisol() {
  return (
    <LogSimpleMetricScreen
      title="Cortisol"
      unit="µg/dL"
      icon="sunny-outline"
      color={Colors.violet}
      min={1} max={40} decimals initial={12}
      repo={cortisolRepository}
    />
  );
}
