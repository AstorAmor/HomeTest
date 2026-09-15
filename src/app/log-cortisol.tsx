import { LogSimpleMetricScreen } from '@/screens/LogSimpleMetricScreen';
import { cortisolRepository } from '@/data/cortisolRepository';
import { Colors } from '@/constants/colors';

export default function LogCortisol() {
  return (
    <LogSimpleMetricScreen
      title="Cortisol"
      unit="µg/dL"
      icon="moon-outline"
      color={Colors.warning}
      repo={cortisolRepository}
    />
  );
}
