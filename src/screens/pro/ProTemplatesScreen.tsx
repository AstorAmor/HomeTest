import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { Colors, withAlpha } from '@/constants/colors';
import {
  ProTemplate,
  TEMPLATE_TOPICS,
  TemplateDraft,
  TopicOption,
  TopicSettings,
  addTopic,
  cleanCustomTopic,
  customTopicsOf,
  deleteTopic,
  findGaps,
  guessTopic,
  restoreSampleTopics,
  templateTopicIcon,
  templateTopicName,
  templates,
  topicKeyOf,
  topicOptions,
  topicSettings,
} from '@/data/proTemplates';
import { canImportTextFile, pickTextFile } from '@/utils/importTextFile';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

import { t as tr, tn } from '@/i18n';
const confirmAsk = (title: string, message: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(message))
    : new Promise<boolean>((resolve) =>
        Alert.alert(title, message, [
          { text: tr('Cancel'), style: 'cancel', onPress: () => resolve(false) },
          { text: tr('Delete'), style: 'destructive', onPress: () => resolve(true) },
        ])
      );

const OTHER_TOPIC = TEMPLATE_TOPICS.find((t) => t.id === 'other')!;

const EMPTY: TemplateDraft = { title: '', topic: 'other', keywords: [], body: '' };

// Tema de una plantilla a partir de una opción de la lista (de ejemplo o propio)
const topicFields = (o: TopicOption | undefined): Pick<TemplateDraft, 'topic' | 'customTopic'> =>
  o?.fixed ? { topic: o.fixed, customTopic: null } : o?.custom ? { topic: 'other', customTopic: o.custom } : { topic: 'other', customTopic: null };

// "Nueva": con un filtro puesto nace con ese tema; si no, con "Resultados de analíticas" si sigue existiendo
const newDraftFor = (filter: string, options: TopicOption[]): TemplateDraft => ({
  ...EMPTY,
  ...topicFields(options.find((o) => o.key === filter) ?? options.find((o) => o.key === 'blood_test')),
});

