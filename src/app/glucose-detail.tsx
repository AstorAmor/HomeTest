import { useRouter } from 'expo-router';
import { GenericMetricEntry, SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { MEAL_TYPE_LABEL } from '@/types/glucose';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';
import { LAB_VALUE_LABEL, labValues } from '@/data/labUploadValues';

export default function GlucoseDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Blood Glucose')}
      color={Colors.accent}
      icon="glucose"
      band={{ low: 70, high: 99 }}
      loadEntries={async () => {
        const entries = await getGlucoseEntries();
        return entries.map((e): GenericMetricEntry => ({
          id: e.id,
          valor: e.valor,
          unidad: e.unidad,
          fecha: e.fecha,
          extra: t(MEAL_TYPE_LABEL[e.mealType]),
        })).concat(
          // Lo que trae cada analítica subida (no se edita aquí: abre la analítica)
          (await labValues('glucose')).map((l) => ({ id: l.id, valor: l.valor, unidad: l.unidad, fecha: l.fecha, extra: LAB_VALUE_LABEL(), uploadId: l.uploadId })),
        );
      }}
      onAddPress={() => router.push('/log-glucose')}
      sample={sampleSimpleEntries('sugar', 'mg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-glucose', params: { id } })}
    />
  );
}
