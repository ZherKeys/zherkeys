const express = require('express');
const router = express.Router();
const brain = require('../core/brain');
const memory = require('../core/memoryManager');

router.post('/', async (req, res) => {
  const { userId, message, style } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message obrigatório' });

  const db = memory.loadDB ? memory.loadDB() : memory.loadUsers();
  const uid = userId || 'anon';

  const out = brain.generateReply(uid, message, style, db);

  const replyText = typeof out === 'string' ? out : (out.reply || '');
  if (replyText && memory.remember) memory.remember(db, uid, `[ZH] ${replyText}`);

  if (memory.saveDB) {
    try { memory.saveDB(db); } catch (e) { /* ignore */ }
  }

  const reply = typeof out === 'string' ? out : (out.reply || out);
  res.json({
    reply,
    context_used: true,
    meta: out && out.sources ? { sources: out.sources } : undefined
  });
});

module.exports = router;
