import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cortisolRepository } from '@/data/cortisolRepository';
import { Colors } from '@/constants/colors';

export default function CortisolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title="Cortisol"
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
      onEditPress={(id) => router.push({ pathname: '/log-cortisol', params: { id } })}
    />
  );
}
