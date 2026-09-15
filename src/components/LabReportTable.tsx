import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ExtractedLabReport, ExtractedParametro } from '@/types/labReport';
import { Colors } from '@/constants/colors';
import { LabReportRow } from './LabReportRow';

interface LabReportTableProps {
  report: ExtractedLabReport;
  onUpdateParametro?: (
    seccionIndex: number,
    parametroIndex: number,
    updated: ExtractedParametro
  ) => void;
}

const PATIENT_FIELDS: { key: keyof ExtractedLabReport['paciente']; label: string }[] = [
  { key: 'nombre', label: 'Paciente' },
  { key: 'fecha_recepcion', label: 'Recepción' },
  { key: 'fecha_validacion', label: 'Validación' },
  { key: 'numero_informe', label: 'Nº informe' },
  { key: 'laboratorio', label: 'Laboratorio' },
];

export const LabReportTable = ({ report, onUpdateParametro }: LabReportTableProps) => {
  const hasPatientInfo = PATIENT_FIELDS.some((f) => report.paciente?.[f.key]);

  return (
    <View>
      {hasPatientInfo && (
        <View style={styles.patientCard}>
          {PATIENT_FIELDS.map(
            (f) =>
              report.paciente?.[f.key] && (
                <View key={f.key} style={styles.patientRow}>
                  <Text style={styles.patientLabel}>{f.label}</Text>
                  <Text style={styles.patientValue}>{report.paciente[f.key]}</Text>
                </View>
              )
          )}
        </View>
      )}

      {report.secciones.map((seccion, seccionIndex) => (
        <View key={seccion.titulo} style={styles.section}>
          <Text style={styles.sectionTitle}>{seccion.titulo}</Text>
          {seccion.parametros.map((param, parametroIndex) => (
            <LabReportRow
              key={`${param.nombre}-${parametroIndex}`}
              parametro={param}
              onUpdate={
                onUpdateParametro
                  ? (updated) => onUpdateParametro(seccionIndex, parametroIndex, updated)
                  : undefined
              }
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  patientCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 6,
  },
  patientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  patientLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  patientValue: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
});
