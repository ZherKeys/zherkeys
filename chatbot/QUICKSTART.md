# 🧠 Bot ZherKeys - Sistema Completo de IA + Memória

## ✨ O que foi Implementado

### 1️⃣ Geração de Código com IA (Ollama)
- **Suporte completo** para gerar qualquer tipo de código
- **Coleta inteligente de contexto** com perguntas antes de gerar
- **5 tipos** de projetos (games, web, APIs, scripts, componentes)
- **100% local e gratuito** com Ollama

### 2️⃣ Sistema de Memória
- **Salva automaticamente** cada código gerado
- **Detecta requisições similares** e sugere reutilização
- **Comandos de memória** para gerenciar aprendizado
- **Persistência em disco** - sobrevive restarts

---

## 🚀 Como Usar

### Passo 1: Iniciar Ollama
Em um PowerShell:
```powershell
ollama serve
```
Deixe rodando! Vai ficar em `localhost:11434`

### Passo 2: Iniciar o Chatbot
Em outro PowerShell:
```powershell
cd chatbot
npm start
```

### Passo 3: Conversar com o Bot!

**Via API (HTTP):**
```powershell
# Requisição
curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d '{"userId":"user1","message":"crie um jogo agar.io"}'
```

**Ou via teste:**
```powershell
cd chatbot
node test_memory.js
```

---

## 📋 Exemplos Reais

### Exemplo 1: Gerar um Jogo
```
Você: "Crie um jogo flappy bird em JavaScript"

Bot: 🧠 Lembrei! Tenho um game similar na minha memória!
     📝 game: flappy bird clone
     💾 JavaScript (1500 linhas)
     Quer usar o código anterior ou gerar um novo?

Você: "Não, gera um novo"

Bot: Certo! Vou gerar um novo JavaScript.
     ❓ Qual o nível de complexidade? (simples, médio, avançado)

Você: "médio"

Bot: ❓ Quais features principais? (ex: sons, leaderboard, etc)

Você: "sons, efeitos visuais"

Bot: ❓ Quer usar algum framework?

Você: "Phaser.js"

Bot: ✨ Perfeito! Vou gerar o código agora...
     ⏳ Isso pode levar alguns segundos...
     (Vou salvar na minha memória para usar depois! 🧠)

Bot: ✅ Código gerado com sucesso e salvo na minha memória! 🧠
     [CÓDIGO AQUI - 2000 linhas]
```

### Exemplo 2: Usar Memória
```
Você: /memoria

Bot: 📊 ESTATÍSTICAS DE APRENDIZADO DO BOT

    Total de Códigos Memorizados: 3

    Por Tipo:
      • game: 2
      • api: 1

    Por Linguagem:
      • JavaScript: 2
      • Python: 1

    O seu bot aprendeu muito! 🤖
```

### Exemplo 3: Buscar Código
```
Você: /buscar javascript

Bot: ✅ Encontrei!

    📝 game: flappy bird clone
    💾 JavaScript

    function update() {
      // ... código aqui
    }
```

---

## 🎮 Tipos Suportados

| Tipo | Exemplo de Requisição | Contexto Coletado |
|------|----------------------|------------------|
| **Game** | "Crie um jogo tipo..." | Linguagem, complexidade, features, framework |
| **Web** | "Faça um site de..." | Tecnologia, features, estilo, responsivo |
| **API** | "Implemente uma API..." | Linguagem, banco, features, escala |
| **Script** | "Automatize isso..." | Linguagem, propósito, entrada, saída |
| **Component** | "Crie um módulo..." | Linguagem, framework, funcionalidade, deps |

---

## 🧠 Comandos de Memória

### `/memoria`
Mostra estatísticas de aprendizado:
```
- Total de códigos
- Distribuição por tipo
- Distribuição por linguagem
```

### `/codigos`
Lista últimos 10 códigos gerados:
```
1. 📝 game: agar.io multiplayer
   💾 JavaScript (2453 linhas)

2. 📝 api: blog rest api
   💾 Python (1200 linhas)
```

### `/buscar [termo]`
Busca código por descrição:
```
/buscar multiplayer
→ Encontra código com "multiplayer" na descrição
```

---

## 📊 Como Funciona a Memória

### Salvamento Automático
1. Código é gerado com sucesso
2. Bot detecta o tipo, descrição e contexto
3. Salva em `data/zhertalk_knowledge.json`
4. Inclui timestamp, linguagem, features, etc

