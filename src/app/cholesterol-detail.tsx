import { useRouter } from 'expo-router';
import { GenericMetricEntry, SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';
import { peekWithLabValues, withLabValues } from '@/data/labUploadValues';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const rows = (entries: SimpleMetricEntry[]) => entries.map((e): GenericMetricEntry => ({ id: e.id, valor: e.valor, unidad: e.unidad, fecha: e.fecha }));

export default function CholesterolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Total Cholesterol')}
      color={Colors.accent}
      icon="analytics-outline"
      band={{ low: 125, high: 200 }}
      // Lo apuntado más lo que trae cada analítica subida (no se edita aquí: abre la analítica); con lo último
      // leído, al momento
      loadEntries={() => withLabValues(cholesterolRepository.getAll().then(rows), 'total_cholesterol')}
      peekEntries={() => {
        const own = cholesterolRepository.peek();
        return peekWithLabValues(own && rows(own), 'total_cholesterol');
      }}
      onAddPress={() => router.push('/log-cholesterol')}
      sample={sampleSimpleEntries('cholesterol', 'mg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-cholesterol', params: { id } })}
    />
  );
}
