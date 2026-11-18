import { useRouter } from 'expo-router';
import { GenericMetricEntry, SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cortisolRepository } from '@/data/cortisolRepository';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';
import { peekWithLabValues, withLabValues } from '@/data/labUploadValues';
import { SimpleMetricEntry } from '@/types/simpleMetric';

const rows = (entries: SimpleMetricEntry[]) => entries.map((e): GenericMetricEntry => ({ id: e.id, valor: e.valor, unidad: e.unidad, fecha: e.fecha }));

export default function CortisolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Cortisol')}
      color={Colors.warning}
      icon="sunny-outline"
      // Lo apuntado más lo que trae cada analítica subida (no se edita aquí: abre la analítica); con lo último
      // leído, al momento
      loadEntries={() => withLabValues(cortisolRepository.getAll().then(rows), 'cortisol_am')}
      peekEntries={() => {
        const own = cortisolRepository.peek();
        return peekWithLabValues(own && rows(own), 'cortisol_am');
      }}
      onAddPress={() => router.push('/log-cortisol')}
      sample={sampleSimpleEntries('cortisol', 'µg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-cortisol', params: { id } })}
    />
  );
}