// Biblioteca de plantillas del especialista. Escritorio: lista a la izquierda y editor a la
// derecha. Móvil: lista y, al abrir una, el editor a pantalla completa.
export const ProTemplatesScreen = () => {
  const wide = useIsWide();
  const [list, setList] = useState<ProTemplate[] | null>(null);
  // 'all', un tema de ejemplo ('cycle'…), 'other' (Otro) o un tema propio ('c:embarazo')
  const [filter, setFilter] = useState<string>('all');
  const [settings, setSettings] = useState<TopicSettings>({ hidden: [], custom: [] });
  const [adding, setAdding] = useState(false); // "+ Nuevo tema" abierto en el editor
  const [newTopic, setNewTopic] = useState('');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([templates.list(), topicSettings.get()]);
      setList(l);
      setSettings(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not load your templates'));
      setList([]);
    }
  }, []);
  useReloadOnFocus(load);

  const options = useMemo(() => topicOptions(settings, list ?? []), [settings, list]);
  const counts = (list ?? []).reduce<Record<string, number>>((acc, t) => ({ ...acc, [topicKeyOf(t)]: (acc[topicKeyOf(t)] ?? 0) + 1 }), {});
  const customTopics = useMemo(() => customTopicsOf(list ?? []), [list]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter(
      (t) =>
        (filter === 'all' || topicKeyOf(t) === filter) &&
        (!q || `${t.title} ${t.customTopic ?? ''} ${t.keywords.join(' ')} ${t.body}`.toLowerCase().includes(q))
    );
  }, [list, filter, query]);

  const open = (d: TemplateDraft) => {
    setDraft(d);
    setAdding(false);
    setKeywordsText(d.keywords.join(', '));
    setState('idle');
    setError('');
  };

  const dirty = (() => {
    if (!draft) return false;
    const orig = draft.id ? list?.find((t) => t.id === draft.id) : undefined;
    if (!orig) return !!(draft.title.trim() || draft.body.trim());
    const custom = draft.topic === 'other' ? cleanCustomTopic(draft.customTopic) : null;
    return (
      orig.title !== draft.title ||
      orig.topic !== draft.topic ||
      (orig.customTopic ?? null) !== custom ||
      orig.body !== draft.body ||
      orig.keywords.join(', ') !== keywordsText
    );
  })();

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.body.trim()) {
      setError(tr('Give the template a name and some text.'));
      return;
    }
    setState('saving');
    setError('');
    try {
      const customTopic = draft.topic === 'other' ? cleanCustomTopic(draft.customTopic, customTopics) : null;
      const saved = await templates.save({ ...draft, customTopic, keywords: keywordsText.split(',') });
      setDraft({ id: saved.id, title: saved.title, topic: saved.topic, customTopic: saved.customTopic, keywords: saved.keywords, body: saved.body });
      setState('saved');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not save'));
      setState('idle');
    }
  };

  const remove = async () => {
    if (!draft?.id || !(await confirmAsk(tr('Delete template'), tr('Delete “{title}”?', { title: draft.title })))) return;
    await templates.remove(draft.id);
    setDraft(null);
    load();
  };

  // Borrar un tema (de ejemplo o propio): las plantillas no se borran, pasan a "Otro"
  const removeTopic = async (o: TopicOption) => {
    const n = counts[o.key] ?? 0;
    const msg = n
      ? tn(n, 'Delete the topic “{topic}”? Its template moves to “Other”.', 'Delete the topic “{topic}”? Its {n} templates move to “Other”.').replace('{topic}', o.label)
      : tr('Delete the topic “{topic}”?', { topic: o.label });
    if (!(await confirmAsk(tr('Delete topic'), msg))) return;
    try {
      await deleteTopic(o);
      if (draft && topicKeyOf(draft) === o.key) setDraft({ ...draft, topic: 'other', customTopic: null });
      if (filter === o.key) setFilter('all');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not save'));
    }
  };

  // Crear un tema; en el editor, además, se le pone a la plantilla
  const createTopic = async () => {
    try {
      const o = await addTopic(newTopic, list ?? []);
      if (!o) return;
      if (draft) setDraft({ ...draft, ...topicFields(o) });
      setNewTopic('');
      setAdding(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not save'));
    }
  };

  const topicInput = (
    <View style={styles.addRow}>
      <TextInput
        style={[styles.input, { flex: 1, minHeight: 38, paddingVertical: 8 }]}
        value={newTopic}
        onChangeText={setNewTopic}
        onSubmitEditing={createTopic}
        placeholder={tr('Topic name, e.g. Pregnancy')}
        placeholderTextColor={Colors.textMuted}
        maxLength={40}
        autoFocus
      />
      <TouchableOpacity style={[styles.primary, { paddingVertical: 8 }, !newTopic.trim() && { opacity: 0.5 }]} disabled={!newTopic.trim()} onPress={createTopic}>
        <Text style={styles.primaryText}>{tr('Add')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => {
          setAdding(false);
          setNewTopic('');
        }}
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );

  const importFile = async () => {
    setError('');
    try {
      const file = await pickTextFile();
      if (!file) return;
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      const guessed = guessTopic(`${title} ${file.text}`);
      open({ title, ...topicFields(options.find((o) => o.key === guessed)), keywords: [], body: file.text.slice(0, 20000) });
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Could not read the file'));
    }
  };

  const where = templates.where();
  // Temas en orden: los de ejemplo, los propios del médico y "Otro" al final
  const filterOptions = [{ id: 'all', label: tr('All') }, ...options.map((o) => ({ id: o.key, label: o.label })), { id: 'other', label: OTHER_TOPIC.label }];

  const listView = (
    <View style={{ gap: 10 }}>
      <Text style={styles.intro}>
        {tr('Write once what you explain again and again. When you answer a patient, Kuova suggests the right template.')}{' '}
        <Text style={styles.code}>{tr('[name]')}</Text> {tr('and')} <Text style={styles.code}>{tr('[doctor]')}</Text>{' '}
        {tr('fill themselves; anything else in [brackets] you complete before sending.')}
      </Text>
      {where === 'device' && (
        <View style={styles.notice}>
          <Ionicons name="phone-portrait-outline" size={14} color={Colors.warning} />
          <Text style={styles.noticeText}>{tr('Saved on this device for now: the database update for templates isn’t applied yet.')}</Text>
        </View>
      )}
      <View style={styles.search}>
        <Ionicons name="search" size={15} color={Colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder={tr('Search templates')} placeholderTextColor={Colors.textMuted} value={query} onChangeText={setQuery} />
      </View>
      <View style={styles.filters}>
        {filterOptions.map((t) => {
          const n = t.id === 'all' ? list?.length ?? 0 : counts[t.id] ?? 0;
          if (t.id !== 'all' && n === 0) return null;
          const on = filter === t.id;
          return (
            <TouchableOpacity key={t.id} style={[styles.filter, on && styles.filterOn]} onPress={() => setFilter(t.id)}>
              <Text style={[styles.filterText, on && { color: Colors.background }]}>
                {t.label} · {n}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {list === null ? (
        <ActivityIndicator color={Colors.accent} />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="documents-outline" size={36} color={Colors.accent} />
          <Text style={styles.emptyTitle}>{tr('Your library is empty')}</Text>
          <Text style={styles.muted}>{tr('Start from our examples (iron, vitamin D, cholesterol, cycle, thyroid, glucose) and make them yours, or write your own.')}</Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={async () => {
              await templates.addSamples();
              load();
            }}
          >
            <Text style={styles.primaryText}>{tr('Start with sample templates')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {shown.map((t) => {
            const on = draft?.id === t.id;
            return (
              <TouchableOpacity key={t.id} style={[styles.item, on && styles.itemOn]} onPress={() => open(t)}>
                <View style={styles.itemIcon}>
                  <Ionicons name={templateTopicIcon(t) as any} size={16} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{t.title}</Text>
                  <Text style={styles.itemSub} numberOfLines={1}>
                    {templateTopicName(t)}
                    {t.uses ? ` · ${tn(t.uses, 'used {n} time', 'used {n} times')}` : ''}
                  </Text>
                </View>
                {!wide && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            );
          })}
          {shown.length === 0 && <Text style={styles.muted}>{tr('No templates match.')}</Text>}
        </View>
      )}
    </View>
  );

  const gaps = draft ? findGaps(draft.body).filter((g) => !/^\[(name|nombre|doctor|doctora|médico|medico)\]$/i.test(g)) : [];

  const editor = draft ? (
    <View style={styles.editor}>
      <View style={styles.editorHead}>
        {!wide && (
          <TouchableOpacity onPress={() => setDraft(null)} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        <Text style={styles.editorTitle}>{draft.id ? tr('Edit template') : tr('New template')}</Text>
        <View style={{ flex: 1 }} />
        {state === 'saved' && !dirty ? <Text style={styles.saved}>{tr('Saved')}</Text> : null}
      </View>

      <Text style={styles.fieldLabel}>{tr('Name')}</Text>
      <TextInput
        style={[styles.input, { minHeight: 42 }]}
        value={draft.title}
        onChangeText={(t) => setDraft({ ...draft, title: t })}
        placeholder={tr('e.g. Low ferritin and tiredness')}
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.fieldLabel}>{tr('Topic')}</Text>
      <View style={styles.filters}>
        {[...options, { key: 'other', label: OTHER_TOPIC.label, icon: OTHER_TOPIC.icon } as TopicOption].map((o) => {
          const on = topicKeyOf(draft) === o.key;
          return (
            <View key={o.key} style={[styles.filter, styles.customChip, on && styles.filterOn]}>
              <TouchableOpacity onPress={() => setDraft({ ...draft, ...topicFields(o.key === 'other' ? undefined : o) })}>
                <Text style={[styles.filterText, on && { color: Colors.background }]}>{o.label}</Text>
              </TouchableOpacity>
              {o.key !== 'other' && (
                <TouchableOpacity onPress={() => removeTopic(o)} hitSlop={8} accessibilityLabel={tr('Delete topic')}>
                  <Ionicons name="close" size={13} color={on ? Colors.background : Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        {!adding && (
          <TouchableOpacity style={[styles.filter, styles.newChip]} onPress={() => setAdding(true)}>
            <Text style={styles.newChipText}>+ {tr('New topic')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {adding && topicInput}
      {settings.hidden.length > 0 && (
        <TouchableOpacity
          onPress={async () => {
            await restoreSampleTopics();
            load();
          }}
        >
          <Text style={styles.link}>{tn(settings.hidden.length, 'Restore {n} deleted sample topic', 'Restore {n} deleted sample topics')}</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.fieldLabel}>{tr('Words that should suggest it (optional)')}</Text>
      <TextInput
        style={[styles.input, { minHeight: 42 }]}
        value={keywordsText}
        onChangeText={setKeywordsText}
        placeholder={tr('ferritin, hierro, tired, cansancio')}
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.fieldLabel}>{tr('Text')}</Text>
      <TextInput
        style={[styles.input, styles.body]}
        multiline
        value={draft.body}
        onChangeText={(t) => setDraft({ ...draft, body: t })}
        placeholder={tr('Hi [name],\n\nYour ferritin is [value] ng/mL…\n\nBest wishes,\n[doctor]')}
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={styles.hint}>
        {gaps.length
          ? `${tr('Gaps to complete for each patient:')} ${gaps.slice(0, 6).join('  ')}${gaps.length > 6 ? ' …' : ''}`
          : tr('Tip: put what changes from patient to patient in [brackets], e.g. [value] or [3 months].')}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.primary, { flex: 1 }, (!dirty || state === 'saving') && { opacity: 0.5 }]} disabled={!dirty || state === 'saving'} onPress={save}>
          {state === 'saving' ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.primaryText}>{tr('Save template')}</Text>}
        </TouchableOpacity>
        {draft.id && (
          <TouchableOpacity style={styles.ghost} onPress={() => open({ ...draft, id: undefined, title: `${draft.title} (copy)` })}>
            <Ionicons name="copy-outline" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        {draft.id && (
          <TouchableOpacity style={styles.ghost} onPress={remove}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ) : (
    <View style={styles.placeholder}>
      <Ionicons name="create-outline" size={28} color={Colors.textMuted} />
      <Text style={styles.muted}>{tr('Choose a template to edit it, or create a new one.')}</Text>
    </View>
  );

  const headerRight = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {canImportTextFile && (
        <TouchableOpacity style={styles.headerBtn} onPress={importFile}>
          <Ionicons name="cloud-upload-outline" size={16} color={Colors.accent} />
          {wide && <Text style={styles.headerBtnText}>{tr('Import .docx / .txt')}</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.headerBtn, styles.headerBtnPrimary]} onPress={() => open(newDraftFor(filter, options))}>
        <Ionicons name="add" size={16} color={Colors.background} />
        <Text style={[styles.headerBtnText, { color: Colors.background }]}>{tr('New')}</Text>
      </TouchableOpacity>
    </View>
  );

  if (wide) {
    return (
      <ProLayout active="templates" title={tr('Templates')} right={headerRight}>
        <View style={styles.split}>
          <View style={styles.left}>{listView}</View>
          <View style={styles.right}>{editor}</View>
        </View>
      </ProLayout>
    );
  }
  return (
    <ProLayout active="templates" title={tr('Templates')} right={headerRight}>
      {draft ? editor : listView}
    </ProLayout>
  );
};

const styles = StyleSheet.create({
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  code: { fontWeight: '800', color: Colors.textPrimary },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeText: { color: Colors.warning, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14, paddingVertical: 9 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, padding: 12 },
  itemOn: { borderColor: Colors.accent, backgroundColor: withAlpha(Colors.accent, 0.08) },
  itemIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  itemSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 24, paddingHorizontal: 12 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  split: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  left: { width: 380 },
  right: { flex: 1, minWidth: 0 },
  editor: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16, gap: 6 },
  editorHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  editorTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900' },
  saved: { color: Colors.ok, fontSize: 12, fontWeight: '700' },
  fieldLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 8 },
  input: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.background, borderRadius: 10, padding: 10, color: Colors.textPrimary, fontSize: 14, textAlignVertical: 'top' },
  body: { minHeight: 340, lineHeight: 20 },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  primary: { backgroundColor: Colors.accent, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  ghost: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, width: 42, alignItems: 'center', justifyContent: 'center' },
  customChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  newChip: { borderStyle: 'dashed', borderColor: withAlpha(Colors.accent, 0.6) },
  newChipText: { color: Colors.accent, fontSize: 12, fontWeight: '800' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  placeholder: { alignItems: 'center', gap: 8, paddingVertical: 60, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.cardBorder, borderRadius: 16 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.5), borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  headerBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  headerBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
});
