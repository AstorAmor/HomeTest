import { useRouter } from 'expo-router';
import { GenericMetricEntry, SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { getGlucoseEntries, glucoseRepository } from '@/data/glucoseRepository';
import { GlucoseEntry, MEAL_TYPE_LABEL } from '@/types/glucose';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';
import { peekWithLabValues, withLabValues } from '@/data/labUploadValues';

const rows = (entries: GlucoseEntry[]) =>
  entries.map((e): GenericMetricEntry => ({
    id: e.id,
    valor: e.valor,
    unidad: e.unidad,
    fecha: e.fecha,
    extra: t(MEAL_TYPE_LABEL[e.mealType]),
  }));

export default function GlucoseDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Blood Glucose')}
      color={Colors.accent}
      icon="glucose"
      band={{ low: 70, high: 99 }}
      // Lo apuntado más lo que trae cada analítica subida (no se edita aquí: abre la analítica); con lo último
      // leído, al momento
      loadEntries={() => withLabValues(getGlucoseEntries().then(rows), 'glucose')}
      peekEntries={() => {
        const own = glucoseRepository.peek();
        return peekWithLabValues(own && rows(own), 'glucose');
      }}
      onAddPress={() => router.push('/log-glucose')}
      sample={sampleSimpleEntries('sugar', 'mg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-glucose', params: { id } })}
    />
  );
}
