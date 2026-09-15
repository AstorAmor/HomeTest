import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExtractedParametro } from '@/types/labReport';
import { Colors } from '@/constants/colors';
import { getAlternateUnit, convertValue } from '@/utils/unitConversion';
import { getRangeStatus, RANGE_STATUS_LABEL } from '@/utils/rangeStatus';
import { UnitLabel } from './UnitLabel';

const statusColor = (status: ReturnType<typeof getRangeStatus>) => {
  switch (status) {
    case 'en_rango':
      return Colors.accent;
    case 'sin_rango':
      return Colors.textSecondary;
    default:
      return Colors.danger;
  }
};

const formatNumber = (n: number) => {
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toString();
};

const buildInfoText = (nombre: string) =>
  `${nombre} es uno de los parámetros medidos en tu analítica. Los valores fuera del rango de referencia no implican necesariamente un problema de salud, pero conviene comentarlos con tu médico. (Contenido de ejemplo — próximamente información médica verificada por parámetro).`;

interface LabReportRowProps {
  parametro: ExtractedParametro;
}

export const LabReportRow = ({ parametro }: LabReportRowProps) => {
  const alternate = useMemo(
    () => getAlternateUnit(parametro.nombre, parametro.unidad),
    [parametro.nombre, parametro.unidad]
  );
  const [useAlternate, setUseAlternate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const factor = useAlternate && alternate ? alternate.factor : 1;
  const unidadMostrada = useAlternate && alternate ? alternate.unit : parametro.unidad;
  const unidadAlternativa = useAlternate ? parametro.unidad : alternate?.unit;
  const valorMostrado = convertValue(parametro.valor, factor);
  const rangoMinMostrado =
    parametro.rango_min !== null ? convertValue(parametro.rango_min, factor) : null;
  const rangoMaxMostrado =
    parametro.rango_max !== null ? convertValue(parametro.rango_max, factor) : null;

  const status = getRangeStatus(parametro.valor, parametro.rango_min, parametro.rango_max);
  const color = statusColor(status);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.name}>{parametro.nombre}</Text>
        <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.badgeText, { color }]}>{RANGE_STATUS_LABEL[status]}</Text>
        </View>
      </View>

      <View style={styles.valueBlock}>
        <Text style={styles.value}>{formatNumber(valorMostrado)}</Text>
        <View style={styles.unitRow}>
          <UnitLabel unit={unidadMostrada} style={styles.unit} />

          {alternate && unidadAlternativa && (
            <TouchableOpacity
              style={styles.toggle}
              onPress={() => setUseAlternate((v) => !v)}
              hitSlop={8}
            >
              <Ionicons name="swap-horizontal" size={14} color={Colors.accent} />
              <UnitLabel unit={unidadAlternativa} style={styles.toggleText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {rangoMinMostrado !== null && rangoMaxMostrado !== null && (
        <Text style={styles.range}>
          Rango: {formatNumber(rangoMinMostrado)} – {formatNumber(rangoMaxMostrado)}{' '}
          <UnitLabel unit={unidadMostrada} style={styles.range} />
        </Text>
      )}

      {showInfo && <Text style={styles.infoText}>{buildInfoText(parametro.nombre)}</Text>}

      <TouchableOpacity
        style={styles.infoButton}
        onPress={() => setShowInfo((v) => !v)}
        hitSlop={8}
      >
        <Ionicons
          name={showInfo ? 'information-circle' : 'information-circle-outline'}
          size={20}
          color={Colors.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    paddingBottom: 18,
    marginBottom: 10,
    position: 'relative',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  valueBlock: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: 34,
    fontWeight: '700',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  unit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accentSoft,
  },
  toggleText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  range: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  infoButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
});
