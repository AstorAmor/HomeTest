import { LogSimpleMetricScreen } from '@/screens/LogSimpleMetricScreen';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { Colors } from '@/constants/colors';

export default function LogCholesterol() {
  return (
    <LogSimpleMetricScreen
      title="Total Cholesterol"
      unit="mg/dL"
      icon="water-outline"
      color={Colors.accent}
      repo={cholesterolRepository}
    />
  );
}
