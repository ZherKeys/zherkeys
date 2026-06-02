function buildContext(user) {
  const recent = (user && user.memory && user.memory.short_term)
    ? user.memory.short_term.map(m => m.text).join("\n")
    : '';

  const summary = (user && user.memory && user.memory.summaries)
    ? user.memory.summaries.slice(-3).join("\n")
    : '';

  const profile = `\nNome: ${user && user.profile && user.profile.name ? user.profile.name : "desconhecido"}\nEstilo: ${user && user.profile && user.profile.style ? user.profile.style : "casual"}\nInteresses: ${(user && user.profile && user.profile.interests) ? user.profile.interests.join(", ") : ""}\n`;

  return `\n[PERFIL]\n${profile}\n[RESUMO]\n${summary}\n\n[RECENTE]\n${recent}\n`;
}

module.exports = { buildContext };
