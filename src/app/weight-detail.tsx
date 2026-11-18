import React from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SimpleMetricDetailScreen } from '@/screens/SimpleMetricDetailScreen';
import { WeightInfo } from '@/screens/WeightInfo';
import { weightRepository } from '@/data/weightRepository';
import { loadBodyBasics, peekBodyBasics, type BodyBasics } from '@/data/bodyBasics';
import { bmi, BMI_RANGE, weightTrend } from '@/logic/weight';
import { Colors } from '@/constants/colors';
import { num, t } from '@/i18n';
import { fine } from '@/theme/fine';

// Peso: la gráfica y el historial como el resto de mediciones; debajo de la última, la tendencia de las
// últimas semanas (no el cambio de un día a otro), el IMC de ese peso con la altura del perfil y la información
// de cada cuánto pesarse. El IMC, neutro (fundador, 2026-11-16: «el peso que te dé el IMC también»): la cifra y
// el rango de la OMS en texto; sin altura, «Añade tu altura» lleva a editarla en el perfil. En la demo, sin altura
// en el perfil, sale con una de ejemplo (src/data/bodyBasics.ts); que es de ejemplo lo dice WeightInfo, debajo.
const personOf = (basics: BodyBasics) => ({ heightCm: basics.heightCm, minor: basics.age !== null && basics.age < 18 });

export default function WeightDetail() {
  const router = useRouter();
  // Con lo último leído (las pesadas y la altura del perfil), la ficha nace con la tendencia y el IMC; la red los
  // refresca detrás (fundador, 2026-11-17: «las medidas tardan en cargar»)
  const [trend, setTrend] = React.useState<ReturnType<typeof weightTrend> | null>(() => {
    const all = weightRepository.peek();
    return all ? weightTrend(all) : null;
  });
  const [person, setPerson] = React.useState<{ heightCm?: number; minor: boolean } | null>(() => {
    const basics = peekBodyBasics();
    return basics ? personOf(basics) : null;
  });
  return (
    <SimpleMetricDetailScreen
      title={t('Weight')}
      color={Colors.violet}
      icon="mci:scale-bathroom"
      loadEntries={async () => {
        const [all, basics] = await Promise.all([weightRepository.getAll(), loadBodyBasics()]);
        setTrend(weightTrend(all));
        setPerson(personOf(basics));
        return all;
      }}
      peekEntries={() => weightRepository.peek()}
      onAddPress={() => router.push('/log-weight')}
      onEditPress={(id) => router.push({ pathname: '/log-weight', params: { id } })}
      describe={(latest) => {
        const trendText =
          !trend || trend.kind === 'unknown'
            ? t('With 3 weeks of weigh-ins you will see your trend.')
            : trend.kind === 'stable'
              ? t('Stable over the last weeks')
              : t(trend.kind === 'down' ? 'Going down about {v} kg a week' : 'Going up about {v} kg a week', { v: num(Math.abs(trend.perWeek ?? 0).toFixed(1)) });
        if (!person) return trendText;
        const value = bmi(latest, person.heightCm);
        if (value == null && person.heightCm) return trendText; // con altura pero un peso que no cuadra
        return (
          <>
            {value != null ? (
              person.minor ? (
                t('BMI {v}', { v: num(value.toFixed(1)) })
              ) : (
                `${t('BMI {v}', { v: num(value.toFixed(1)) })} · ${t('WHO range: {range}', { range: `${num(BMI_RANGE.min)}–${num(BMI_RANGE.max)}` })}`
              )
            ) : (
              <Text style={fine.link} onPress={() => router.push({ pathname: '/profile', params: { edit: 'height' } })} accessibilityRole="link">
                {t('Add your height to see your BMI')}
              </Text>
            )}
            {'\n'}
            {trendText}
          </>
        );
      }}
      extra={<WeightInfo />}
    />
  );
}
