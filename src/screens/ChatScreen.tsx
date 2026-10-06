import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { chat, isRemoteConversation } from '@/data/chat';
import { ChatMessage } from '@/data/specialistTypes';

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// Chat paciente ↔ especialista (lo usan los dos lados). Mensajes en directo con
// Supabase Realtime; en demo, en el móvil con una respuesta automática.
export const ChatScreen = () => {
  const { conversation, title, side } = useLocalSearchParams<{ conversation: string; title?: string; side?: 'pro' | 'patient' }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const me = chat.myId();
  const demo = !isRemoteConversation(conversation);

  const load = useCallback(async () => {
    const list = await chat.listMessages(conversation).catch(() => null);
    if (!list) return;
    setMessages((prev) => (prev.length === list.length && prev[prev.length - 1]?.id === list[list.length - 1]?.id ? prev : list));
    chat.markRead(conversation);
  }, [conversation]);

  useEffect(() => {
    load();
    const off = chat.subscribe(conversation, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.senderId !== me) chat.markRead(conversation);
    });
    // Respaldo si el tiempo real cae: los mensajes están siempre guardados en la base de
    // datos, así que se vuelven a leer cada 20 s y al volver a la app.
    const poll = demo ? null : setInterval(load, 20000);
    const appState = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => {
      off();
      if (poll) clearInterval(poll);
      appState.remove();
    };
  }, [conversation, load, me, demo]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    setError('');
    try {
      const reply =
        side === 'pro'
          ? 'Thanks, doctor! (automatic demo reply)'
          : 'Thanks for your message. I usually answer within 24 h on working days. (automatic demo reply)';
      const m = await chat.send(conversation, body, demo ? reply : undefined);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e) {
      setText(body);
      setError(e instanceof Error ? e.message : 'Could not send');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader title={title ?? 'Chat'} showBack />
        <Text style={styles.notice}>
          {side === 'pro'
            ? 'Messages are stored in Kuova and only you and your patient can read them.'
            : 'For urgent symptoms call 112. Messages are private between you and your specialist.'}
        </Text>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const mine = item.senderId === me;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.body, mine && { color: Colors.background }]}>{item.body}</Text>
                <Text style={[styles.time, mine && { color: Colors.background, opacity: 0.8 }]}>
                  {time(item.createdAt)}
                  {mine && item.readAt ? ' · read' : ''}
                </Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello 👋</Text>}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Write a message"
            placeholderTextColor={Colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            onSubmitEditing={send}
          />
          <TouchableOpacity style={[styles.send, !text.trim() && { opacity: 0.5 }]} onPress={send} disabled={!text.trim()}>
            <Ionicons name="send" size={18} color={Colors.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  notice: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginHorizontal: 24, marginBottom: 6 },
  list: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexGrow: 1 },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  mine: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderBottomLeftRadius: 4 },
  body: { color: Colors.textPrimary, fontSize: 15, lineHeight: 20 },
  time: { color: Colors.textMuted, fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  error: { color: Colors.danger, fontSize: 12, marginHorizontal: 16 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: Colors.divider },
  input: { flex: 1, maxHeight: 120, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, color: Colors.textPrimary, fontSize: 15 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
});
