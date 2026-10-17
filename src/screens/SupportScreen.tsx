import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { TAB, tabHref } from '@/constants/tabs';
import { scopeLabel, ShareScope } from '@/data/sharing';
import {
  MIN_REASON_LENGTH,
  SupportFile,
  SupportGrant,
  supportListGrants,
  supportOpenFile,
  supportRead,
  SupportReadResult,
} from '@/data/support';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });

// Campos que no aportan nada al revisar una incidencia
const HIDDEN_FIELDS = new Set(['id', 'user_id', 'patient_id']);

const fieldText = (v: unknown) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v));

// Una fila tal cual viene de la base de datos: recortada hasta tocarla
const RowCard = ({ row }: { row: Record<string, unknown> }) => {
  const [open, setOpen] = useState(false);
  const fields = Object.entries(row).filter(([k, v]) => !HIDDEN_FIELDS.has(k) && v !== null && v !== '');
  return (
    <TouchableOpacity style={styles.row} onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
      {fields.map(([k, v]) => {
        const text = fieldText(v);
        return (
          <Text key={k} style={styles.rowText} numberOfLines={open ? undefined : 2}>
            <Text style={styles.rowKey}>{k}: </Text>
            {open || text.length <= 300 ? text : `${text.slice(0, 300)}…`}
          </Text>
        );
      })}
    </TouchableOpacity>
  );
};

