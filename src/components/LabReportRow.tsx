import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExtractedParametro } from '@/types/labReport';
import { Colors } from '@/constants/colors';
import { getAlternateUnit, convertValue } from '@/utils/unitConversion';
import { getRangeStatus, RANGE_STATUS_LABEL } from '@/utils/rangeStatus';
import { getParameterInfo } from '@/utils/parameterInfo';
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

interface LabReportRowProps {
  parametro: ExtractedParametro;
  onUpdate?: (updated: ExtractedParametro) => void;
}

export const LabReportRow = ({ parametro, onUpdate }: LabReportRowProps) => {
  const alternate = useMemo(
    () => getAlternateUnit(parametro.nombre, parametro.unidad),
    [parametro.nombre, parametro.unidad]
  );
  const [useAlternate, setUseAlternate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState({
    nombre: parametro.nombre,
    unidad: parametro.unidad,
    valor: String(parametro.valor),
    rango_min: parametro.rango_min !== null ? String(parametro.rango_min) : '',
    rango_max: parametro.rango_max !== null ? String(parametro.rango_max) : '',
  });

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

  const startEditing = () => {
    setDraft({
      nombre: parametro.nombre,
      unidad: parametro.unidad,
      valor: String(parametro.valor),
      rango_min: parametro.rango_min !== null ? String(parametro.rango_min) : '',
      rango_max: parametro.rango_max !== null ? String(parametro.rango_max) : '',
    });
    setIsEditing(true);
  };

  const cancelEditing = () => setIsEditing(false);

  const saveEditing = () => {
    const valorNum = parseFloat(draft.valor.replace(',', '.'));
    if (Number.isNaN(valorNum)) return;

    const minNum = draft.rango_min.trim() === '' ? null : parseFloat(draft.rango_min.replace(',', '.'));
    const maxNum = draft.rango_max.trim() === '' ? null : parseFloat(draft.rango_max.replace(',', '.'));

    onUpdate?.({
      nombre: draft.nombre.trim() || parametro.nombre,
      unidad: draft.unidad.trim() || parametro.unidad,
      valor: valorNum,
      rango_min: minNum !== null && Number.isNaN(minNum) ? null : minNum,
      rango_max: maxNum !== null && Number.isNaN(maxNum) ? null : maxNum,
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <View style={styles.card}>
        <Text style={styles.editLabel}>Name</Text>
        <TextInput
          style={styles.input}
          value={draft.nombre}
          onChangeText={(v) => setDraft((d) => ({ ...d, nombre: v }))}
          placeholderTextColor={Colors.textMuted}
        />

        <View style={styles.editRow}>
          <View style={styles.editCol}>
            <Text style={styles.editLabel}>Value</Text>
            <TextInput
              style={styles.input}
              value={draft.valor}
              onChangeText={(v) => setDraft((d) => ({ ...d, valor: v }))}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.editCol}>
            <Text style={styles.editLabel}>Unit</Text>
            <TextInput
              style={styles.input}
              value={draft.unidad}
              onChangeText={(v) => setDraft((d) => ({ ...d, unidad: v }))}
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.editRow}>
          <View style={styles.editCol}>
            <Text style={styles.editLabel}>Min range</Text>
            <TextInput
              style={styles.input}
              value={draft.rango_min}
              onChangeText={(v) => setDraft((d) => ({ ...d, rango_min: v }))}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <View style={styles.editCol}>
            <Text style={styles.editLabel}>Max range</Text>
            <TextInput
              style={styles.input}
              value={draft.rango_max}
              onChangeText={(v) => setDraft((d) => ({ ...d, rango_max: v }))}
              keyboardType="numeric"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.editActions}>
          <TouchableOpacity style={styles.editCancelButton} onPress={cancelEditing}>
            <Text style={styles.editCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editSaveButton} onPress={saveEditing}>
            <Ionicons name="checkmark" size={16} color={Colors.background} />
            <Text style={styles.editSaveText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        <View style={styles.rangeRow}>
          <Text style={styles.range}>
            Range: {formatNumber(rangoMinMostrado)} – {formatNumber(rangoMaxMostrado)}{' '}
          </Text>
          <UnitLabel unit={unidadMostrada} style={styles.range} />
        </View>
      )}

      {showInfo && <Text style={styles.infoText}>{getParameterInfo(parametro.nombre)}</Text>}

      <View style={styles.cornerActions}>
        <TouchableOpacity style={styles.cornerButton} onPress={startEditing} hitSlop={8}>
          <Ionicons name="pencil-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cornerButton}
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
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  range: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    marginBottom: 26,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  cornerActions: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cornerButton: {
    padding: 2,
  },
  editLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  editRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editCol: {
    flex: 1,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  editCancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  editCancelText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  editSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editSaveText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
});