### Detecção de Similar
1. Nova requisição é feita (ex: "faça um jogo agar.io")
2. Bot busca na memória por similar
3. Se encontrar, oferece usar código anterior
4. Usuário diz "sim" (reutiliza) ou "não" (gera novo)

### Índice Eficiente
- Busca por descrição
- Busca por tipo
- Busca por linguagem
- Busca por features

---

## 📁 Arquivos Novos

```
chatbot/
├── core/
│   ├── codeGenerator.js      ← Geração com contexto
│   ├── ollamaIntegration.js  ← Integração Ollama
│   ├── codeMemory.js         ← Sistema de memória ⭐ NOVO
│   └── brain.js              ← Modificado
├── CODEGEN_README.md         ← Guia de geração
├── MEMORY_GUIDE.md           ← Guia de memória ⭐ NOVO
├── test_code_generation.js   ← Teste de geração
└── test_memory.js            ← Teste de memória ⭐ NOVO
```

---

## ⚙️ Configuração

### Mudar Modelo Ollama
Em `core/ollamaIntegration.js`:
```javascript
const DEFAULT_MODEL = 'codellama'; // ou 'neural-chat', 'dolphin-mixtral'
```

### Mudar Porta Ollama
```javascript
const OLLAMA_URL = 'http://localhost:11434'; // Mude aqui
```

---

## 🧪 Rodar Testes

### Teste Completo de Memória
```powershell
cd chatbot
node test_memory.js
```

Isso vai:
1. Gerar um código
2. Responder as perguntas
3. Gerar outro similar (mostra memória)
4. Ver estatísticas
5. Listar códigos

---

## 💡 Casos de Uso

### 1. Portfolio de Projetos
```
"Crie todos os projetos que já fiz"
/codigos
→ Vê histórico completo
```

### 2. Reaproveitamento de Código
```
"Preciso de um jogo tipo Flappy Bird"
Bot oferece similar
"Sim" → Usa código anterior instantaneamente!
```

### 3. Análise de Tendências
```
/memoria
→ Vê que fez mais games que APIs
→ Começa a fazer mais APIs para balancear
```

### 4. Busca Rápida
```
/buscar multiplayer
→ Encontra todos os projetos com "multiplayer"
```

---

## 🎯 Fluxo Ideal

```
1. Faça requisição
   "Crie um X"
        ↓
2. Bot coleta contexto
   "Qual linguagem?" × 4 perguntas
        ↓
3. Bot gera com Ollama
   ⏳ 5-10 segundos
        ↓
4. Salva na memória automaticamente
   🧠 Agora está "aprendido"
        ↓
5. Próxima requisição similar
   Bot oferece usar anterior!
   ou gerar novo (também salva)
        ↓
6. Você gerencia com /memoria, /codigos, /buscar
```

---

## 📈 Performance

| Operação | Tempo |
|----------|-------|
| Primeira requisição | 10-30s |
| Gerações seguintes | 5-10s |
| Reutilizar código (memória) | < 1s |
| Listar memória | < 1s |
| Buscar código | < 1s |

---

## 🔐 Segurança & Privacidade

✅ **100% Local** - Tudo no seu PC
✅ **Sem Internet** - Roda offline
✅ **Sem Custos** - Ollama é gratuito
✅ **Seus Dados** - Nada é enviado
✅ **Persistente** - Backup em `data/zhertalk_knowledge.json`

---

## 🚨 Troubleshooting

### "Ollama desconectado"
```powershell
ollama serve
# Em outro terminal
ollama list  # Vê modelos instalados
```

### "Modelo não encontrado"
```powershell
ollama pull mistral
# ou outro modelo
ollama pull neural-chat
```

### Bot não responde
- Verifique se Ollama está rodando
- Verifique porta 11434
- Verifique logs do servidor

---

## 🎓 Próximas Ideias

- [ ] Interface web para gerenciar memória
- [ ] Compartilhar memória entre usuários
- [ ] Editar código memorizado
- [ ] Exportar/importar memória
- [ ] Categorias customizadas
- [ ] Versioning de código

---

## 🎉 Pronto!

Seu bot agora é:
- ✅ **Inteligente** - Gera código com IA
- ✅ **Contextual** - Faz perguntas antes de gerar
- ✅ **Aprendiz** - Memoriza tudo
- ✅ **Eficiente** - Reutiliza código anterior
- ✅ **Privado** - 100% local
- ✅ **Gratuito** - Sem custos! 

**Comece a criar! 🚀**
