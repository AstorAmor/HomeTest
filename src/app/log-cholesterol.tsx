import { LogSimpleMetricScreen } from '@/screens/LogSimpleMetricScreen';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { Colors } from '@/constants/colors';

export default function LogCholesterol() {
  return (
    <LogSimpleMetricScreen
      title="Total Cholesterol"
      unit="mg/dL"
      icon="analytics-outline"
      color={Colors.amber}
      min={80} max={400} initial={180}
      repo={cholesterolRepository}
    />
  );
}
