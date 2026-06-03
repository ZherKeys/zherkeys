const fs = require('fs');
const path = require('path');

const MEM_DIR = path.join(__dirname, '..', 'memory');
const USERS_FILE = path.join(MEM_DIR, 'users.json');
const SESS_FILE = path.join(MEM_DIR, 'sessions.json');

// Mesmo arquivo que o server.js usa (persistência única do site)
const ROOT_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const KNOW_FILE = path.join(DATA_DIR, 'zhertalk_knowledge.json');
const LEGACY_KNOW_FILE = path.join(MEM_DIR, 'knowledge.json');

const MAX_KNOWLEDGE_ITEMS = 500;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8') || 'null');
  } catch (e) {
    return fallback;
  }
}

function atomicWriteJson(p, value) {
  ensureDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function normalizeKey(query) {
  return String(query || '').trim().toLowerCase();
}

function mergeKnowledgeArrays(primary, extra) {
  const out = Array.isArray(primary) ? [...primary] : [];
  const indexByKey = new Map();
  for (const it of out) indexByKey.set(normalizeKey(it.query), it);
  for (const it of extra || []) {
    const key = normalizeKey(it.query);
    if (!key) continue;
    if (indexByKey.has(key)) {
      const existing = indexByKey.get(key);
      const merged = { ...existing, ...it, updated_at: Date.now() };
      const idx = out.findIndex((x) => normalizeKey(x.query) === key);
      if (idx !== -1) out[idx] = merged;
      indexByKey.set(key, merged);
    } else {
      out.unshift(it);
      indexByKey.set(key, it);
    }
  }
  if (out.length > MAX_KNOWLEDGE_ITEMS) out.length = MAX_KNOWLEDGE_ITEMS;
  return out;
}

let legacyKnowledgeMigrated = false;

function migrateLegacyKnowledge() {
  if (legacyKnowledgeMigrated) return;
  legacyKnowledgeMigrated = true;
  ensureDir(DATA_DIR);
  if (!fs.existsSync(KNOW_FILE)) {
    atomicWriteJson(KNOW_FILE, []);
  }
  const legacy = readJson(LEGACY_KNOW_FILE, []);
  if (!legacy.length) return;
  const current = readJson(KNOW_FILE, []);
  const merged = mergeKnowledgeArrays(current, legacy);
  atomicWriteJson(KNOW_FILE, merged);
  try {
    atomicWriteJson(LEGACY_KNOW_FILE, merged);
  } catch (e) { /* ignore */ }
}

migrateLegacyKnowledge();

function loadDB() {
  if (!fs.existsSync(USERS_FILE)) return { users: {} };
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveDB(db) {
  ensureDir(MEM_DIR);
  atomicWriteJson(USERS_FILE, db);
}

function ensureState(user) {
  if (!user.state) {
    user.state = {
      pendingLearnId: null,
      learnStage: null,
      lastTopic: null,
      lastBotPrompt: null,
      programming: { activeProblemId: null, language: 'python', difficulty: 'facil' }
    };
  }
  if (!user.state.programming) {
    user.state.programming = { activeProblemId: null, language: 'python', difficulty: 'facil' };
  }
  return user.state;
}

function getUser(db, userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      memory: { long_term: [], short_term: [], summaries: [] },
      profile: { name: null, interests: [], style: 'casual' },
      state: {
        pendingLearnId: null,
        learnStage: null,
        lastTopic: null,
        lastBotPrompt: null,
        programming: { activeProblemId: null, language: 'python', difficulty: 'facil' }
      }
    };
  }
  ensureState(db.users[userId]);
  return db.users[userId];
}

function remember(db, userId, text) {
  const user = getUser(db, userId);
  user.memory.short_term.push({ text, time: Date.now() });
  if (user.memory.short_term.length > 20) user.memory.short_term.shift();
}

function loadUsers() { return readJson(USERS_FILE, { users: {} }); }
function saveUsers(u) { atomicWriteJson(USERS_FILE, u); }

function loadKnowledge() {
  return readJson(KNOW_FILE, []);
}

function saveKnowledge(k) {
  const list = Array.isArray(k) ? k : [];
  if (list.length > MAX_KNOWLEDGE_ITEMS) list.length = MAX_KNOWLEDGE_ITEMS;
  atomicWriteJson(KNOW_FILE, list);
  try {
    atomicWriteJson(LEGACY_KNOW_FILE, list);
  } catch (e) { /* ignore */ }
}

function loadSessions() { return readJson(SESS_FILE, { sessions: {} }); }
function saveSessions(s) { atomicWriteJson(SESS_FILE, s); }

function addKnowledge(item) {
  const k = loadKnowledge();
  const key = normalizeKey(item.query);
  const idx = k.findIndex((it) => normalizeKey(it.query) === key);
  if (idx !== -1) {
    k[idx] = { ...k[idx], ...item, updated_at: Date.now() };
    if (!k[idx].id) k[idx].id = item.id || `kb-${Date.now()}`;
    saveKnowledge(k);
    return k[idx];
  }
  const newItem = {
    ...item,
    id: item.id || `kb-${Date.now()}`,
    created_at: item.created_at || Date.now()
  };
  k.unshift(newItem);
  saveKnowledge(k);
  return newItem;
}

function appendExamplesToKnowledge(id, examples) {
  const k = loadKnowledge();
  const idx = k.findIndex((it) => it.id === id);
  if (idx === -1) return null;
  const item = k[idx];
  const block = examples.map((e, i) => `${i + 1}. ${e}`).join('\n');
  item.content = `${item.content || ''}\n\nExemplos:\n${block}`.trim();
  item.updated_at = Date.now();
  saveKnowledge(k);
  return item;
}

const phrases = require('./phrases');

function findKnowledgeByKeyword(q, limit = 5) {
  const k = loadKnowledge();
  if (!q) return [];
  const qTokens = phrases.expandTokens(String(q));
  if (!qTokens.length) return [];
  const scored = [];
  for (const it of k) {
    const query = String(it.query || '').toLowerCase();
    const text = ((it.query || '') + ' ' + (it.content || '')).toLowerCase();
    const itemTokens = phrases.expandTokens(text);
    let score = 0;
    for (const qt of qTokens) {
      if (query === qt || query.includes(qt)) score += 2;
      if (itemTokens.includes(qt)) score += 1;
      for (const itok of itemTokens) {
        if (phrases.fuzzyMatch(qt, itok)) score += 0.4;
      }
    }
    scored.push({ it, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const minScore = qTokens.length === 1 ? 1.2 : 0.8;
  return scored.filter((s) => s.score >= minScore).slice(0, limit).map((s) => ({ ...s.it, _score: s.score }));
}

module.exports = {
  loadDB, saveDB, getUser, remember, ensureState,
  loadUsers, saveUsers, loadKnowledge, saveKnowledge, loadSessions, saveSessions,
  addKnowledge, appendExamplesToKnowledge, findKnowledgeByKeyword,
  KNOW_FILE, DATA_DIR
};
