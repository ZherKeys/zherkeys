const express = require('express');
const router = express.Router();
const brain = require('../core/brain');
const memory = require('../core/memoryManager');

// POST /api/chat
router.post('/', (req, res) => {
  const { userId, message, style } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message obrigatório' });

  // load DB and user
  const db = (memory.loadDB) ? memory.loadDB() : memory.loadUsers();
  const uid = userId || 'anon';
  const user = (memory.getUser) ? memory.getUser(db, uid) : ((db.users && db.users[uid]) || {});

  // salva memória curta
  if (memory.remember) memory.remember(db, uid, message);

  // cria contexto (via contextManager inside brain)
  const out = brain.generateReply(uid, message, style);

  // salva resposta também na memória curta
  if (memory.remember){
    const replyText = typeof out === 'string' ? out : (out.reply || '');
    if (replyText) memory.remember(db, uid, replyText);
  }

  // persist DB if applicable
  if (memory.saveDB) {
    try { memory.saveDB(db); } catch(e){ /* ignore */ }
  } else if (memory.saveSessions) {
    // fallback: save sessions structure
    const sessions = memory.loadSessions();
    sessions.sessions[uid] = sessions.sessions[uid] || [];
    sessions.sessions[uid].push({ ts: Date.now(), message });
    memory.saveSessions(sessions);
  }

  // normalize response
  const reply = (typeof out === 'string') ? out : (out.reply || out);

  res.json({ reply, context_used: true, meta: out && out.sources ? { sources: out.sources } : undefined });
});

module.exports = router;
