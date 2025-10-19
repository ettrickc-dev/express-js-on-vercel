// lib/store.js
// This safely saves your user’s answers and files in memory
const drafts = new Map(); // id -> draft data
const files = new Map();  // sessionId -> { buffer, filename, mime, expiresAt }

export const Store = {
  saveDraft(d) { drafts.set(d.id, d); },
  getDraft(id) { return drafts.get(id); },

  saveFile(sessionId, obj) { files.set(sessionId, obj); },
  getFile(sessionId) {
    const f = files.get(sessionId);
    if (!f) return null;
    if (f.expiresAt && Date.now() > f.expiresAt) {
      files.delete(sessionId);
      return null;
    }
    return f;
  }
};
