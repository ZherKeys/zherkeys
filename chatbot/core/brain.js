const memory = require('./memoryManager');
const contextManager = require('./contextManager');
const phrases = require('./phrases');
const vocab = require('./vocab');
const programming = require('./programming');
const codeGenerator = require('./codeGenerator');
const ollama = require('./ollamaIntegration');
const codeMemory = require('./codeMemory');
const sessionMemory = require('./sessionMemory');

function clearLearnState(user) {
  const state = memory.ensureState(user);
  state.pendingLearnId = null;
  state.learnStage = null;
}

function parseLearnPayload(payload) {
  let key = payload;
  let content = payload;
  if (payload.includes('|')) {
    const parts = payload.split('|');
    key = parts[0].trim();
    content = parts.slice(1).join('|').trim();
  } else if (payload.includes('=')) {
    const parts = payload.split('=');
    key = parts[0].trim();
    content = parts.slice(1).join('=').trim();
  } else if (payload.split(/\s+/).length >= 2) {
    const parts = payload.split(/\s+/);
    key = parts[0].trim();
    content = parts.slice(1).join(' ').trim();
  }
  if (!key) key = `item-${Date.now()}`;
  if (!content) content = key;
  return { key, content };
}

function searchKnowledge(query, limit = 5) {
  return memory.findKnowledgeByKeyword ? memory.findKnowledgeByKeyword(query, limit) : [];
}

function replyFromHits(hits, lang) {
  const paras = hits.map((h) => phrases.paraphraseKnowledge(h));
  return { reply: paras.join('\n\n'), sources: hits.map((h) => h.query) };
}

function notFoundReply(lang, topic) {
  const hint = topic
    ? `Ainda não sei sobre "${topic}". Use /learn ${topic}=explicação aqui ou diga mais com suas palavras.`
    : 'Ainda não tenho isso na memória. Use /learn palavra=explicação para me ensinar.';
  if (lang === 'en') {
    return topic
      ? `I don't know about "${topic}" yet. Use /learn ${topic}=explanation to teach me.`
      : "I don't have that in memory yet. Use /learn word=explanation to teach me.";
  }
  return hint;
}

function handleLearnCommand(db, user, trimmed) {
  const payload = trimmed.replace(/^\/learn\s+/i, '').trim();
  const { key, content } = parseLearnPayload(payload);
  const item = {
    id: `kb-${Date.now()}`,
    query: String(key).slice(0, 200),
    content: String(content).slice(0, 4000),
    created_at: Date.now()
  };
  const saved = memory.addKnowledge(item);
  const state = memory.ensureState(user);
  state.pendingLearnId = saved.id || item.id;
  state.learnStage = 'awaiting_examples_confirm';
  state.lastTopic = saved.query || item.query;
  memory.saveDB(db);
  return {
    reply: `Aprendi sobre "${saved.query}": ${saved.content}\n\nIsso foi salvo no disco (data/zhertalk_knowledge.json) e continua depois de reiniciar o servidor.\n\nQuer adicionar exemplos? Responda "sim" (e na próxima mensagem envie textos separados por "|") ou "não" para encerrar.`,
    saved: true,
    item: saved
  };
}

