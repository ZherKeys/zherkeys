# 📋 Histórico de Conversa - Session Memory

## O que Mudou?

Agora seu bot **grava TUDO** que você conversa:

- ✅ Cada mensagem sua é salva
- ✅ Cada resposta do bot é gravada
- ✅ Timestamps completos
- ✅ Histórico disponível para consulta
- ✅ Relatórios de conversa
- ✅ Exportar conversa em texto

---

## 🎯 Comandos de Histórico

### `/historico` - Ver últimas mensagens

Mostra as últimas 15 mensagens:

```
Você: /historico

Bot: 📋 Últimas 15 mensagens:

[23:30:45] VOCÊ: faça um jogo
[23:30:47] BOT: ❓ Qual o nível de complexidade?
[23:30:52] VOCÊ: avançado
[23:30:54] BOT: ❓ Quais features principais?
[23:31:00] VOCÊ: multiplayer
...
```

### `/relatorio` - Relatório completo

Gera um relatório detalhado da conversa:

```
Você: /relatorio

Bot: 📊 RELATÓRIO DE CONVERSA

📈 Estatísticas:
  • Total de mensagens: 28
  • Mensagens suas: 14
  • Respostas do bot: 14
  • Duração: 5m 23s

🎯 Tópicos abordados:
  • game
  • code_generation

⏱️ Timeline:
  • Iniciado: 23:25:30
  • Encerrado: 23:30:53

📝 Últimas 10 mensagens:
...
```

### `/exportar` - Exportar conversa

Exporta toda a conversa em formato texto:

```
Você: /exportar

Bot: 📄 Histórico exportado:

Histórico de Conversa - 03/06/2026 23:35:22
Usuário: user123
Total de mensagens: 28

────────────────────────────────────────────────────

[03/06/2026 23:25:30] VOCÊ:
faça um jogo

[03/06/2026 23:25:32] BOT:
❓ Qual o nível de complexidade? (simples, médio, avançado)
...
```

### `/limpar historico` - Apagar histórico

Remove o histórico da sessão atual:

```
Você: /limpar historico

Bot: 🗑️ Histórico da sessão foi limpo.
```

---

## 📊 Exemplo de Fluxo Completo

```
Você: oi
[Salvo: Você disse "oi" às 23:25:15]

Bot: Olá! Posso explicar programação...
[Salvo: Bot respondeu às 23:25:16]

Você: faça um jogo
[Salvo: Você pediu jogo às 23:25:30]

Bot: ❓ Qual o nível de complexidade?
[Salvo: Bot fez pergunta às 23:25:31]

... (continua gravando tudo)

Você: /historico
[Retorna todas as mensagens gravadas]

Bot: 📋 Últimas 15 mensagens: [lista completa]
```

---

## 💾 Onde é Salvo?

Tudo é armazenado em `memory/users.json`:

```json
{
  "users": {
    "user123": {
      "state": { ... },
      "sessionHistory": [
        {
          "id": "msg-1686234567890-abc123",
          "timestamp": 1686234567890,
          "role": "user",
          "message": "faça um jogo",
          "metadata": { "style": null }
        },
        {
          "id": "msg-1686234569201-def456",
          "timestamp": 1686234569201,
          "role": "bot",
          "message": "❓ Qual o nível de complexidade?",
          "metadata": { "sources": [] }
        }
      ]
    }
  }
}
```

---

## 📈 Estrutura de Cada Mensagem

```javascript
{
  id: "msg-{timestamp}-{hash}",     // ID único
  timestamp: 1686234567890,          // Quando foi enviada
  role: "user" | "bot",              // Quem enviou
  message: "texto da mensagem",      // Conteúdo
  metadata: { ... }                  // Contexto adicional
}
```

---

## 🎯 Casos de Uso

### 1. Retomar Conversa
```
Você: Qual era aquele tópico que estava pedindo?
Bot: [Consulta histórico] Você pediu um jogo com multiplayer!
```

### 2. Ver o Que Aprendeu
```
Você: /relatorio
→ Vê quantos códigos gerou, que tipos, duração total
```

### 3. Documentar Sessão
```
Você: /exportar
→ Copia o histórico para guardar/compartilhar
```

### 4. Auditar Decisões
```
Você: /historico
→ Vê exatamente quando pediu o quê e como o bot respondeu
```

---

## 🔒 Privacidade

- ✅ Histórico fica **no seu PC**
- ✅ Não é enviado para internet
- ✅ Você pode limpar a qualquer hora (`/limpar historico`)
- ✅ Ninguém mais vê (arquivo local)

---

## 📊 Combinação com Memória Anterior

### Session Memory (Novo)
- **O que é:** Histórico de mensagens da conversa atual
- **Onde fica:** `memory/users.json` → `sessionHistory[]`
- **Duração:** Até você limpar ou quantidade máxima
- **Comandos:** `/historico`, `/relatorio`, `/exportar`

### Code Memory
- **O que é:** Códigos gerados com sucesso
- **Onde fica:** `data/zhertalk_knowledge.json`
- **Duração:** Permanente
- **Comandos:** `/memoria`, `/codigos`, `/buscar`

### Knowledge Memory  
- **O que é:** Conceitos aprendidos com `/learn`
- **Onde fica:** `data/zhertalk_knowledge.json`
- **Duração:** Permanente
- **Comandos:** `/learn`

---

## 🧪 Teste Completo

```powershell
# 1. Iniciar bot
cd chatbot
npm start

# 2. Em outro PowerShell, testar
curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d '{"userId":"teste","message":"oi"}'

# 3. Fazer várias requisições
curl http://localhost:3001/api/chat -X POST `
  -d '{"userId":"teste","message":"faça um jogo"}'

curl http://localhost:3001/api/chat -X POST `
  -d '{"userId":"teste","message":"/historico"}'

# Deve retornar o histórico!
```

---

## 📝 Exemplos Reais

### Exemplo 1: Tracking de Progresso
```
16:00 - Você: "quero aprender arrays"
16:05 - Bot: [explicação de arrays]
16:10 - Você: "crie um problema sobre arrays"
16:12 - Bot: [problema criado]
16:15 - Você: "/relatorio"
Bot: Total de 8 mensagens, duração 15 minutos
     Tópico principal: arrays
```

### Exemplo 2: Retomar Depois
```
Sessão 1:
- 10:00 Você: "preciso aprender recursão"
- 10:05 Bot: [explicação de recursão]

Sessão 2 (horas depois):
- 15:00 Você: "/historico"
- Bot: [mostra que você estava estudando recursão]
```

### Exemplo 3: Documentação Automática
```
Você: "gerei um jogo incrível"
Você: "/exportar"
→ Salva em arquivo .txt
→ Você pode compartilhar o histórico completo!
```

---

## 🚀 Próximas Melhorias

- [ ] Pesquisar no histórico (`/buscar mensagem`)
- [ ] Exportar em diferentes formatos (JSON, PDF, Markdown)
- [ ] Compartilhar histórico com outros usuários
- [ ] Análise de tendências automática
- [ ] Resumo automático de cada sessão

---

## ✨ Benefícios

✅ **Rastreabilidade** - Veja tudo que foi dito
✅ **Continuidade** - Retome conversas anteriores
✅ **Documentação** - Exporte para referência
✅ **Auditoria** - Saiba exatamente como chegou onde chegou
✅ **Privacidade** - Tudo fica no seu PC
✅ **Sem Limite** - Guarda até 100 mensagens por sessão

---

**Seu bot agora tem memória completa de cada conversa! 📋🧠**
