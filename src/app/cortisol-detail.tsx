import { useRouter } from 'expo-router';
import { GenericMetricEntry, SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cortisolRepository } from '@/data/cortisolRepository';
import { Colors } from '@/constants/colors';
import { sampleSimpleEntries } from '@/data/sampleReadings';
import { t } from '@/i18n';
import { LAB_VALUE_LABEL, labValues } from '@/data/labUploadValues';

export default function CortisolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title={t('Cortisol')}
      color={Colors.warning}
      icon="sunny-outline"
      loadEntries={async () => {
        const entries = await cortisolRepository.getAll();
        return entries.map((e): GenericMetricEntry => ({
          id: e.id,
          valor: e.valor,
          unidad: e.unidad,
          fecha: e.fecha,
        })).concat(
          // Lo que trae cada analítica subida (no se edita aquí: abre la analítica)
          (await labValues('cortisol_am')).map((l) => ({ id: l.id, valor: l.valor, unidad: l.unidad, fecha: l.fecha, extra: LAB_VALUE_LABEL(), uploadId: l.uploadId })),
        );
      }}
      onAddPress={() => router.push('/log-cortisol')}
      sample={sampleSimpleEntries('cortisol', 'µg/dL')}
      onEditPress={(id) => router.push({ pathname: '/log-cortisol', params: { id } })}
    />
  );
}