function handleCodeGeneration(db, user, trimmed, state) {
  // Se não está em estado de geração, detecta nova requisição
  if (!state.codeGenState) {
    const creationType = codeGenerator.detectCreationType(trimmed);
    if (!creationType) return null;

    const description = codeGenerator.extractDescription(trimmed);
    
    // Verificar se já tem algo similar na memória
    const memoryMatch = codeMemory.buildMemoryResponse(creationType, description, {});
    if (memoryMatch.hasMemory) {
      // Tem algo na memória!
      state.codeGenState = codeGenerator.initCodeGeneration(user.id || 'anon', creationType, description);
      state.codeGenState.stage = 'memory_found';
      state.codeGenState.memoryMatch = memoryMatch;
      memory.saveDB(db);
      
      return {
        reply: `${memoryMatch.message}\n\n${memoryMatch.suggestion}`
      };
    }
    
    state.codeGenState = codeGenerator.initCodeGeneration(user.id || 'anon', creationType, description);
    memory.saveDB(db);
  }

  // Se encontrou na memória
  if (state.codeGenState.stage === 'memory_found') {
    if (phrases.isAffirmative(trimmed)) {
      // Usuário quer usar o código anterior
      const existing = state.codeGenState.memoryMatch.existingCode;
      state.codeGenState = null;
      memory.saveDB(db);
      return {
        reply: `✅ Perfeito! Aqui está o código:\n\n${existing.content}`
      };
    } else if (phrases.isNegative(trimmed)) {
      // Usuário quer gerar novo
      state.codeGenState.stage = 'gathering_context';
      state.codeGenState.memoryMatch = null;
      memory.saveDB(db);
      
      const firstQuestion = codeGenerator.getNextContextQuestion(state.codeGenState);
      return {
        reply: `Certo! Vou gerar um novo ${state.codeGenState.type}.\n\n❓ ${firstQuestion.question}`
      };
    } else {
      // Resposta inválida
      return {
        reply: `Diga "sim" para usar o código anterior ou "não" para gerar um novo.`
      };
    }
  }

  // Se está coletando contexto
  if (state.codeGenState.stage === 'gathering_context') {
    // Verifica se é resposta de contexto
    if (codeGenerator.isContextResponse(trimmed, state.codeGenState)) {
      codeGenerator.processContextAnswer(state.codeGenState, trimmed);

      // Se tem mais perguntas
      if (!codeGenerator.hasEnoughContext(state.codeGenState)) {
        const nextQuestion = codeGenerator.getNextContextQuestion(state.codeGenState);
        memory.saveDB(db);
        return {
          reply: `❓ ${nextQuestion.question}\n\n(Contexto coletado: ${Object.keys(state.codeGenState.answers).length}/${Object.keys(codeGenerator.CONTEXT_QUESTIONS[state.codeGenState.type]).length})`
        };
      }

      // Contexto completo - prepara geração
      state.codeGenState.stage = 'generating';
      memory.saveDB(db);

      // Retorna mensagem de "carregando"
      return {
        reply: `✨ Perfeito! Vou gerar o código agora...\n\n⏳ Isso pode levar alguns segundos...\n(Vou salvar na minha memória para usar depois! 🧠)`
      };
    }

    // Se não respondeu ainda a primeira pergunta
    const currentQuestion = codeGenerator.getNextContextQuestion(state.codeGenState);
    if (currentQuestion) {
      return {
        reply: `❓ ${currentQuestion.question}`
      };
    }
  }

  return null;
}

async function completeCodeGeneration(db, state, uid) {
  if (!state.codeGenState || state.codeGenState.stage !== 'generating') {
    return null;
  }

  try {
    const prompt = codeGenerator.buildCodePrompt(state.codeGenState);
    const result = await ollama.generateCodeWithFallback(prompt, ollama.DEFAULT_MODEL);

    if (result.success) {
      // Salvar na memória!
      const codeId = codeMemory.rememberGeneratedCode(db, uid, state.codeGenState, result.code);
      memory.saveDB(db);
      
      state.codeGenState.stage = 'completed';
      return {
        reply: `✅ Código gerado com sucesso e salvo na minha memória! 🧠\n\n${result.code}`,
        code: result.code,
        codeId: codeId
      };
    } else {
      return {
        reply: `⚠️ Erro ao gerar código: ${result.error}\n\n${result.template || ''}`
      };
    }
  } catch (error) {
    return {
      reply: `❌ Erro: ${error.message}`
    };
  }
}

