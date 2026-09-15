import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { MEAL_TYPE_LABEL } from '@/types/glucose';
import { Colors } from '@/constants/colors';

export default function GlucoseDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title="Blood Glucose"
      color={Colors.accent}
      loadEntries={async () => {
        const entries = await getGlucoseEntries();
        return entries.map((e) => ({
          id: e.id,
          valor: e.valor,
          unidad: e.unidad,
          fecha: e.fecha,
          extra: MEAL_TYPE_LABEL[e.mealType],
        }));
      }}
      onAddPress={() => router.push('/log-glucose')}
      onEditPress={(id) => router.push({ pathname: '/log-glucose', params: { id } })}
    />
  );
}