// Soporte KUOVA: usuarios que han dado permiso a soporte. Leer pasa por support_read() y abrir
// un archivo por support_open_file(): las dos exigen motivo y dejan el acceso registrado.
// La base de datos lo comprueba en cada llamada; esta pantalla solo lo hace cómodo.
export const SupportScreen = () => {
  const { isSupportAgent } = useAuth();
  const [grants, setGrants] = useState<SupportGrant[] | null>(null);
  const [selected, setSelected] = useState<SupportGrant | null>(null);
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState<ShareScope | null>(null);
  const [result, setResult] = useState<SupportReadResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isSupportAgent) return;
    try {
      setGrants(await supportListGrants());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not load support permissions'));
    }
  }, [isSupportAgent]);

  useReloadOnFocus(load);

  // Cada usuario es una incidencia distinta: el motivo y lo leído no pasan de uno a otro
  const select = (g: SupportGrant | null) => {
    setSelected(g);
    setReason('');
    setScope(null);
    setResult(null);
    setError('');
  };

  const reasonOk = reason.trim().length >= MIN_REASON_LENGTH;

  const read = async (sc: ShareScope) => {
    if (!selected || !reasonOk) return;
    setBusy(true);
    setError('');
    setScope(sc);
    setResult(null);
    try {
      setResult(await supportRead(selected.shareId, sc, reason.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not read the data'));
    } finally {
      setBusy(false);
    }
  };

  const openFile = async (f: SupportFile) => {
    if (!selected || !reasonOk) return;
    setError('');
    try {
      await Linking.openURL(await supportOpenFile(selected.shareId, f, reason.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Could not open the file'));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Support access')} showBack backFallback={tabHref(TAB.more)} />

        <View style={styles.intro}>
          <Ionicons name="shield-checkmark" size={22} color={Colors.accent} />
          <Text style={styles.introText}>
            {t('Only users who gave permission appear here, with the categories and until the date they chose. Every read and every file you open is recorded with your reason. Do not open health tables in the Supabase dashboard.')}
          </Text>
        </View>

        {!isSupportAgent ? (
          <Text style={styles.muted}>{t('This screen is only for KUOVA support accounts.')}</Text>
        ) : !selected ? (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {grants === null && !error ? (
              <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
            ) : (grants ?? []).length === 0 ? (
              <Text style={styles.muted}>{t('Nobody has given support access right now.')}</Text>
            ) : (
              (grants ?? []).map((g) => (
                <TouchableOpacity key={g.shareId} style={styles.card} onPress={() => select(g)} activeOpacity={0.85}>
                  <Text style={styles.name}>{g.patientName || g.patientEmail || g.patientId}</Text>
                  {g.patientEmail ? <Text style={styles.meta}>{g.patientEmail}</Text> : null}
                  <Text style={styles.meta}>
                    {t('since {date}', { date: formatDate(g.grantedAt) })} · {t('until {date}', { date: formatDate(g.expiresAt) })}
                  </Text>
                  {g.note ? <Text style={styles.note}>“{g.note}”</Text> : null}
                  <View style={styles.chips}>
                    {g.scopes.map((sc) => (
                      <View key={sc} style={styles.chip}>
                        <Text style={styles.chipText}>{scopeLabel(sc)}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.backRow} onPress={() => select(null)}>
              <Ionicons name="chevron-back" size={16} color={Colors.accent} />
              <Text style={styles.link}>{t('All users')}</Text>
            </TouchableOpacity>

            <View style={styles.card}>
              <Text style={styles.name}>{selected.patientName || selected.patientEmail || selected.patientId}</Text>
              {selected.patientEmail ? <Text style={styles.meta}>{selected.patientEmail}</Text> : null}
              <Text style={styles.meta}>{t('until {date}', { date: formatDate(selected.expiresAt) })}</Text>
              {selected.note ? <Text style={styles.note}>“{selected.note}”</Text> : null}
            </View>

            <Text style={styles.sectionTitle}>{t('Reason')}</Text>
            <TextInput
              style={styles.input}
              value={reason}
              onChangeText={setReason}
              placeholder={t('Ticket or issue, e.g. "Email 12/10: PDF not read correctly"')}
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
            />
            <Text style={styles.hint}>
              {t('At least {n} characters. It is saved with every access.', { n: MIN_REASON_LENGTH })}
            </Text>

            <Text style={styles.sectionTitle}>{t('What to look at')}</Text>
            <View style={styles.scopeRow}>
              {selected.scopes.map((sc) => (
                <TouchableOpacity
                  key={sc}
                  style={[styles.scopeButton, scope === sc && styles.scopeButtonOn, !reasonOk && styles.disabled]}
                  disabled={!reasonOk || busy}
                  onPress={() => read(sc)}
                >
                  <Text style={styles.scopeButtonText}>{scopeLabel(sc)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy ? <ActivityIndicator color={Colors.accent} style={{ marginTop: 16 }} /> : null}

            {result && (
              <>
                {Object.entries(result.tables).map(([table, rows]) => (
                  <View key={table}>
                    <Text style={styles.tableTitle}>
                      {table} · {rows.length}
                    </Text>
                    {rows.length === 0 ? (
                      <Text style={styles.muted}>{t('No records.')}</Text>
                    ) : (
                      rows.map((r, i) => <RowCard key={i} row={r} />)
                    )}
                  </View>
                ))}
                {result.files.length > 0 && (
                  <>
                    <Text style={styles.tableTitle}>
                      {t('Files')} · {result.files.length}
                    </Text>
                    {result.files.map((f) => (
                      <View key={f.path} style={styles.fileRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowText} numberOfLines={1}>
                            {f.path.split('/').pop()}
                          </Text>
                          <Text style={styles.meta}>
                            {formatDate(f.createdAt)}
                            {f.size ? ` · ${Math.round(f.size / 1024)} KB` : ''}
                          </Text>
                        </View>
                        <TouchableOpacity style={styles.openButton} onPress={() => openFile(f)}>
                          <Text style={styles.link}>{t('Open')}</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </>
                )}
                <Text style={styles.hint}>{t('Latest 60 records per table. This read has been recorded.')}</Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: Colors.accentSoft,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 18,
  },
  introText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 19 },
  muted: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  error: { color: Colors.danger, fontSize: 13, paddingHorizontal: 20, marginVertical: 10 },
  hint: { color: Colors.textMuted, fontSize: 12, paddingHorizontal: 20, marginTop: 6 },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  name: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  note: { color: Colors.textSecondary, fontSize: 13, fontStyle: 'italic', marginTop: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 },
  chip: { backgroundColor: Colors.violetSoft, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: Colors.textPrimary, fontSize: 12 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    minHeight: 60,
    color: Colors.textPrimary,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  scopeButton: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  scopeButtonOn: { borderColor: Colors.accent, backgroundColor: withAlpha(Colors.accent, 0.12) },
  scopeButtonText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  tableTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  row: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 20,
    marginBottom: 6,
    gap: 2,
  },
  rowText: { color: Colors.textPrimary, fontSize: 12, lineHeight: 17 },
  rowKey: { color: Colors.textSecondary, fontWeight: '700' },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 10,
    marginHorizontal: 20,
    marginBottom: 6,
  },
  openButton: { paddingHorizontal: 8, paddingVertical: 4 },
});
