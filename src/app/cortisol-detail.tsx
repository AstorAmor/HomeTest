import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cortisolRepository } from '@/data/cortisolRepository';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';

export default function CortisolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Cortisol')}
      color={Colors.warning}
      loadEntries={async () => {
        const entries = await cortisolRepository.getAll();
        return entries.map((e) => ({
          id: e.id,
          valor: e.valor,
          unidad: e.unidad,
          fecha: e.fecha,
        }));
      }}
      onAddPress={() => router.push('/log-cortisol')}
      sample={sampleSimpleEntries('cortisol', 'µg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-cortisol', params: { id } })}
    />
  );
}
