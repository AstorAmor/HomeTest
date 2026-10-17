import { useRouter } from 'expo-router';
import { GenericMetricEntry, SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';
import { LAB_VALUE_LABEL, labValues } from '@/data/labUploadValues';

export default function CholesterolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Total Cholesterol')}
      color={Colors.accent}
      icon="analytics-outline"
      band={{ low: 125, high: 200 }}
      loadEntries={async () => {
        const entries = await cholesterolRepository.getAll();
        return entries.map((e): GenericMetricEntry => ({
          id: e.id,
          valor: e.valor,
          unidad: e.unidad,
          fecha: e.fecha,
        })).concat(
          // Lo que trae cada analítica subida (no se edita aquí: abre la analítica)
          (await labValues('total_cholesterol')).map((l) => ({ id: l.id, valor: l.valor, unidad: l.unidad, fecha: l.fecha, extra: LAB_VALUE_LABEL(), uploadId: l.uploadId })),
        );
      }}
      onAddPress={() => router.push('/log-cholesterol')}
      sample={sampleSimpleEntries('cholesterol', 'mg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-cholesterol', params: { id } })}
    />
  );
}
