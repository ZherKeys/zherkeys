/**
 * Sistema de Histórico de Conversa (Session Memory)
 * Guarda o histórico completo de cada usuário em sua sessão
 */

const memory = require('./memoryManager');

const HISTORY_MAX_MESSAGES = 100; // Últimas 100 mensagens por sessão

/**
 * Adiciona mensagem ao histórico da sessão
 */
function addMessageToHistory(db, userId, role, message, metadata = {}) {
  const user = memory.getUser(db, userId);
  
  // Inicializar histórico se não existir
  if (!user.sessionHistory) {
    user.sessionHistory = [];
  }
  
  // Adicionar nova mensagem
  const historyItem = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    role: role, // 'user' ou 'bot'
    message: String(message || '').substring(0, 5000), // Limite de caracteres
    metadata: metadata // Contexto adicional
  };
  
  user.sessionHistory.push(historyItem);
  
  // Manter apenas últimas N mensagens
  if (user.sessionHistory.length > HISTORY_MAX_MESSAGES) {
    user.sessionHistory = user.sessionHistory.slice(-HISTORY_MAX_MESSAGES);
  }
  
  return historyItem;
}

/**
 * Obtém histórico da sessão
 */
function getSessionHistory(db, userId, limit = 20) {
  const user = memory.getUser(db, userId);
  
  if (!user.sessionHistory) {
    return [];
  }
  
  // Retornar últimas N mensagens
  return user.sessionHistory.slice(-limit);
}

/**
 * Formata histórico para exibição legível
 */
function formatHistoryForDisplay(history) {
  return history.map((msg) => {
    const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR');
    const role = msg.role === 'user' ? '👤 Você' : '🤖 Bot';
    return `[${time}] ${role}: ${msg.message.substring(0, 100)}${msg.message.length > 100 ? '...' : ''}`;
  }).join('\n');
}

/**
 * Formata histórico para contexto de IA
 */
function formatHistoryForContext(history, limit = 10) {
  const recent = history.slice(-limit);
  return recent.map((msg) => {
    const role = msg.role === 'user' ? 'Usuário' : 'Bot';
    return `${role}: ${msg.message}`;
  }).join('\n');
}

/**
 * Retorna resumo da conversa
 */
function getConversationSummary(db, userId) {
  const user = memory.getUser(db, userId);
  
  if (!user.sessionHistory || user.sessionHistory.length === 0) {
    return {
      totalMessages: 0,
      userMessages: 0,
      botMessages: 0,
      topics: [],
      duration: 0
    };
  }
  
  const history = user.sessionHistory;
  const userMsgs = history.filter(m => m.role === 'user');
  const botMsgs = history.filter(m => m.role === 'bot');
  
  // Detectar tópicos principais
  const topics = new Set();
  for (const msg of history) {
    if (msg.metadata && msg.metadata.type) {
      topics.add(msg.metadata.type);
    }
  }
  
  // Calcular duração
  const firstMsg = history[0];
  const lastMsg = history[history.length - 1];
  const duration = lastMsg.timestamp - firstMsg.timestamp;
  
  return {
    totalMessages: history.length,
    userMessages: userMsgs.length,
    botMessages: botMsgs.length,
    topics: Array.from(topics),
    duration: duration,
    startedAt: firstMsg.timestamp,
    endedAt: lastMsg.timestamp
  };
}

/**
 * Gera relatório de conversa
 */
function generateConversationReport(db, userId) {
  const summary = getConversationSummary(db, userId);
  const history = getSessionHistory(db, userId, 100);
  
  const durationMinutes = Math.floor(summary.duration / 60000);
  const durationSeconds = Math.floor((summary.duration % 60000) / 1000);
  
  let report = `
📊 RELATÓRIO DE CONVERSA

📈 Estatísticas:
  • Total de mensagens: ${summary.totalMessages}
  • Mensagens suas: ${summary.userMessages}
  • Respostas do bot: ${summary.botMessages}
  • Duração: ${durationMinutes}m ${durationSeconds}s

🎯 Tópicos abordados:
${summary.topics.length > 0 ? 
  summary.topics.map(t => `  • ${t}`).join('\n') : 
  '  (nenhum tópico específico)'}

⏱️ Timeline:
  • Iniciado: ${new Date(summary.startedAt).toLocaleTimeString('pt-BR')}
  • Encerrado: ${new Date(summary.endedAt).toLocaleTimeString('pt-BR')}

📝 Últimas 10 mensagens:
${formatHistoryForDisplay(history.slice(-10))}
`;
  
  return report;
}

/**
 * Limpa histórico da sessão
 */
function clearSessionHistory(db, userId) {
  const user = memory.getUser(db, userId);
  user.sessionHistory = [];
  return true;
}

/**
 * Exporta histórico em formato texto
 */
function exportHistory(db, userId) {
  const history = getSessionHistory(db, userId, 1000);
  
  let exported = `Histórico de Conversa - ${new Date().toLocaleString('pt-BR')}\n`;
  exported += `Usuário: ${userId}\n`;
  exported += `Total de mensagens: ${history.length}\n\n`;
  exported += '─'.repeat(80) + '\n\n';
  
  for (const msg of history) {
    const time = new Date(msg.timestamp).toLocaleString('pt-BR');
    const role = msg.role === 'user' ? 'VOCÊ' : 'BOT';
    exported += `[${time}] ${role}:\n${msg.message}\n\n`;
  }
  
  return exported;
}

/**
 * Verifica se há contexto de conversa anterior
 */
function hasRecentContext(db, userId, minutesAgo = 30) {
  const user = memory.getUser(db, userId);
  
  if (!user.sessionHistory || user.sessionHistory.length === 0) {
    return false;
  }
  
  const lastMsg = user.sessionHistory[user.sessionHistory.length - 1];
  const timeDiff = Date.now() - lastMsg.timestamp;
  const minutesDiff = timeDiff / 60000;
  
  return minutesDiff <= minutesAgo;
}

/**
 * Recupera contexto para continuar conversa
 */
function getContextForContinuation(db, userId) {
  const history = getSessionHistory(db, userId, 5);
  
  if (history.length === 0) {
    return null;
  }
  
  const formatted = formatHistoryForContext(history);
  const summary = getConversationSummary(db, userId);
  
  return {
    recentContext: formatted,
    summary: summary,
    lastUserMessage: history.filter(m => m.role === 'user').pop(),
    lastBotResponse: history.filter(m => m.role === 'bot').pop()
  };
}

module.exports = {
  addMessageToHistory,
  getSessionHistory,
  formatHistoryForDisplay,
  formatHistoryForContext,
  getConversationSummary,
  generateConversationReport,
  clearSessionHistory,
  exportHistory,
  hasRecentContext,
  getContextForContinuation
};
