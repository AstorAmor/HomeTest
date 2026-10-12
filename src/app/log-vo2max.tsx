import { LogSimpleMetricScreen } from '@/screens/LogSimpleMetricScreen';
import { vo2maxRepository } from '@/data/vo2maxRepository';
import { Colors } from '@/constants/colors';

export default function LogVo2max() {
  return (
    <LogSimpleMetricScreen
      title="VO2max"
      unit="mL/kg/min"
      icon="mci:lungs"
      color={Colors.sky}
      min={10}
      max={90}
      decimals
      initial={40}
      repo={vo2maxRepository}
    />
  );
}
