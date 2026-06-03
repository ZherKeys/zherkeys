const fs = require('fs');
const path = require('path');

// Paths
const MEM_DIR = path.join(__dirname, '..', 'memory');
const USERS_FILE = path.join(MEM_DIR, 'users.json');
const KNOW_FILE = path.join(MEM_DIR, 'knowledge.json');
const SESS_FILE = path.join(MEM_DIR, 'sessions.json');

function ensureDir(){ if (!fs.existsSync(MEM_DIR)) fs.mkdirSync(MEM_DIR, { recursive: true }); }
function readJson(p, fallback){ try { if (!fs.existsSync(p)) return fallback; return JSON.parse(fs.readFileSync(p, 'utf8') || 'null'); } catch(e){ return fallback; } }
function writeJson(p, v){ ensureDir(); fs.writeFileSync(p, JSON.stringify(v, null, 2), 'utf8'); }

// New API (as provided)
function loadDB(){
  if (!fs.existsSync(USERS_FILE)) return { users: {} };
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveDB(db){ ensureDir(); fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2), 'utf8'); }

function getUser(db, userId){
  if (!db.users[userId]){
    db.users[userId] = {
      memory: { long_term: [], short_term: [], summaries: [] },
      profile: { name: null, interests: [], style: 'casual' }
    };
  }
  return db.users[userId];
}

function remember(db, userId, text){
  const user = getUser(db, userId);
  user.memory.short_term.push({ text, time: Date.now() });
  if (user.memory.short_term.length > 20) user.memory.short_term.shift();
}

// Backwards-compatible API (existing modules expect these)
function loadUsers(){ return readJson(USERS_FILE, { users: {} }); }
function saveUsers(u){ writeJson(USERS_FILE, u); }

function loadKnowledge(){ return readJson(KNOW_FILE, []); }
function saveKnowledge(k){ writeJson(KNOW_FILE, k); }

function loadSessions(){ return readJson(SESS_FILE, { sessions: {} }); }
function saveSessions(s){ writeJson(SESS_FILE, s); }

function addKnowledge(item){ const k = loadKnowledge(); k.unshift(item); saveKnowledge(k); }

const phrases = require('./phrases');

function findKnowledgeByKeyword(q, limit=5){
  const k = loadKnowledge();
  if (!q) return [];
  const qTokens = phrases.expandTokens(String(q).toLowerCase());
  const scored = [];
  for (const it of k){
    const text = ((it.query||'') + ' ' + (it.content||'')).toLowerCase();
    const itemTokens = phrases.expandTokens(text);
    // score by intersection size
    let score = 0;
    for (const qt of qTokens){ if (itemTokens.includes(qt)) score++; }
    // also check fuzzy matches
    if (score === 0){
      for (const qt of qTokens){
        for (const itok of itemTokens){
          if (phrases.fuzzyMatch(qt, itok)) { score += 0.5; }
        }
      }
    }
    scored.push({ it, score });
  }
  scored.sort((a,b)=>b.score-a.score);
  return scored.filter(s=>s.score>0).slice(0,limit).map(s=>s.it);
}

module.exports = {
  // new API
  loadDB, saveDB, getUser, remember,
  // old API
  loadUsers, saveUsers, loadKnowledge, saveKnowledge, loadSessions, saveSessions, addKnowledge, findKnowledgeByKeyword
};
