import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProLayout, useIsWide } from '@/components/pro/ProLayout';
import { Colors, withAlpha } from '@/constants/colors';
import {
  ProTemplate,
  TEMPLATE_TOPICS,
  TemplateDraft,
  TemplateTopic,
  findGaps,
  guessTopic,
  templates,
  topicIcon,
  topicLabel,
} from '@/data/proTemplates';
import { canImportTextFile, pickTextFile } from '@/utils/importTextFile';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const confirmDelete = (title: string) =>
  Platform.OS === 'web'
    ? Promise.resolve(window.confirm(`Delete “${title}”?`))
    : new Promise<boolean>((resolve) =>
        Alert.alert('Delete template', `Delete “${title}”?`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ])
      );

const EMPTY: TemplateDraft = { title: '', topic: 'blood_test', keywords: [], body: '' };

// Biblioteca de plantillas del especialista. Escritorio: lista a la izquierda y editor a la
// derecha. Móvil: lista y, al abrir una, el editor a pantalla completa.
export const ProTemplatesScreen = () => {
  const wide = useIsWide();
  const [list, setList] = useState<ProTemplate[] | null>(null);
  const [filter, setFilter] = useState<TemplateTopic | 'all'>('all');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [keywordsText, setKeywordsText] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setList(await templates.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your templates');
      setList([]);
    }
  }, []);
  useReloadOnFocus(load);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list ?? []).filter(
      (t) =>
        (filter === 'all' || t.topic === filter) &&
        (!q || `${t.title} ${t.keywords.join(' ')} ${t.body}`.toLowerCase().includes(q))
    );
  }, [list, filter, query]);

  const open = (d: TemplateDraft) => {
    setDraft(d);
    setKeywordsText(d.keywords.join(', '));
    setState('idle');
    setError('');
  };

  const dirty = (() => {
    if (!draft) return false;
    const orig = draft.id ? list?.find((t) => t.id === draft.id) : undefined;
    if (!orig) return !!(draft.title.trim() || draft.body.trim());
    return orig.title !== draft.title || orig.topic !== draft.topic || orig.body !== draft.body || orig.keywords.join(', ') !== keywordsText;
  })();

  const save = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.body.trim()) {
      setError('Give the template a name and some text.');
      return;
    }
    setState('saving');
    setError('');
    try {
      const saved = await templates.save({ ...draft, keywords: keywordsText.split(',') });
      setDraft({ id: saved.id, title: saved.title, topic: saved.topic, keywords: saved.keywords, body: saved.body });
      setState('saved');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setState('idle');
    }
  };

  const remove = async () => {
    if (!draft?.id || !(await confirmDelete(draft.title))) return;
    await templates.remove(draft.id);
    setDraft(null);
    load();
  };

  const importFile = async () => {
    setError('');
    try {
      const file = await pickTextFile();
      if (!file) return;
      const title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
      open({ title, topic: guessTopic(`${title} ${file.text}`), keywords: [], body: file.text.slice(0, 20000) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file');
    }
  };

  const where = templates.where();
  const counts = (list ?? []).reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.topic]: (acc[t.topic] ?? 0) + 1 }), {});

  const listView = (
    <View style={{ gap: 10 }}>
      <Text style={styles.intro}>
        Write once what you explain again and again. When you answer a patient, Kuova suggests the right template.{' '}
        <Text style={styles.code}>[name]</Text> and <Text style={styles.code}>[doctor]</Text> fill themselves; anything else in [brackets] you
        complete before sending.
      </Text>
      {where === 'device' && (
        <View style={styles.notice}>
          <Ionicons name="phone-portrait-outline" size={14} color={Colors.warning} />
          <Text style={styles.noticeText}>Saved on this device for now: the database update for templates isn’t applied yet.</Text>
        </View>
      )}
      <View style={styles.search}>
        <Ionicons name="search" size={15} color={Colors.textMuted} />
        <TextInput style={styles.searchInput} placeholder="Search templates" placeholderTextColor={Colors.textMuted} value={query} onChangeText={setQuery} />
      </View>
      <View style={styles.filters}>
        {[{ id: 'all' as const, label: 'All' }, ...TEMPLATE_TOPICS].map((t) => {
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
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.muted}>Start from our examples (iron, vitamin D, cholesterol, cycle, thyroid, glucose) and make them yours, or write your own.</Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={async () => {
              await templates.addSamples();
              load();
            }}
          >
            <Text style={styles.primaryText}>Start with sample templates</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {shown.map((t) => {
            const on = draft?.id === t.id;
            return (
              <TouchableOpacity key={t.id} style={[styles.item, on && styles.itemOn]} onPress={() => open(t)}>
                <View style={styles.itemIcon}>
                  <Ionicons name={topicIcon(t.topic) as any} size={16} color={Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{t.title}</Text>
                  <Text style={styles.itemSub} numberOfLines={1}>
                    {topicLabel(t.topic)}
                    {t.uses ? ` · used ${t.uses} time${t.uses > 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
                {!wide && <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            );
          })}
          {shown.length === 0 && <Text style={styles.muted}>No templates match.</Text>}
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
        <Text style={styles.editorTitle}>{draft.id ? 'Edit template' : 'New template'}</Text>
        <View style={{ flex: 1 }} />
        {state === 'saved' && !dirty ? <Text style={styles.saved}>Saved</Text> : null}
      </View>

      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={[styles.input, { minHeight: 42 }]}
        value={draft.title}
        onChangeText={(t) => setDraft({ ...draft, title: t })}
        placeholder="e.g. Low ferritin and tiredness"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Topic</Text>
      <View style={styles.filters}>
        {TEMPLATE_TOPICS.map((t) => {
          const on = draft.topic === t.id;
          return (
            <TouchableOpacity key={t.id} style={[styles.filter, on && styles.filterOn]} onPress={() => setDraft({ ...draft, topic: t.id })}>
              <Text style={[styles.filterText, on && { color: Colors.background }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.fieldLabel}>Words that should suggest it (optional)</Text>
      <TextInput
        style={[styles.input, { minHeight: 42 }]}
        value={keywordsText}
        onChangeText={setKeywordsText}
        placeholder="ferritin, hierro, tired, cansancio"
        placeholderTextColor={Colors.textMuted}
      />

      <Text style={styles.fieldLabel}>Text</Text>
      <TextInput
        style={[styles.input, styles.body]}
        multiline
        value={draft.body}
        onChangeText={(t) => setDraft({ ...draft, body: t })}
        placeholder={'Hi [name],\n\nYour ferritin is [value] ng/mL…\n\nBest wishes,\n[doctor]'}
        placeholderTextColor={Colors.textMuted}
      />
      <Text style={styles.hint}>
        {gaps.length
          ? `Gaps to complete for each patient: ${gaps.slice(0, 6).join('  ')}${gaps.length > 6 ? ' …' : ''}`
          : 'Tip: put what changes from patient to patient in [brackets], e.g. [value] or [3 months].'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.primary, { flex: 1 }, (!dirty || state === 'saving') && { opacity: 0.5 }]} disabled={!dirty || state === 'saving'} onPress={save}>
          {state === 'saving' ? <ActivityIndicator size="small" color={Colors.background} /> : <Text style={styles.primaryText}>Save template</Text>}
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
      <Text style={styles.muted}>Choose a template to edit it, or create a new one.</Text>
    </View>
  );

  const headerRight = (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {canImportTextFile && (
        <TouchableOpacity style={styles.headerBtn} onPress={importFile}>
          <Ionicons name="cloud-upload-outline" size={16} color={Colors.accent} />
          {wide && <Text style={styles.headerBtnText}>Import .docx / .txt</Text>}
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.headerBtn, styles.headerBtnPrimary]} onPress={() => open({ ...EMPTY, topic: filter === 'all' ? 'blood_test' : filter })}>
        <Ionicons name="add" size={16} color={Colors.background} />
        <Text style={[styles.headerBtnText, { color: Colors.background }]}>New</Text>
      </TouchableOpacity>
    </View>
  );

  if (wide) {
    return (
      <ProLayout active="templates" title="Templates" right={headerRight}>
        <View style={styles.split}>
          <View style={styles.left}>{listView}</View>
          <View style={styles.right}>{editor}</View>
        </View>
      </ProLayout>
    );
  }
  return (
    <ProLayout active="templates" title="Templates" right={headerRight}>
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
  placeholder: { alignItems: 'center', gap: 8, paddingVertical: 60, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.cardBorder, borderRadius: 16 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: withAlpha(Colors.accent, 0.5), borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  headerBtnPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  headerBtnText: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
});
