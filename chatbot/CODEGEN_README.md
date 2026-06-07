# 🤖 Chatbot ZherKeys com IA - Documentação

## Visão Geral

O chatbot agora foi melhorado para:
- ✅ Gerar código automaticamente baseado em requisições
- ✅ Fazer perguntas de contexto antes de gerar
- ✅ **Aprender e memorizar todos os códigos gerados** 🧠
- ✅ Funcionar 100% offline com Ollama (sem custos!)
- ✅ Suportar vários tipos de projetos (games, web, APIs, scripts, componentes)

---

## 🚀 Setup Rápido

### 1️⃣ Instalar Ollama
https://ollama.ai

### 2️⃣ Baixar um modelo
```powershell
ollama pull mistral
```

Modelos disponíveis:
- **mistral** (Recomendado) - Bom custo-benefício
- **neural-chat** - Otimizado para chat
- **codellama** - Especializado em código
- **dolphin-mixtral** - Mais poderoso

### 3️⃣ Iniciar Ollama
Em um terminal:
```powershell
ollama serve
```

Deixe rodando! Ollama estará em `http://localhost:11434`

### 4️⃣ Iniciar o servidor do chatbot
Em outro terminal:
```powershell
cd chatbot
npm install
npm start
```

Será iniciado em `http://localhost:3001`

---

## 📝 Como Usar

### Requisições Simples - Sistema faz perguntas!

**Exemplo 1: Criar um jogo**
```
Você: "Crie um jogo tipo Agar.io em JavaScript"
Bot: "❓ Qual linguagem? (JavaScript, Python, C#, etc)"
Você: "JavaScript"
Bot: "❓ Qual o nível de complexidade? (simples, médio, avançado)"
Você: "médio"
Bot: "❓ Quais features principais? (ex: multiplayer, physics, etc)"
Você: "multiplayer, physics básica"
Bot: "❓ Quer usar algum framework?"
Você: "Phaser.js"
Bot: "✨ Perfeito! Vou gerar o código agora..."
Bot: "✅ Código gerado com sucesso! [CÓDIGO AQUI]"
```

**Exemplo 2: Criar uma API**
```
Você: "Faça uma API REST em Python"
Bot: "❓ Qual linguagem? (Node.js, Python, Java, C#, etc)"
Você: "Python"
Bot: "❓ Qual banco de dados? (MongoDB, PostgreSQL, MySQL, etc)"
Você: "PostgreSQL"
... (continua coletando contexto)
Bot: "✅ Código gerado!"
```

**Exemplo 3: Criar um site**
```
Você: "Crie um site de portfólio"
Bot: "❓ Qual linguagem? (HTML/CSS/JS, React, Vue, etc)"
Você: "React"
... (coleta mais informações)
Bot: "✅ Código do site pronto!"
```

### Tipos Suportados

1. **Game** - Jogos, aplicações interativas
   - Detecta: "jogo", "game", "games"
   - Perguntas: linguagem, complexidade, features, framework

2. **Web** - Websites, aplicações web, interfaces
   - Detecta: "site", "website", "página", "app", "interface"
   - Perguntas: tecnologia, features, estilo, responsividade

3. **API** - Servidores, backends, APIs REST
   - Detecta: "api", "endpoint", "backend", "servidor"
   - Perguntas: linguagem, banco de dados, features, escala

4. **Script** - Automações, utilitários
   - Detecta: "script", "automação", "tool", "ferramenta"
   - Perguntas: linguagem, propósito, entrada, saída

5. **Component** - Componentes, módulos, funções
   - Detecta: "componente", "função", "módulo", "widget"
   - Perguntas: linguagem, framework, funcionalidade, dependências

---

## 🧪 Testar

```powershell
cd chatbot
node test_code_generation.js
```

Isso vai fazer várias requisições de teste e mostrar as respostas.

---

## 📁 Arquivos Novos

| Arquivo | Função |
|---------|--------|
| `core/codeGenerator.js` | Detecta requisições e faz perguntas |
| `core/ollamaIntegration.js` | Integra com Ollama local |
| `test_code_generation.js` | Script de teste |

---

## ⚙️ Configuração

### Mudar o modelo Ollama

Em `core/ollamaIntegration.js`:
```javascript
const DEFAULT_MODEL = 'codellama'; // Mude aqui
```

### Mudar a porta do Ollama

Em `core/ollamaIntegration.js`:
```javascript
const OLLAMA_URL = 'http://localhost:11434'; // Mude aqui
```

### Mudar a porta do servidor

Em `chatbot/server.js` ou onde você inicia o servidor:
```javascript
const PORT = 3001; // Mude aqui
```

---

## 🧠 Sistema de Memória

Seu bot agora **aprende e memoriza**!

- Cada código gerado é salvo automaticamente
- Bot sugere código anterior se detectar requisição similar
- Você pode listar, buscar e ver estatísticas

### Comandos de Memória

```
/memoria        → Ver estatísticas de aprendizado
/codigos        → Listar todos os códigos aprendidos
/buscar [termo] → Buscar código por descrição
```

**Exemplo:**
```
Você: "Crie um jogo agar.io"
Bot: "🧠 Lembrei! Tenho um game similar na memória! Quer usar?"
Você: "Não"
Bot: "Certo! Gero um novo..." → Salva novo código na memória! 🧠
```

👉 Veja [MEMORY_GUIDE.md](MEMORY_GUIDE.md) para guia completo

---

### "Ollama desconectado"
- Certifique-se de que `ollama serve` está rodando em outro terminal
- Verifique se está em `http://localhost:11434`

### "Modelo não encontrado"
```powershell
ollama pull mistral
```

### Resposta vazia
- Tente novamente - Ollama pode estar processando
- Verifique se o modelo foi baixado: `ollama list`

### Servidor não inicia
```powershell
# Limpe node_modules
rm -r chatbot/node_modules
# Reinstale
npm install
npm start
```

---

## 📊 Performance

- **Primeira requisição**: ~10-30 segundos (Ollama carrega o modelo)
- **Requisições subsequentes**: ~5-10 segundos
- **Sem limite de requisições**: Rode quantas quiser!

Tempo varia conforme:
- Complexidade do código a gerar
- Especificações do computador
- Tamanho do modelo (Mistral < CodeLLaMA)

---

## 🎯 Exemplos Reais

### Criar um jogo Agar.io
```
"Crie um jogo agar.io em javascript"
→ Pergunta tecnologia, complexidade, features, framework
→ Gera código funcional
```

### Criar API de blog
```
"Faça uma API para um blog em python"
→ Pergunta linguagem, banco, features, escala
→ Gera estrutura completa com endpoints
```

### Criar site responsivo
```
"Crie um site de e-commerce"
→ Pergunta tecnologia, features, estilo
→ Gera HTML/CSS/JS pronto
```

---

## 🔐 Privacidade

Tudo roda **localmente** no seu PC:
- ✅ Nada é enviado para a internet
- ✅ Sem custos
- ✅ Seus dados são seus
- ✅ Pode desconectar do WiFi e continua funcionando

---

## 📞 Suporte

Se tiver problemas:
1. Verifique se Ollama está rodando
2. Verifique a porta (11434 por padrão)
3. Tente com outro modelo: `ollama pull dolphin-mixtral`
4. Verifique os logs do servidor

---

**Aproveite! 🚀 Seu chatbot agora pode gerar qualquer código que você quiser!**
