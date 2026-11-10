// Tu historial (Mis datos) y tu tarjeta de emergencia (Más). Lógica en logic/historial.ts; se guarda
// en user_flags 'historial.v1' (data/historialRepository), una sola fuente para las dos cosas.
import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, Switch, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { TAB, tabHref } from '@/constants/tabs';
import { WheelPicker } from '@/components/WheelPicker';
import { Chip, HistFrame, hs, MainButton, Segment } from '@/components/historial/HistorialParts';
import { BigQr, cardLayout, CardVariant, EmergencyCard, LockBgPreview } from '@/components/historial/EmergencyCard';
import { useHistorial } from '@/hooks/useHistorial';
import { shareBadge } from '@/utils/shareBadge';
import { canSetLockScreen, setLockScreen } from '@/utils/lockWallpaper';
import { pickWallpaperPhoto } from '@/utils/wallpaperPhoto';
import { loadCardPhoto, saveCardPhoto } from '@/data/cardPhoto';
import { t } from '@/i18n';
import {
  Allergy,
  ALLERGY_CATALOG,
  ALLERGY_GROUP_NAME,
  ALLERGY_GROUPS,
  AllergyGroup,
  allergyLabel,
  BLOOD_GROUPS,
  bloodGroupLabel,
  CardData,
  catalogAllergy,
  LOCK_BG_NAME,
  LOCK_PATTERNS,
  lockBackground,
  lockQr,
  LockBg,
  CardField,
  doseDate,
  drugAllergies,
  emergencyMissing,
  EVENT_CAT_NAME,
  EVENT_CATS,
  EVENT_PLACEHOLDER,
  EventCat,
  FIRST_YEAR,
  hasAllergy,
  Historial,
  HistoryEvent,
  monthName,
  MONTHS,
  newId,
  NOTICE_CATALOG,
  noticeLabel,
  NOTICES_MAX,
  otherAllergies,
  toggleAllergy,
  toggleNotice,
  VACCINE_CATALOG,
  vaccineGroups,
  vaccineLabel,
} from '@/logic/historial';

