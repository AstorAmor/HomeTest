import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { ChatMessage } from './specialistTypes';

// Chat paciente ↔ especialista. Con cuenta: tablas `conversations` / `messages` y
// Supabase Realtime (los mensajes nuevos llegan al instante; RLS decide quién los ve).
// En modo demo (o con especialistas de ejemplo) los mensajes se guardan en el móvil
// y la otra parte contesta con un mensaje automático para poder probar la pantalla.

export const DEMO_ME = 'demo-me';
const localKey = (conversationId: string) => `chat.v1:${conversationId}`;

export const isRemoteConversation = (conversationId: string) => isRemoteActive() && /^[0-9a-f-]{36}$/i.test(conversationId);

const toMessage = (r: any): ChatMessage => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  body: r.body,
  createdAt: r.created_at,
  readAt: r.read_at,
});

async function localMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(localKey(conversationId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

type Listener = (m: ChatMessage) => void;
const localListeners = new Map<string, Set<Listener>>();

async function addLocal(conversationId: string, senderId: string, body: string): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    senderId,
    body,
    createdAt: new Date().toISOString(),
    readAt: null,
  };
  await AsyncStorage.setItem(localKey(conversationId), JSON.stringify([...(await localMessages(conversationId)), msg]));
  localListeners.get(conversationId)?.forEach((l) => l(msg));
  return msg;
}

export const chat = {
  myId: () => (isRemoteActive() ? getCurrentUserId() ?? DEMO_ME : DEMO_ME),

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    if (!isRemoteConversation(conversationId) || !supabase) return localMessages(conversationId);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []).map(toMessage);
  },

  async send(conversationId: string, body: string, demoReply?: string): Promise<ChatMessage> {
    const text = body.trim();
    if (!isRemoteConversation(conversationId) || !supabase) {
      const mine = await addLocal(conversationId, DEMO_ME, text);
      if (demoReply) setTimeout(() => addLocal(conversationId, 'demo-other', demoReply), 1500);
      return mine;
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, body: text })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Could not send');
    return toMessage(data);
  },

  // Marca como leídos los mensajes recibidos (solo con cuenta).
  async markRead(conversationId: string) {
    if (!isRemoteConversation(conversationId) || !supabase) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', getCurrentUserId())
      .is('read_at', null);
  },

  // Mensajes nuevos en directo. Devuelve la función para dejar de escuchar.
  subscribe(conversationId: string, onMessage: Listener): () => void {
    if (!isRemoteConversation(conversationId) || !supabase) {
      const set = localListeners.get(conversationId) ?? new Set<Listener>();
      set.add(onMessage);
      localListeners.set(conversationId, set);
      return () => set.delete(onMessage);
    }
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => onMessage(toMessage(payload.new)),
      )
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  },
};
