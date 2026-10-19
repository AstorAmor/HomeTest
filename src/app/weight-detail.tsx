import React from 'react';
import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { WeightInfo } from '@/screens/WeightInfo';
import { weightRepository } from '@/data/weightRepository';
import { weightTrend } from '@/logic/weight';
import { Colors } from '@/constants/colors';
import { num, t } from '@/i18n';

// Peso: la gráfica y el historial como el resto de mediciones; debajo de la última, la tendencia de las
// últimas semanas (no el cambio de un día a otro) y la información de cada cuánto pesarse.
export default function WeightDetail() {
  const router = useRouter();
  const [trend, setTrend] = React.useState<ReturnType<typeof weightTrend> | null>(null);
  return (
    <SimpleMetricDetailScreen
      title={t('Weight')}
      color={Colors.violet}
      icon="mci:scale-bathroom"
      loadEntries={async () => {
        const all = await weightRepository.getAll();
        setTrend(weightTrend(all));
        return all;
      }}
      onAddPress={() => router.push('/log-weight')}
      onEditPress={(id) => router.push({ pathname: '/log-weight', params: { id } })}
      describe={() =>
        !trend || trend.kind === 'unknown'
          ? t('With 3 weeks of weigh-ins you will see your trend.')
          : trend.kind === 'stable'
            ? t('Stable over the last weeks')
            : t(trend.kind === 'down' ? 'Going down about {v} kg a week' : 'Going up about {v} kg a week', { v: num(Math.abs(trend.perWeek ?? 0).toFixed(1)) })
      }
      extra={<WeightInfo />}
    />
  );
}