const thisYear = () => new Date().getFullYear();
const yearItems = () => [t('No date'), ...Array.from({ length: thisYear() - FIRST_YEAR + 1 }, (_, i) => String(thisYear() - i))];
const yearIndex = (y: number | null) => (y == null ? 0 : thisYear() - y + 1);
const yearOf = (i: number) => (i === 0 ? null : thisYear() - i + 1);
const goBack = (router: ReturnType<typeof useRouter>, fallback: string) => (router.canGoBack() ? router.back() : router.replace(fallback as any));
const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ${t('and')} ${xs[xs.length - 1]}`);

// ===== Alergias =====
export function AllergiesScreen() {
  const router = useRouter();
  const { h } = useHistorial();
  return (
    // Solo el botón de abajo, «Editar alergias» (fundador, 2026-11-05: arriba sobraba otro «Editar»)
    <HistFrame title={t('Allergies')}>
      {h && (
        <>
          <Text style={hs.sub}>{t('The allergies you know you have. Drug allergies also go on your emergency card.')}</Text>
          {h.allergies.length ? (
            ALLERGY_GROUPS.map((g) => {
              const list = h.allergies.filter((a) => a.group === g);
              if (!list.length) return null;
              return (
                <View key={g}>
                  <Text style={hs.label}>{t(ALLERGY_GROUP_NAME[g])}</Text>
                  <View style={hs.card}>
                    {list.map((a, i) => (
                      <View key={a.name} style={[hs.row, i > 0 && hs.rowDivider]}>
                        <Text style={hs.rowTitle}>{allergyLabel(a)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={hs.card}>
              <Text style={hs.empty}>{t('You have no allergies added.')}</Text>
            </View>
          )}
          <MainButton soft label={h.allergies.length ? t('Edit allergies') : t('Add allergies')} onPress={() => router.push('/historial-alergias-editar' as any)} />
        </>
      )}
    </HistFrame>
  );
}

export function AllergiesEditScreen() {
  const router = useRouter();
  const { h, update } = useHistorial();
  const [draft, setDraft] = useState<Historial | null>(null);
  const [other, setOther] = useState('');
  const [otherGroup, setOtherGroup] = useState<AllergyGroup>('drugs');
  const [added, setAdded] = useState<Allergy | null>(null);
  useEffect(() => {
    if (h && !draft) setDraft(h);
  }, [h, draft]);
  if (!draft) return <HistFrame title={t('Edit allergies')} />;
  const has = (name: string) => draft.allergies.some((a) => a.name.toLowerCase() === name.toLowerCase());
  // Lo escrito que ya está en la lista (p. ej. «Metamizol») marca el de la lista, en su grupo
  const withOther = (base: Historial) => {
    const name = other.trim();
    return name && !hasAllergy(base, name) ? toggleAllergy(base, name, otherGroup) : base;
  };
  const addOther = () => {
    const name = other.trim();
    if (!name) return;
    const next = withOther(draft);
    const hit = catalogAllergy(name);
    setAdded(next.allergies.find((a) => a.name === (hit ? hit.name : name)) ?? null);
    setDraft(next);
    setOther('');
  };
  const save = () => {
    Keyboard.dismiss(); // volver con el teclado abierto hacía que la transición diera un salto
    // Solo las alergias: lo demás del historial puede haber cambiado en otra pantalla. Lo escrito y sin
    // añadir también cuenta.
    update({ ...(h ?? draft), allergies: withOther(draft).allergies });
    goBack(router, '/historial-alergias');
  };
  return (
    <HistFrame title={t('Edit allergies')}>
      <Text style={hs.sub}>{t('Tap the ones you have; tap again to remove it.')}</Text>
      {ALLERGY_GROUPS.map((g) => {
        const custom = draft.allergies.filter((a) => a.group === g && a.custom);
        return (
          <View key={g}>
            <Text style={hs.label}>{t(ALLERGY_GROUP_NAME[g])}</Text>
            <View style={hs.chips}>
              {ALLERGY_CATALOG[g].map((name) => (
                <Chip key={name} label={t(name)} on={has(name)} onPress={() => setDraft(toggleAllergy(draft, name, g))} />
              ))}
              {custom.map((a: Allergy) => (
                <Chip key={a.name} label={a.name} on onPress={() => setDraft(toggleAllergy(draft, a.name, g))} />
              ))}
            </View>
          </View>
        );
      })}
      <Text style={hs.label}>{t('Another one')}</Text>
      <Segment
        options={ALLERGY_GROUPS.map((g) => [g, t(ALLERGY_GROUP_NAME[g])] as [AllergyGroup, string])}
        value={otherGroup}
        onChange={setOtherGroup}
      />
      <View style={[hs.inputRow, { marginTop: 8 }]}>
        <TextInput
          style={[hs.input, { flex: 1 }]}
          value={other}
          onChangeText={(v) => {
            setOther(v);
            setAdded(null);
          }}
          maxLength={40}
          placeholder={t('Write which one')}
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={addOther}
          accessibilityLabel={t('Another allergy')}
        />
        <TouchableOpacity onPress={addOther} disabled={!other.trim()} hitSlop={8}>
          <Text style={[hs.link, !other.trim() && { opacity: 0.4 }]}>{t('Add')}</Text>
        </TouchableOpacity>
      </View>
      {added && (
        <Text style={[hs.meta, { marginTop: 6 }]}>
          {t('Marked: {name}, in {group}.', { name: allergyLabel(added), group: t(ALLERGY_GROUP_NAME[added.group]).toLowerCase() })}
        </Text>
      )}
      <MainButton label={t('Save')} onPress={save} />
    </HistFrame>
  );
}

// ===== Grupo sanguíneo =====
export function BloodGroupScreen() {
  const router = useRouter();
  const { h, update } = useHistorial();
  const [idx, setIdx] = useState<number | null>(null);
  useEffect(() => {
    if (h && idx == null) setIdx(h.bloodGroup ? BLOOD_GROUPS.indexOf(h.bloodGroup) + 1 : 0);
  }, [h, idx]);
  if (!h || idx == null) return <HistFrame title={t('Blood group')} />;
  const items = [t('I don’t know'), ...BLOOD_GROUPS.map(bloodGroupLabel)];
  return (
    <HistFrame title={t('Blood group')}>
      <Text style={hs.sub}>{t('It appears on a blood donation card or in some old blood test. If you do not know it, leave it like this.')}</Text>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <WheelPicker items={items} selectedIndex={idx} onChange={setIdx} width={160} itemHeight={44} />
      </View>
      <MainButton
        label={t('Save')}
        onPress={() => {
          update({ ...h, bloodGroup: idx === 0 ? null : BLOOD_GROUPS[idx - 1] });
          goBack(router, tabHref(TAB.myData));
        }}
      />
    </HistFrame>
  );
}

// ===== Vacunas: cada dosis, su línea; mes y año en dos ruedas, los dos opcionales =====
export function VaccinesScreen() {
  const { h, update } = useHistorial();
  const [pick, setPick] = useState<string | null>(null);
  const [other, setOther] = useState('');
  if (!h) return <HistFrame title={t('Vaccines')} />;
  const groups = vaccineGroups(h.vaccines);
  const setDose = (id: string, patch: { month?: number | null; year?: number | null }) =>
    update({ ...h, vaccines: h.vaccines.map((v) => (v.id === id ? { ...v, ...patch } : v)) });
  const addDose = (name: string, custom?: boolean) => {
    const id = newId('v', h.vaccines.map((v) => v.id));
    update({ ...h, vaccines: [...h.vaccines, { id, name, ...(custom ? { custom: true } : {}), month: null, year: null }] });
    setPick(id);
  };
  const addOther = () => {
    const name = other.trim();
    if (!name) return;
    addDose(name, !VACCINE_CATALOG.includes(name));
    setOther('');
  };
  return (
    <HistFrame title={t('Vaccines')}>
      <Text style={hs.sub}>{t('Month and year if you know them: for travel vaccines, like yellow fever, the month matters. If you had several doses, add each one.')}</Text>
      {groups.length ? (
        <View style={hs.card}>
          {groups.map((g, gi) => (
            <View key={g.name} style={[{ paddingVertical: 8 }, gi > 0 && hs.rowDivider]}>
              <View style={hs.row}>
                <Text style={hs.rowTitle}>{vaccineLabel(g)}</Text>
                <TouchableOpacity onPress={() => addDose(g.name, g.custom)} hitSlop={8}>
                  <Text style={hs.link}>{t('+ Another dose')}</Text>
                </TouchableOpacity>
              </View>
              {g.doses.map((v, i) => (
                <View key={v.id}>
                  <View style={[hs.row, { paddingVertical: 6 }]}>
                    <Text style={[hs.rowMeta, { flex: 1 }]}>{g.doses.length > 1 ? t('Dose {n}', { n: i + 1 }) : t('Date')}</Text>
                    <TouchableOpacity style={[hs.dateBtn, pick === v.id && hs.dateBtnOn]} onPress={() => setPick(pick === v.id ? null : v.id)}>
                      <Text style={hs.dateText}>{doseDate(v, true)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => update({ ...h, vaccines: h.vaccines.filter((x) => x.id !== v.id) })}
                      hitSlop={8}
                      accessibilityLabel={t('Remove this dose')}
                    >
                      <Ionicons name="close" size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {pick === v.id && (
                    <View style={hs.pick}>
                      <View style={hs.pickHead}>
                        <Text style={hs.pickTitle}>{t('Month and year')}</Text>
                        <TouchableOpacity onPress={() => setPick(null)} hitSlop={8}>
                          <Text style={hs.link}>{t('Ready')}</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={hs.wheels}>
                        <WheelPicker
                          key={`m-${v.id}`}
                          items={[t('No month'), ...MONTHS.map((_, i) => monthName(i))]}
                          selectedIndex={v.month ?? 0}
                          // Un mes sin año: este año
                          onChange={(m) => setDose(v.id, { month: m === 0 ? null : m, year: m && v.year == null ? thisYear() : v.year })}
                          width={130}
                          itemHeight={36}
                        />
                        <WheelPicker
                          key={`y-${v.id}`}
                          items={yearItems()}
                          selectedIndex={yearIndex(v.year)}
                          onChange={(y) => setDose(v.id, { year: yearOf(y), ...(y === 0 ? { month: null } : {}) })}
                          width={110}
                          itemHeight={36}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={hs.card}>
          <Text style={hs.empty}>{t('You have no vaccines added.')}</Text>
        </View>
      )}
      <Text style={hs.label}>{t('Add a vaccine')}</Text>
      <View style={hs.chips}>
        {VACCINE_CATALOG.map((name) => (
          <Chip key={name} label={t(name)} onPress={() => addDose(name)} />
        ))}
      </View>
      <View style={[hs.inputRow, { marginTop: 10 }]}>
        <TextInput
          style={[hs.input, { flex: 1 }]}
          value={other}
          onChangeText={setOther}
          maxLength={40}
          placeholder={t('Another vaccine')}
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={addOther}
          accessibilityLabel={t('Another vaccine')}
        />
        <TouchableOpacity onPress={addOther} disabled={!other.trim()} hitSlop={8}>
          <Text style={[hs.link, !other.trim() && { opacity: 0.4 }]}>{t('Add')}</Text>
        </TouchableOpacity>
      </View>
    </HistFrame>
  );
}

// ===== Historia clínica: lo que te ha pasado, por categorías (las cirugías son una) =====
export function HistoryListScreen() {
  const router = useRouter();
  const { kind, cat: rawCat } = useLocalSearchParams<{ kind?: string; cat?: string }>();
  const { h, update } = useHistorial();
  const [cat, setCat] = useState<EventCat>(EVENT_CATS.includes(rawCat as EventCat) ? (rawCat as EventCat) : kind === 'conditions' ? 'chronic' : 'surgery');
  const [pick, setPick] = useState<string | null>(null);
  const [name, setName] = useState('');
  if (!h) return <HistFrame title={t('Medical history')} />;
  const set = (next: HistoryEvent[]) => update({ ...h, events: next });
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const id = newId('h', h.events.map((x) => x.id));
    set([...h.events, { id, cat, name: n, year: null }]);
    setName('');
    setPick(id);
  };
  const groups = EVENT_CATS.map((c) => ({ c, list: h.events.filter((e) => e.cat === c) })).filter((g) => g.list.length);
  const row = (x: HistoryEvent, i: number) => (
    <View key={x.id} style={i > 0 ? hs.rowDivider : undefined}>
      <View style={hs.row}>
        <Text style={hs.rowTitle}>{x.name}</Text>
        <TouchableOpacity style={[hs.dateBtn, pick === x.id && hs.dateBtnOn]} onPress={() => setPick(pick === x.id ? null : x.id)}>
          <Text style={hs.dateText}>{x.year ?? t('No date')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => set(h.events.filter((y) => y.id !== x.id))} hitSlop={8} accessibilityLabel={t('Remove')}>
          <Ionicons name="close" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
      {pick === x.id && (
        <View style={hs.pick}>
          <View style={hs.pickHead}>
            <Text style={hs.pickTitle}>{t('Year')}</Text>
            <TouchableOpacity onPress={() => setPick(null)} hitSlop={8}>
              <Text style={hs.link}>{t('Ready')}</Text>
            </TouchableOpacity>
          </View>
          <View style={hs.wheels}>
            <WheelPicker
              key={`y-${x.id}`}
              items={yearItems()}
              selectedIndex={yearIndex(x.year)}
              onChange={(y) => set(h.events.map((z) => (z.id === x.id ? { ...z, year: yearOf(y) } : z)))}
              width={120}
              itemHeight={36}
            />
          </View>
        </View>
      )}
    </View>
  );
  return (
    <HistFrame title={t('Medical history')}>
      <Text style={hs.sub}>{t('What has happened to you: operations, hospital stays, illnesses… with the year if you know it.')}</Text>
      {groups.length ? (
        groups.map((g) => (
          <View key={g.c}>
            <Text style={hs.label}>{t(EVENT_CAT_NAME[g.c])}</Text>
            <View style={hs.card}>{g.list.map(row)}</View>
          </View>
        ))
      ) : (
        <View style={hs.card}>
          <Text style={hs.empty}>{t('You have nothing added.')}</Text>
        </View>
      )}

      <Text style={hs.label}>{t('Add to your history')}</Text>
      <View style={hs.chips}>
        {EVENT_CATS.map((c) => (
          <Chip key={c} label={t(EVENT_CAT_NAME[c])} on={cat === c} onPress={() => setCat(c)} />
        ))}
      </View>
      <View style={[hs.inputRow, { marginTop: 10 }]}>
        <TextInput
          style={[hs.input, { flex: 1 }]}
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder={t(EVENT_PLACEHOLDER[cat])}
          placeholderTextColor={Colors.textMuted}
          onSubmitEditing={add}
          accessibilityLabel={t('Name')}
        />
        <TouchableOpacity onPress={add} disabled={!name.trim()} hitSlop={8}>
          <Text style={[hs.link, !name.trim() && { opacity: 0.4 }]}>{t('Add')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={hs.label}>{t('Also in your history')}</Text>
      <View style={hs.card}>
        <TouchableOpacity style={hs.row} onPress={() => router.push('/medications')}>
          <Ionicons name="medical-outline" size={18} color={Colors.gold} />
          <Text style={hs.rowTitle}>{t('Your medication')}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[hs.row, hs.rowDivider]} onPress={() => router.push('/genetic-profile')}>
          <Ionicons name="people-outline" size={18} color={Colors.gold} />
          <Text style={hs.rowTitle}>{t('What runs in your family')}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity style={[hs.row, hs.rowDivider]} onPress={() => router.push('/files')}>
          <Ionicons name="folder-open-outline" size={18} color={Colors.gold} />
          <Text style={hs.rowTitle}>{t('Your files')}</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </HistFrame>
  );
}

// ===== Mi tarjeta de emergencia =====
// Tú eliges qué sale (nombre, grupo, alergias a medicamentos y contacto, recomendados; avisos, otras
// alergias y dirección, si quieres) y cómo la guardas: completa, compacta (nombre y QR) o de fondo de la
// pantalla de bloqueo. Grupo y alergias vienen del historial (se cambian allí). El QR lleva el texto de la
// tarjeta, que cualquier cámara lee sin conexión. Tocar el QR lo amplía.
const VARIANTS: [CardVariant, string][] = [
  ['full', 'Full version'],
  ['compact', 'Compact version'],
  ['lock', 'Lock screen version'], // no 'Lock screen': en es.ts es «Pantalla de bloqueo» (avisos) y no cabe
];
const VARIANT_NOTE: Record<CardVariant, string> = {
  full: 'Your details and the QR code: to carry on your phone or print.',
  compact: 'Just your name and the QR code: whoever scans it sees the rest.',
  lock: 'For your lock screen only, not the home screen: choose a photo if you like. The QR code goes in the lower third, clear of the clock, and leaves out your address, because anyone holding your phone could see it.',
};
const FILE_NAME: Record<CardVariant, string> = { full: 'kuova-tarjeta-emergencia', compact: 'kuova-tarjeta-emergencia-qr', lock: 'kuova-fondo-emergencia' };

// Bloqueo (fundador, 2026-11-06): la imagen va a la pantalla de bloqueo, no a la de inicio. Los pasos a mano
// de cada sistema; en la web, los dos. En Android con el módulo nativo hay además un botón que lo hace solo.
function LockSteps({ ios, android }: { ios: boolean; android: boolean }) {
  return (
    <View style={{ backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, gap: 8, marginTop: 12 }}>
      <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }}>{t('How to put it on your lock screen only')}</Text>
      {ios && (
        <Text style={[hs.meta, { marginTop: 0 }]}>
          {t('iPhone: tap «Save or share the image» and «Save Image». Open it in Photos, tap Share and «Use as Wallpaper», then «Add». When it asks, choose «Customise Home Screen» and pick another photo or a colour: the card stays on the lock screen only.')}
        </Text>
      )}
      {android && (
        <Text style={[hs.meta, { marginTop: 0 }]}>
          {t('Android: tap «Save or share the image» and save it. Open it in Gallery or Google Photos, tap ⋮ and «Set as wallpaper» (or «Use as» and «Wallpaper») and choose «Lock screen».')}
        </Text>
      )}
    </View>
  );
}

function FieldBlock({ title, recommended, on, onToggle, children }: { title: string; recommended?: boolean; on: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode }) {
  return (
    <View style={[hs.card, { marginTop: 10 }]}>
      <View style={hs.row}>
        <Text style={hs.rowTitle}>{title}</Text>
        {recommended && <Text style={hs.tag}>{t('Recommended field')}</Text>}
        <Switch
          value={on}
          onValueChange={onToggle}
          trackColor={{ true: Colors.accent, false: Colors.divider }}
          thumbColor="#FFFFFF"
          accessibilityLabel={t('Show “{field}” on the card', { field: title })}
        />
      </View>
      {children ? <View style={[{ paddingBottom: 12, gap: 8 }, !on && { opacity: 0.45 }]}>{children}</View> : null}
    </View>
  );
}

export function EmergencyCardScreen() {
  const router = useRouter();
  const { h, update } = useHistorial();
  const { width } = useWindowDimensions();
  const [draft, setDraft] = useState<CardData | null>(null);
  const [variant, setVariant] = useState<CardVariant>('full');
  const [big, setBig] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [other, setOther] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [lock, setLock] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const cardRef = useRef<any>(null);
  useEffect(() => {
    if (h && !draft) setDraft(h.card);
  }, [h, draft]);
  useEffect(() => {
    loadCardPhoto().then(setPhoto);
  }, []);
  const choosePhoto = async () => {
    setPicking(true);
    try {
      const uri = await pickWallpaperPhoto();
      if (uri) {
        setPhoto(uri);
        saveCardPhoto(uri);
      }
    } catch (e) {
      console.warn('Card photo not picked', e);
    } finally {
      setPicking(false);
    }
  };
  const removePhoto = () => {
    setPhoto(null);
    saveCardPhoto(null);
  };
  // Lo escrito se guarda al salir de cada campo y, si queda algo, al salir de la pantalla
  const latest = useRef<{ h: Historial | null; draft: CardData | null }>({ h: null, draft: null });
  latest.current = { h, draft };
  useEffect(
    () => () => {
      const { h: lh, draft: ld } = latest.current;
      if (lh && ld && JSON.stringify(ld) !== JSON.stringify(lh.card)) update({ ...lh, card: ld });
    },
    [update],
  );
  if (!h || !draft) return <HistFrame title={t('My emergency card')} backFallback={tabHref(TAB.more)} />;
  const view: Historial = { ...h, card: draft };
  const save = (next: CardData = draft) => {
    if (JSON.stringify(next) !== JSON.stringify(h.card)) update({ ...h, card: next });
  };
  // Interruptores y avisos: se ven y se guardan al momento
  const change = (next: CardData) => {
    setDraft(next);
    save(next);
  };
  const toggle = (f: CardField) => (v: boolean) => change({ ...draft, show: { ...draft.show, [f]: v } });
  // Fondo de Bloqueo: sin foto, vuelve al verde
  const removeLockPhoto = () => {
    removePhoto();
    if (draft.lockBg === 'photo') change({ ...draft, lockBg: 'green' });
  };
  // «Tu foto»: si aún no hay, se elige; si ya hay, se usa
  const pickBg = async (b: LockBg) => {
    if (b !== 'photo' || photo) return change({ ...draft, lockBg: b });
    setPicking(true);
    try {
      const uri = await pickWallpaperPhoto();
      if (uri) {
        setPhoto(uri);
        saveCardPhoto(uri);
        change({ ...draft, lockBg: 'photo' });
      }
    } catch (e) {
      console.warn('Card photo not picked', e);
    } finally {
      setPicking(false);
    }
  };
  const missing = emergencyMissing(view);
  const L = cardLayout(view, variant);
  const lockCut = variant === 'lock' ? lockQr(view).cut : [];
  const bg = lockBackground(draft, !!photo);
  const previewW = variant === 'lock' ? Math.min(width - 40, 250) : Math.min(width - 40, 440);
  const scale = previewW / L.w;
  const domId = 'kuova-emergency-card';
  const drugs = drugAllergies(h).map(allergyLabel);
  const others = otherAllergies(h).map(allergyLabel);
  const custom = draft.notices.filter((n) => n.custom);
  const addOther = () => {
    if (!other.trim()) return;
    change(toggleNotice(draft, other));
    setOther('');
  };

  const share = async () => {
    save();
    setSharing(true);
    try {
      await shareBadge({
        svg: cardRef.current,
        domId,
        fileName: FILE_NAME[variant],
        message: t('My emergency card, made with Kuova Health. kuovahealth.com'),
        size: { width: L.w, height: L.h },
      });
    } finally {
      setSharing(false);
    }
  };
  // Android con el módulo (APK desde el 2026-11-06): la pone de fondo de bloqueo sin tocar el de inicio
  const direct = variant === 'lock' && canSetLockScreen();
  const putOnLockScreen = async () => {
    save();
    setLock('busy');
    try {
      await setLockScreen({ svg: cardRef.current, fileName: FILE_NAME.lock, size: { width: L.w, height: L.h } });
      setLock('done');
    } catch (e) {
      console.warn('Lock screen wallpaper not set', e);
      setLock('failed');
    }
  };
  const input = (key: 'fullName' | 'phone' | 'contact' | 'address', placeholder: string, label: string) => (
    <TextInput
      style={hs.input}
      value={draft[key]}
      onChangeText={(v) => setDraft({ ...draft, [key]: v })}
      onBlur={() => save()}
      maxLength={key === 'phone' ? 30 : key === 'address' ? 120 : 80}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={key === 'phone' ? 'phone-pad' : 'default'}
      autoComplete={key === 'fullName' ? 'name' : key === 'phone' ? 'tel' : key === 'address' ? 'street-address' : 'off'}
      accessibilityLabel={label}
    />
  );
  const fromHistory = (value: string, to: string) => (
    <TouchableOpacity style={[hs.row, hs.rowDivider]} onPress={() => router.push(to as any)}>
      <Text style={[hs.rowMeta, { flex: 1 }]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={hs.link}>{t('Change')}</Text>
    </TouchableOpacity>
  );

  return (
    <HistFrame title={t('My emergency card')} backFallback={tabHref(TAB.more)}>
      <Text style={hs.sub}>{t('What whoever helps you should know, with a QR code that holds the same details and can be read without internet.')}</Text>
      <Segment options={VARIANTS.map(([v, l]) => [v, t(l)] as [CardVariant, string])} value={variant} onChange={setVariant} />
      <Text style={[hs.meta, { marginTop: 8, marginBottom: 12 }]}>{t(VARIANT_NOTE[variant])}</Text>
      <View nativeID={domId} style={{ alignSelf: 'center', borderRadius: variant === 'lock' ? 22 : 18, overflow: 'hidden' }}>
        <EmergencyCard ref={cardRef} h={view} width={previewW} variant={variant} photo={photo} bg={bg} />
        <TouchableOpacity
          style={{ position: 'absolute', left: L.qr.x * scale, top: L.qr.y * scale, width: L.qr.size * scale, height: L.qr.size * scale }}
          onPress={() => setBig(true)}
          accessibilityRole="button"
          accessibilityLabel={t('Make the QR code bigger')}
        />
      </View>
      <Text style={[hs.meta, { textAlign: 'center', marginTop: 8 }]}>{t('Tap the QR code to make it bigger.')}</Text>
      {/* Lo que no cabe en el QR de la pantalla de bloqueo, que es más pequeño (2026-11-09) */}
      {variant === 'lock' && lockCut.length > 0 && (
        <Text style={[hs.meta, { textAlign: 'center', color: Colors.textPrimary }]}>
          {t('Not everything fits in the lock screen QR code, so it leaves out: {list}. Keep on the card what matters most to whoever helps you.', { list: lockCut.join(', ') })}
        </Text>
      )}
      {/* Fondo (fundador, 2026-11-06): los de la marca y tu foto, a la vista */}
      {variant === 'lock' && (
        <>
          <Text style={[hs.label, { marginTop: 14 }]}>{t('Background')}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            {[...LOCK_PATTERNS, 'photo' as const].map((b) => {
              const on = bg === b;
              return (
                <TouchableOpacity
                  key={b}
                  onPress={() => pickBg(b)}
                  disabled={picking}
                  style={{ alignItems: 'center', gap: 5 }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t(LOCK_BG_NAME[b])}
                >
                  <View style={{ borderRadius: 12, borderWidth: 2, borderColor: on ? Colors.accent : 'transparent', padding: 2 }}>
                    <View style={{ width: 50, height: 108, borderRadius: 9, overflow: 'hidden', backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' }}>
                      {b === 'photo' && !photo ? <Ionicons name="image-outline" size={22} color={Colors.textSecondary} /> : <LockBgPreview bg={b} photo={photo} width={50} />}
                    </View>
                  </View>
                  <Text style={{ color: on ? Colors.textPrimary : Colors.textSecondary, fontSize: 12, fontWeight: on ? '700' : '500' }}>{t(LOCK_BG_NAME[b])}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {bg === 'photo' && photo && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 10 }}>
              <TouchableOpacity onPress={choosePhoto} disabled={picking} hitSlop={8} accessibilityRole="button">
                <Text style={[hs.link, picking && { opacity: 0.4 }]}>{t('Change photo')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={removeLockPhoto} hitSlop={8} accessibilityRole="button">
                <Text style={[hs.link, { color: Colors.textSecondary }]}>{t('Remove photo')}</Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={[hs.meta, { textAlign: 'center' }]}>{t('The photo stays on this phone: it is not uploaded anywhere.')}</Text>
        </>
      )}
      {direct && (
        <MainButton label={lock === 'busy' ? t('Preparing…') : t('Put it on my lock screen')} onPress={putOnLockScreen} disabled={lock === 'busy'} />
      )}
      <MainButton label={sharing ? t('Preparing…') : t('Save or share the image')} onPress={share} disabled={sharing} soft={direct} />
      {direct && lock === 'done' && (
        <Text style={[hs.meta, { textAlign: 'center', color: Colors.ok }]}>{t('Done: the card is on your lock screen. Your home screen stays as it was.')}</Text>
      )}
      {direct && lock === 'failed' && (
        <Text style={[hs.meta, { textAlign: 'center' }]}>{t('Your phone did not let Kuova change the lock screen. Save the image and follow these steps.')}</Text>
      )}
      {variant === 'lock' && (!direct || lock === 'failed') && <LockSteps ios={Platform.OS !== 'android'} android={Platform.OS !== 'ios'} />}
      {variant === 'lock' && (
        <Text style={hs.meta}>
          {t('On an iPhone you can also fill in the Medical ID in the Health app, and on Android the medical information in Settings (Safety and emergency): both can be seen without unlocking the phone.')}
        </Text>
      )}
      <Text style={hs.meta}>{t('Anyone who scans the code or sees the image can read these details. Share it only with whoever you want.')}</Text>

      <Text style={hs.label}>{t('What your card shows')}</Text>
      <Text style={[hs.meta, { marginTop: 0 }]}>{t('Recommended: your name, blood group, drug allergies and an emergency contact. Add anything else you want.')}</Text>
      <FieldBlock title={t('Name and surname')} recommended on={draft.show.name} onToggle={toggle('name')}>
        {input('fullName', t('As it appears on your ID'), t('Name and surname'))}
      </FieldBlock>
      <FieldBlock title={t('Blood group')} recommended on={draft.show.blood} onToggle={toggle('blood')}>
        {fromHistory(h.bloodGroup ? bloodGroupLabel(h.bloodGroup) : t('Not added'), '/historial-grupo')}
      </FieldBlock>
      <FieldBlock title={t('Drug allergies')} recommended on={draft.show.drugAllergies} onToggle={toggle('drugAllergies')}>
        {fromHistory(drugs.length ? drugs.join(', ') : t('None added'), '/historial-alergias-editar')}
      </FieldBlock>
      <FieldBlock title={t('Emergency contact')} recommended on={draft.show.contact} onToggle={toggle('contact')}>
        {input('phone', t('Emergency phone'), t('Emergency phone'))}
        {input('contact', t('Whose phone it is (optional), e.g. Luis (partner)'), t('Whose phone it is (optional)'))}
      </FieldBlock>

      <Text style={hs.label}>{t('You can also add')}</Text>
      <FieldBlock title={t('Important')} on={draft.show.notices} onToggle={toggle('notices')}>
        <Text style={[hs.rowMeta, { marginBottom: 2 }]}>{t('Things whoever helps you should know: diabetes, anticoagulants, pregnancy…')}</Text>
        <View style={hs.chips}>
          {NOTICE_CATALOG.map((n) => (
            <Chip key={n} label={t(n)} on={draft.notices.some((x) => x.name === n)} onPress={() => change(toggleNotice(draft, n))} />
          ))}
          {custom.map((n) => (
            <Chip key={n.name} label={`${noticeLabel(n)}  ×`} on onPress={() => change(toggleNotice(draft, n.name))} />
          ))}
        </View>
        <View style={hs.inputRow}>
          <TextInput
            style={[hs.input, { flex: 1 }]}
            value={other}
            onChangeText={setOther}
            maxLength={60}
            placeholder={t('Something else')}
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={addOther}
            accessibilityLabel={t('Something else')}
          />
          <TouchableOpacity onPress={addOther} disabled={!other.trim() || draft.notices.length >= NOTICES_MAX} hitSlop={8}>
            <Text style={[hs.link, (!other.trim() || draft.notices.length >= NOTICES_MAX) && { opacity: 0.4 }]}>{t('Add')}</Text>
          </TouchableOpacity>
        </View>
      </FieldBlock>
      <FieldBlock title={t('Food and other allergies')} on={draft.show.otherAllergies} onToggle={toggle('otherAllergies')}>
        {fromHistory(others.length ? others.join(', ') : t('None added'), '/historial-alergias-editar')}
      </FieldBlock>
      <FieldBlock title={t('Address')} on={draft.show.address} onToggle={toggle('address')}>
        {input('address', t('Street, number, town'), t('Address'))}
      </FieldBlock>
      {missing.length > 0 && <Text style={hs.meta}>{t('Still missing: {list}.', { list: joinList(missing) })}</Text>}

      <Modal visible={big} transparent animationType="fade" onRequestClose={() => setBig(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }} onPress={() => setBig(false)}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, alignItems: 'center' }}>
            <BigQr h={view} lock={variant === 'lock'} size={Math.min(width - 72, 360)} />
          </View>
          <Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 16 }}>{t('Tap anywhere to close')}</Text>
        </Pressable>
      </Modal>
    </HistFrame>
  );
}
