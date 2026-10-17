import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { confirmAsk } from '@/components/dev/confirmAsk';
import {
  AccessCode,
  AccessGrant,
  adminCreateCode,
  adminGrantAccess,
  adminListCodes,
  adminListGrants,
  adminRevokeGrant,
  adminSetCodeActive,
  DEFAULT_PLAN_FEATURES,
  FeatureValue,
  GATED_FEATURES,
  loadPlanFeatures,
  localText,
  PlanFeatureRow,
  randomCode,
  savePlanFeatures,
  Tier,
  TIERS,
  tierName,
} from '@/data/access';
import { dateLocale, t } from '@/i18n';
import { TAB, tabHref } from '@/constants/tabs';

// Panel del admin de Kuova (Más → Suscripciones (admin)):
// 1) qué incluye cada nivel: las filas de "Comparar suscripciones"; las marcadas con candado
//    además las aplica la app (p. ej. escanear informes);
// 2) códigos de invitación (amigos, pruebas) y 3) accesos dados a un email.
// La base de datos comprueba en cada llamada que quien escribe es admin.

type Paid = Exclude<Tier, 'free'>;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const daysOrNull = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const AdminPlansScreen = () => {
  const [rows, setRows] = useDeepState<PlanFeatureRow[]>([]);
  const [available, setAvailable] = useState(true);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [codes, setCodes] = useDeepState<AccessCode[]>([]);
  const [grants, setGrants] = useDeepState<AccessGrant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Formularios
  const [newCode, setNewCode] = useState(randomCode());
  const [codeTier, setCodeTier] = useState<Paid>('membership');
  const [codeDays, setCodeDays] = useState('365');
  const [codeUses, setCodeUses] = useState('');
  const [codeNote, setCodeNote] = useState('');
  const [grantEmail, setGrantEmail] = useState('');
  const [grantTier, setGrantTier] = useState<Paid>('membership');
  const [grantDays, setGrantDays] = useState('');
  const [grantNote, setGrantNote] = useState('');

  const load = useCallback(async () => {
    const f = await loadPlanFeatures();
    setRows(f.rows);
    setAvailable(f.available);
    setSaved(f.saved);
    setDirty(false);
    if (!f.available) return;
    const [c, g] = await Promise.all([adminListCodes().catch(() => []), adminListGrants().catch(() => [])]);
    setCodes(c);
    setGrants(g);
  }, [setRows, setCodes, setGrants]);

  useReloadOnFocus(load);

  const run = async (id: string, fn: () => Promise<void>, ok?: string) => {
    setBusy(id);
    setError('');
    setMessage('');
    try {
      await fn();
      if (ok) setMessage(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const edit = (i: number, patch: Partial<PlanFeatureRow>) => {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const setValue = (i: number, tier: Tier, v: FeatureValue) => edit(i, { values: { ...rows[i].values, [tier]: v } });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
    setDirty(true);
  };
  const removeRow = (i: number) => {
    setRows(rows.filter((_, j) => j !== i));
    setDirty(true);
  };
  const addRow = () => {
    setRows([...rows, { id: `row_${Date.now().toString(36)}`, label: { es: '', en: '' }, values: { free: false, membership: true, premium: true } }]);
    setDirty(true);
  };

  if (!available) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <KeyboardAwareScrollView contentContainerStyle={styles.content}>
          <ScreenHeader title={t('Subscriptions (admin)')} showBack backFallback={tabHref(TAB.more)} />
          <Text style={styles.warning}>
            {t('This needs the database update of 17 October (plan_access). Until it is applied, the app does not lock anything.')}
          </Text>
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('Subscriptions (admin)')} showBack backFallback={tabHref(TAB.more)} />

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* 1) Qué incluye cada nivel */}
        <Text style={styles.sectionTitle}>{t('What each level includes')}</Text>
        <Text style={styles.help}>
          {t('These rows are what people see in "Compare subscriptions". Rows with a lock are also enforced by the app.')}
          {!saved ? ` ${t('Showing the default rows: nothing saved yet.')}` : ''}
        </Text>

        {rows.map((r, i) => {
          const gate = GATED_FEATURES[r.id];
          return (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowHead}>
                {gate ? (
                  <View style={styles.gatePill}>
                    <Ionicons name="lock-closed" size={11} color={Colors.gold} />
                    <Text style={styles.gateText}>{localText(gate)}</Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <TouchableOpacity onPress={() => move(i, -1)} hitSlop={6} disabled={i === 0}>
                  <Ionicons name="arrow-up" size={18} color={i === 0 ? Colors.textMuted : Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, 1)} hitSlop={6} disabled={i === rows.length - 1}>
                  <Ionicons name="arrow-down" size={18} color={i === rows.length - 1 ? Colors.textMuted : Colors.textSecondary} />
                </TouchableOpacity>
                {!gate && (
                  <TouchableOpacity onPress={() => removeRow(i)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={18} color={Colors.attention} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={styles.input}
                value={r.label.es}
                onChangeText={(es) => edit(i, { label: { ...r.label, es } })}
                placeholder={t('Text in Spanish')}
                placeholderTextColor={Colors.textMuted}
              />
              <TextInput
                style={[styles.input, styles.inputSmall]}
                value={r.label.en}
                onChangeText={(en) => edit(i, { label: { ...r.label, en } })}
                placeholder={t('Text in English')}
                placeholderTextColor={Colors.textMuted}
              />
              {TIERS.map((tier) => {
                const v = r.values[tier];
                const kind = v === true ? 'yes' : v === false || !v ? 'no' : 'text';
                return (
                  <View key={tier} style={styles.tierBlock}>
                    <View style={styles.tierRow}>
                      <Text style={styles.tierName}>{tierName(tier)}</Text>
                      <View style={styles.segment}>
                        {(gate ? (['yes', 'no'] as const) : (['yes', 'no', 'text'] as const)).map((k) => (
                          <TouchableOpacity
                            key={k}
                            style={[styles.segItem, kind === k && styles.segItemOn]}
                            onPress={() => setValue(i, tier, k === 'yes' ? true : k === 'no' ? false : { es: '', en: '' })}
                          >
                            <Text style={[styles.segText, kind === k && styles.segTextOn]}>
                              {k === 'yes' ? t('Included') : k === 'no' ? t('Not included') : t('Text')}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    {typeof v === 'object' && (
                      <View style={styles.textValues}>
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={v.es}
                          onChangeText={(es) => setValue(i, tier, { ...v, es })}
                          placeholder={t('e.g. 2 a year (Spanish)')}
                          placeholderTextColor={Colors.textMuted}
                        />
                        <TextInput
                          style={[styles.input, styles.inputSmall]}
                          value={v.en}
                          onChangeText={(en) => setValue(i, tier, { ...v, en })}
                          placeholder={t('e.g. 2 a year (English)')}
                          placeholderTextColor={Colors.textMuted}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}

        <TouchableOpacity style={styles.ghostBtn} onPress={addRow}>
          <Ionicons name="add" size={18} color={Colors.accent} />
          <Text style={styles.ghostText}>{t('Add a row')}</Text>
        </TouchableOpacity>
        <View style={styles.btnRow}>
          <TouchableOpacity
            style={[styles.btn, styles.grow, (!dirty || busy !== null) && styles.btnOff]}
            disabled={!dirty || busy !== null}
            onPress={() =>
              run('save', async () => {
                const clean = rows.filter((r) => r.label.es.trim() || r.label.en.trim());
                await savePlanFeatures(clean);
                await load();
              }, t('Saved. People see it the next time they open the screen.'))
            }
          >
            {busy === 'save' ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>{t('Save changes')}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnGhost, styles.grow]}
            onPress={() => {
              setRows(DEFAULT_PLAN_FEATURES);
              setDirty(true);
            }}
          >
            <Text style={styles.ghostText}>{t('Back to defaults')}</Text>
          </TouchableOpacity>
        </View>

        {/* 2) Códigos de invitación */}
        <Text style={styles.sectionTitle}>{t('Invitation codes')}</Text>
        <Text style={styles.help}>{t('Give a code to friends or testers. Whoever types it in "Have an invitation code?" gets that level for the days you set.')}</Text>
        <View style={styles.card}>
          <View style={styles.fieldRow}>
            <TextInput
              style={[styles.input, { flex: 1, fontWeight: '800', letterSpacing: 1 }]}
              value={newCode}
              onChangeText={(v) => setNewCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setNewCode(randomCode())} hitSlop={8}>
              <Ionicons name="refresh" size={20} color={Colors.accent} />
            </TouchableOpacity>
          </View>
          <TierPicker value={codeTier} onChange={setCodeTier} />
          <View style={styles.fieldRow}>
            <Field label={t('Days of access')} value={codeDays} onChange={setCodeDays} placeholder={t('no end')} numeric />
            <Field label={t('Max. uses')} value={codeUses} onChange={setCodeUses} placeholder={t('no limit')} numeric />
          </View>
          <TextInput
            style={[styles.input, styles.inputSmall]}
            value={codeNote}
            onChangeText={setCodeNote}
            placeholder={t('Note (only you see it), e.g. Friends')}
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={[styles.btn, (newCode.length < 4 || busy !== null) && styles.btnOff]}
            disabled={newCode.length < 4 || busy !== null}
            onPress={() =>
              run('code', async () => {
                await adminCreateCode({ code: newCode, tier: codeTier, days: daysOrNull(codeDays), maxUses: daysOrNull(codeUses), note: codeNote });
                setNewCode(randomCode());
                setCodeNote('');
                setCodes(await adminListCodes());
              }, t('Code created.'))
            }
          >
            {busy === 'code' ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>{t('Create code')}</Text>}
          </TouchableOpacity>
        </View>

        {codes.map((c) => (
          <View key={c.code} style={[styles.listItem, !c.active && { opacity: 0.55 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{c.code}</Text>
              <Text style={styles.itemSub}>
                {[
                  tierName(c.tier),
                  c.days ? t('{n} days', { n: c.days }) : t('no end'),
                  c.maxUses ? t('{used}/{max} used', { used: c.uses, max: c.maxUses }) : t('{used} used', { used: c.uses }),
                  c.note,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => run(`c-${c.code}`, async () => {
              await adminSetCodeActive(c.code, !c.active);
              setCodes(await adminListCodes());
            })}>
              <Text style={styles.itemAction}>{c.active ? t('Turn off') : t('Turn on')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* 3) Accesos dados */}
        <Text style={styles.sectionTitle}>{t('People with access')}</Text>
        <Text style={styles.help}>{t('Everyone who has access without paying (by code or given by you). You can also give access to an email that already has an account.')}</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={grantEmail}
            onChangeText={setGrantEmail}
            placeholder={t('Email of the account')}
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TierPicker value={grantTier} onChange={setGrantTier} />
          <View style={styles.fieldRow}>
            <Field label={t('Days of access')} value={grantDays} onChange={setGrantDays} placeholder={t('no end')} numeric />
            <Field label={t('Note')} value={grantNote} onChange={setGrantNote} placeholder={t('optional')} />
          </View>
          <TouchableOpacity
            style={[styles.btn, (!grantEmail.includes('@') || busy !== null) && styles.btnOff]}
            disabled={!grantEmail.includes('@') || busy !== null}
            onPress={() =>
              run('grant', async () => {
                await adminGrantAccess(grantEmail.trim(), grantTier, daysOrNull(grantDays), grantNote);
                setGrantEmail('');
                setGrantNote('');
                setGrants(await adminListGrants());
              }, t('Access given.'))
            }
          >
            {busy === 'grant' ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.btnText}>{t('Give access')}</Text>}
          </TouchableOpacity>
        </View>

        {grants.length === 0 && <Text style={styles.help}>{t('Nobody yet.')}</Text>}
        {grants.map((g) => {
          const expired = !!g.expiresAt && new Date(g.expiresAt).getTime() < Date.now();
          return (
            <View key={g.id} style={[styles.listItem, expired && { opacity: 0.55 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {g.email}
                </Text>
                <Text style={styles.itemSub}>
                  {[
                    tierName(g.tier),
                    g.source.startsWith('code:') ? t('code {code}', { code: g.source.slice(5) }) : t('given by you'),
                    g.expiresAt ? (expired ? t('ended {date}', { date: shortDate(g.expiresAt) }) : t('until {date}', { date: shortDate(g.expiresAt) })) : t('no end'),
                    g.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  if (!(await confirmAsk(t('Remove access?'), g.email, t('Remove')))) return;
                  run(`g-${g.id}`, async () => {
                    await adminRevokeGrant(g.id);
                    setGrants(await adminListGrants());
                  });
                }}
              >
                <Text style={[styles.itemAction, { color: Colors.attention }]}>{t('Remove')}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const TierPicker = ({ value, onChange }: { value: Paid; onChange: (v: Paid) => void }) => (
  <View style={styles.segment}>
    {(['membership', 'premium'] as const).map((tier) => (
      <TouchableOpacity key={tier} style={[styles.segItem, styles.grow, value === tier && styles.segItemOn]} onPress={() => onChange(tier)}>
        <Text style={[styles.segText, value === tier && styles.segTextOn]}>{tierName(tier)}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const Field = ({ label, value, onChange, placeholder, numeric }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean }) => (
  <View style={styles.grow}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={[styles.input, styles.inputSmall]}
      value={value}
      onChangeText={(v) => onChange(numeric ? v.replace(/[^0-9]/g, '') : v)}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={numeric ? 'number-pad' : 'default'}
    />
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 48, paddingHorizontal: 20, gap: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 18 },
  help: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  warning: { color: Colors.warning, fontSize: 14, lineHeight: 20 },
  message: { color: Colors.ok, fontSize: 14, fontWeight: '600' },
  error: { color: Colors.attention, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, gap: 10 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gatePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
  },
  gateText: { color: Colors.gold, fontSize: 12, fontWeight: '800' },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: 15,
    backgroundColor: Colors.background,
  },
  inputSmall: { fontSize: 13, paddingVertical: 8 },
  tierBlock: { gap: 6 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tierName: { width: 72, color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  segment: { flex: 1, flexDirection: 'row', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, overflow: 'hidden' },
  segItem: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: withAlpha(Colors.accent, 0.16) },
  segText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  segTextOn: { color: Colors.accent },
  textValues: { gap: 6, marginLeft: 82 },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  ghostText: { color: Colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  btnRow: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  btn: { backgroundColor: Colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  btnGhost: { borderWidth: 1, borderColor: Colors.accent, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  btnOff: { opacity: 0.45 },
  btnText: { color: Colors.background, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 4 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 12,
    padding: 12,
  },
  itemTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  itemSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  itemAction: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
});
