import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { Colors } from '@/constants/colors';

export default function CholesterolDetail() {
  const router = useRouter();

  return (
    <SimpleMetricDetailScreen
      title="Total Cholesterol"
      color={Colors.accent}
      loadEntries={async () => {
        const entries = await cholesterolRepository.getAll();
        return entries.map((e) => ({
          id: e.id,
          valor: e.valor,
          unidad: e.unidad,
          fecha: e.fecha,
        }));
      }}
      onAddPress={() => router.push('/log-cholesterol')}
      onEditPress={(id) => router.push({ pathname: '/log-cholesterol', params: { id } })}
    />
  );
}
