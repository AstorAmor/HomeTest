import { userFlags } from './userFlags';
import { FamilyHistoryDraft, FamilyHistoryRecord } from '@/types/familyHistory';

// "Know your roots" en user_flags (copia local + tabla user_flags con RLS "cada uno lo suyo"):
// - "family_history_draft": se guarda con cada respuesta, para retomar en la misma pregunta
//   aunque se cierre la app.
// - "family_history": el resultado terminado.
// Son datos de salud de categoría especial: no se comparten con nadie salvo que el usuario lo haga.
const DRAFT = 'family_history_draft';
const DONE = 'family_history';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

export const familyHistoryStore = {
  async getDraft(): Promise<FamilyHistoryDraft | null> {
    const v = await userFlags.get(DRAFT);
    return isObj(v) && 'answers' in v && 'stepKey' in v ? (v as unknown as FamilyHistoryDraft) : null;
  },
  async saveDraft(draft: FamilyHistoryDraft): Promise<void> {
    await userFlags.set(DRAFT, draft as unknown as Record<string, unknown>);
  },
  async clearDraft(): Promise<void> {
    // user_flags no borra filas: un valor vacío equivale a "sin borrador"
    await userFlags.set(DRAFT, {});
  },
  async getRecord(): Promise<FamilyHistoryRecord | null> {
    const v = await userFlags.get(DONE);
    return isObj(v) && 'answers' in v && 'level' in v ? (v as unknown as FamilyHistoryRecord) : null;
  },
  async saveRecord(record: FamilyHistoryRecord): Promise<void> {
    await userFlags.set(DONE, record as unknown as Record<string, unknown>);
  },
};