function generateReply(userId, message, style, externalDb) {
  const db = externalDb || (memory.loadDB ? memory.loadDB() : memory.loadUsers());
  const uid = userId || 'anon';
  const user = memory.getUser(db, uid);
  const state = memory.ensureState(user);
  const trimmed = String(message || '').trim();
  const lang = phrases.detectLang(trimmed);

  memory.remember(db, uid, trimmed);

  if (state.pendingLearnId && phrases.isNegative(trimmed)) {
    clearLearnState(user);
    memory.saveDB(db);
    return { reply: 'Ok, cancelei a adição de exemplos. O que aprendi antes continua salvo.' };
  }

  if (state.learnStage === 'awaiting_examples' && trimmed.includes('|')) {
    const examples = trimmed.split('|').map((s) => s.trim()).filter(Boolean);
    const item = memory.appendExamplesToKnowledge(state.pendingLearnId, examples);
    clearLearnState(user);
    memory.saveDB(db);
    if (!item) return { reply: 'Não achei o item que estava aprendendo — tente /learn de novo.' };
    return { reply: `Pronto! Adicionei ${examples.length} exemplo(s) em "${item.query}". Tudo salvo em disco — não some ao reiniciar.` };
  }

  if (state.pendingLearnId && state.learnStage === 'awaiting_examples_confirm' && phrases.isAffirmative(trimmed)) {
    state.learnStage = 'awaiting_examples';
    memory.saveDB(db);
    return { reply: 'Mande os exemplos na próxima mensagem, separados por "|" (ex.: verão é quente|uso protetor|praia).' };
  }

  if (state.pendingLearnId && state.learnStage === 'awaiting_examples_confirm' && phrases.isNegative(trimmed)) {
    clearLearnState(user);
    memory.saveDB(db);
    return { reply: 'Beleza — ficou só com o que já aprendi, sem exemplos extras.' };
  }

  if (/^\/learn\s+/i.test(trimmed)) {
    return handleLearnCommand(db, user, trimmed);
  }

  // Comandos de memória
  if (/^\/memoria$/i.test(trimmed) || /^\/memory$/i.test(trimmed)) {
    const stats = codeMemory.getLearningStats(db);
    memory.saveDB(db);
    return { 
      reply: codeMemory.formatStats(stats)
    };
  }

  if (/^\/codigos$/i.test(trimmed)) {
    const codes = codeMemory.findCodeByType(null);
    if (codes.length === 0) {
      return { 
        reply: '📭 Ainda não gerei nenhum código. Peça para eu criar um! Exemplo: "crie um jogo agar.io"'
      };
    }
    const list = codes.slice(0, 10).map((c, i) => {
      const summary = codeMemory.getCodeSummary(c);
      return `${i + 1}. 📝 ${summary.description}\n   💾 ${summary.language} (${summary.lines} linhas)`;
    }).join('\n\n');
    return { 
      reply: `🧠 Códigos na minha memória:\n\n${list}\n\n(Mostrando ${Math.min(10, codes.length)} de ${codes.length} códigos)`
    };
  }

  if (/^\/buscar\s+/i.test(trimmed)) {
    const query = trimmed.replace(/^\/buscar\s+/i, '').trim();
    const results = codeMemory.findSimilarCode(query);
    if (results.length === 0) {
      return { 
        reply: `❌ Não encontrei código similar a "${query}" na minha memória.`
      };
    }
    const best = results[0];
    const summary = codeMemory.getCodeSummary(best);
    return { 
      reply: `✅ Encontrei!\n\n📝 ${summary.description}\n💾 ${summary.language}\n\n${summary.preview}`
    };
  }

  // Comandos de histórico de sessão
  if (/^\/historico$/i.test(trimmed)) {
    const history = sessionMemory.getSessionHistory(db, uid, 15);
    if (history.length === 0) {
      return {
        reply: '📭 Nenhuma conversa registrada ainda. Comece falando algo!'
      };
    }
    const formatted = sessionMemory.formatHistoryForDisplay(history);
    return {
      reply: `📋 Últimas ${history.length} mensagens:\n\n${formatted}`
    };
  }

  if (/^\/relatorio$/i.test(trimmed)) {
    const report = sessionMemory.generateConversationReport(db, uid);
    memory.saveDB(db);
    return {
      reply: report
    };
  }

  if (/^\/exportar$/i.test(trimmed)) {
    const exported = sessionMemory.exportHistory(db, uid);
    memory.saveDB(db);
    return {
      reply: `📄 Histórico exportado:\n\n${exported.substring(0, 2000)}...\n\n(Use /relatorio para ver tudo)`
    };
  }

  if (/^\/limpar historico$/i.test(trimmed)) {
    sessionMemory.clearSessionHistory(db, uid);
    memory.saveDB(db);
    return {
      reply: '🗑️ Histórico da sessão foi limpo.'
    };
  }

  // Lidar com geração de código
  const codeGenReply = handleCodeGeneration(db, user, trimmed, state);
  if (codeGenReply) {
    // Se está gerando, aguarda conclusão
    if (state.codeGenState && state.codeGenState.stage === 'generating') {
      // Executar asincronamente (sem bloquear)
      completeCodeGeneration(db, state, uid).then((result) => {
        if (result) {
          memory.remember(db, uid, `[BOT_CODE] ${result.code || 'Geração completada'}`);
          memory.saveDB(db);
        }
      }).catch((e) => {
        console.error('Erro ao completar geração:', e);
      });
      return codeGenReply;
    }
    return codeGenReply;
  }

  if (programming.isProgrammingMessage(trimmed, state)) {
    const progOut = programming.handleProgrammingMessage(trimmed, state, style);
    if (progOut && progOut.reply) {
      state.lastBotPrompt = 'programming';
      if (progOut.problemId) state.lastTopic = progOut.problemId;
      memory.saveDB(db);
      return { reply: progOut.reply, sources: progOut.problemId ? ['programming:' + progOut.problemId] : ['programming'] };
    }
  }

  if (phrases.wantsSearch(trimmed)) {
    const topic = contextManager.getLastUserTopic(user) || state.lastTopic || trimmed;
    const hits = searchKnowledge(topic, 5);
    if (hits.length) return replyFromHits(hits, lang);
    return { reply: notFoundReply(lang, topic) };
  }

  if (phrases.isGreeting(trimmed)) {
    clearLearnState(user);
    memory.saveDB(db);
    return { reply: phrases.pickGreeting(lang) };
  }

  const context = contextManager.buildContext(user);
  const topicGuess = contextManager.getLastUserTopic(user);
  if (topicGuess && topicGuess !== trimmed) state.lastTopic = topicGuess;

  if (!programming.extractCode(trimmed)) {
    const hits = searchKnowledge(trimmed, 5);
    if (hits.length) {
      memory.saveDB(db);
      return replyFromHits(hits, lang);
    }
  }

  const isQuestion = /\?$/i.test(trimmed)
    || /^(o que é|o que são|o que quer dizer|como funciona|me conte mais sobre|fale sobre|what is|what are|define|defina)\b/i.test(phrases.normalizeText(trimmed));

  if (isQuestion) {
    const topic = contextManager.extractTopicFromText
      ? contextManager.extractTopicFromText(trimmed)
      : trimmed.replace(/^(me conte mais sobre|fale sobre|o que é|what is)\s+/i, '').replace(/\?+$/, '').trim();
    state.lastTopic = topic;
    const topicHits = searchKnowledge(topic || trimmed, 5);
    if (topicHits.length) return replyFromHits(topicHits, lang);
    state.lastBotPrompt = 'question_not_found';
    memory.saveDB(db);
    return { reply: notFoundReply(lang, topic || trimmed) };
  }

  if (phrases.isAffirmative(trimmed) && state.lastBotPrompt === 'question_not_found' && state.lastTopic) {
    return { reply: `Me ensine com: /learn ${state.lastTopic}=sua explicação aqui` };
  }

  if (/\b(continuar|e depois|aprofunde|aprofundar)\b/i.test(trimmed) || (phrases.isAffirmative(trimmed) && state.lastBotPrompt === 'offer_deepen')) {
    const topic = state.lastTopic || topicGuess;
    const topicHits = topic ? searchKnowledge(topic, 3) : [];
    if (topicHits.length) return replyFromHits(topicHits, lang);
    return {
      reply: topic
        ? `Sobre "${topic}": ainda tenho pouco material. Quer me ensinar com /learn ${topic}=...?`
        : 'Sobre o que estávamos falando — pode repetir a pergunta com mais detalhe?'
    };
  }

  if (vocab.shouldUseVocabFollowUp(trimmed)) {
    const vMatches = vocab.findVocabMatches(trimmed);
    if (vMatches.length) {
      const follow = vocab.pickFollowUp(vMatches[0], lang);
      state.lastBotPrompt = 'vocab_follow';
      state.lastTopic = vMatches[0];
      memory.saveDB(db);
      return { reply: follow };
    }
  }

  state.lastBotPrompt = 'unknown';
  memory.saveDB(db);
  return { reply: notFoundReply(lang, trimmed.length <= 40 ? trimmed : '') };
}

module.exports = { generateReply };
