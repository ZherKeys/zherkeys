# 🧠 Sistema de Memória - Bot ZherKeys

## O que Mudou?

Agora seu bot **aprende e memoriza** todo código gerado! 

- ✅ Cada código gerado é salvo automaticamente
- ✅ Bot sugere código anterior se detectar requisição similar
- ✅ Você pode listar todos os códigos aprendidos
- ✅ Buscar código por tipo ou descrição
- ✅ Ver estatísticas de aprendizado

---

## 🎯 Fluxo de Geração com Memória

### Exemplo: Gerar um jogo

```
Você: "Crie um jogo agar.io em JavaScript"
Bot: 🧠 Lembrei! Tenho um game similar na minha memória!
     📝 game: agar.io multiplayer
     💾 JavaScript (2453 linhas)
     Quer usar o código anterior ou gerar um novo?

Você: "não"
Bot: Certo! Vou gerar um novo JavaScript.
     ❓ Qual o nível de complexidade? (simples, médio, avançado)
... (coleta contexto)
Bot: ✨ Perfeito! Vou gerar o código agora...
     ⏳ Isso pode levar alguns segundos...
     (Vou salvar na minha memória para usar depois! 🧠)

Bot: ✅ Código gerado com sucesso e salvo na minha memória! 🧠
     [CÓDIGO AQUI]
```

---

## 📋 Comandos de Memória

### `/memoria` - Ver estatísticas
Mostra o que o bot aprendeu:

```
Você: /memoria

Bot: 📊 ESTATÍSTICAS DE APRENDIZADO DO BOT

    Total de Códigos Memorizados: 5

    Por Tipo:
      • game: 2
      • api: 2
      • web: 1

    Por Linguagem:
      • JavaScript: 3
      • Python: 2

    O seu bot aprendeu muito! 🤖
```

### `/codigos` - Listar todos os códigos
Lista os últimos 10 códigos gerados:

```
Você: /codigos

Bot: 🧠 Códigos na minha memória:

    1. 📝 game: agar.io multiplayer
       💾 JavaScript (2453 linhas)

    2. 📝 api: blog rest api
       💾 Python (1200 linhas)

    3. 📝 web: portfolio website
       💾 HTML/CSS/JS (850 linhas)

    (Mostrando 3 de 5 códigos)
```

### `/buscar [descrição]` - Buscar código
Procura por código similar:

```
Você: /buscar jogo multiplayer

Bot: ✅ Encontrei!

    📝 game: agar.io multiplayer
    💾 JavaScript

    function gameLoop() {
      updatePlayers();
      renderGame();
      ...
```

---

## 🧠 Como a Memória Funciona

### 1. Salvar Código
- Toda vez que um código é gerado **com sucesso**, é automaticamente salvo
- Inclui: tipo, descrição, linguagem, contexto, timestamp
- Tudo fica em `data/zhertalk_knowledge.json`

### 2. Detectar Similar
- Quando você faz uma nova requisição de código
- Bot busca por requisições similares na memória
- Se encontrar, oferece usar o código anterior

### 3. Índice
- Cada código é indexado por:
  - Tipo (game, web, api, script, component)
  - Descrição
  - Linguagem
  - Contexto (framework, features, etc)

### 4. Persistência
- Tudo é salvo em disco
- Surviva ao reiniciar o servidor
- Arquivo: `data/zhertalk_knowledge.json`

---

## 💾 Estrutura na Memória

Cada código memorizado tem:

```json
{
  "id": "CODE::game-1686234567890",
  "query": "game: agar.io multiplayer",
  "content": "// Código gerado aqui...",
  "tags": ["game", "javascript", "multiplayer"],
  "metadata": {
    "type": "game",
    "description": "agar.io multiplayer",
    "context": {
      "language": "javascript",
      "complexity": "médio",
      "features": "multiplayer, physics",
      "framework": "phaser.js"
    },
    "generatedAt": 1686234567890,
    "userId": "user123"
  },
  "created_at": 1686234567890
}
```

---

## 📊 Exemplos de Uso

### Cenário 1: Reutilizar código
```
Você: Preciso de um jogo agar.io
Bot: [Sugere código anterior]
Você: Sim, me dá esse
Bot: [Retorna código da memória - instantâneo!]
```

### Cenário 2: Aperfeiçoar
```
Você: Preciso de um jogo agar.io
Bot: [Sugere código anterior]
Você: Não, quero um novo
Bot: [Gera novo código, salva na memória]
```

### Cenário 3: Pesquisar
```
Você: /buscar multiplayer
Bot: [Procura todos os códigos com "multiplayer"]
Bot: [Mostra código similar encontrado]
```

### Cenário 4: Aprender
```
Você: /codigos
Bot: [Lista todos os 5 códigos aprendidos]
Você: [Vê tendências - muito JavaScript, poucos Python]
Você: Cria mais códigos em Python para balancear
```

---

## 📈 Benefícios

✅ **Rápido** - Reutiliza código anterior instantaneamente
✅ **Inteligente** - Sugere código anterior automaticamente
✅ **Histórico** - Veja tudo que aprendeu
✅ **Persistente** - Memória sobrevive restarts
✅ **Sem Custo** - Tudo local, sem servidor
✅ **Privado** - Seus códigos ficam no seu PC

---

## 🛠️ Troubleshooting

### "Não encontrei código similar"
- É a primeira geração desse tipo
- Ou a descrição é muito diferente
- Bot aprenderá com mais gerações!

### Memória muito grande?
- `data/zhertalk_knowledge.json` está grande?
- Sistema limita a 500 itens automaticamente
- Itens mais antigos são removidos

### Quero limpar a memória?
```powershell
# Deletar arquivo
rm data/zhertalk_knowledge.json

# Bot criará novo quando gerar código
```

---

## 🎓 Próximas Melhorias

- [ ] Editar código memorizado
- [ ] Remover código específico
- [ ] Exportar/importar memória
- [ ] Categorias customizadas
- [ ] Compartilhar memória entre usuários

---

**Seu bot agora é inteligente e tem memória! 🧠✨**

Quanto mais código gerar, mais inteligente fica!
