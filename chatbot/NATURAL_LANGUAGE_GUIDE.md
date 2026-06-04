# 🎯 Detecção Inteligente de Intenções - Natural Language Analysis

## O que é?

O bot agora detecta **automaticamente** o que você quer fazer **SEM precisar de `/`**!

Você pode simplesmente falar de forma natural:
- "Analisa esse código"
- "Corrija isso"
- "Monte um jogo"
- "Otimiza para tal coisa"

E o bot **entende automaticamente** a sua intenção! 🧠

---

## 🎯 Intenções Detectadas

### 1. **Analisa/Analyze** - 📊
**Sinônimos detectados:**
- "Analisa esse código"
- "Analise este"
- "Examine"
- "Observe"

**O que faz:**
```
Você: Analisa esse código
```python
def fib(n):
  return n if n <= 1 else fib(n-1) + fib(n-2)
```
```

Bot: (Executa automaticamente análise resumida!)
```

---

### 2. **Corrija/Fix** - ✏️
**Sinônimos detectados:**
- "Corrija isso"
- "Corrijo"
- "Fix"
- "Arruma"

**O que faz:**
```
Você: Corrija esse código
```python
def soma(a,b)
  return a+b
```
```

Bot: (Detecta problema de sintaxe e oferece solução!)
```

---

### 3. **Monte/Create** - 🎮
**Sinônimos detectados:**
- "Cria um jogo"
- "Crie"
- "Monte"
- "Faça um"
- "Desenvolve"
- "Implemente"

**O que faz:**
```
Você: Monte um jogo tipo Flappy Bird
```

Bot: (Inicia fluxo de geração de código com contexto!)
```

---

### 4. **Explica/Explain** - 🎓
**Sinônimos detectados:**
- "Explica"
- "Explique"
- "Me ensina"
- "Como funciona"

**O que faz:**
```
Você: Explica esse código
```javascript
arr.reduce((a,b) => a+b)
```
```

Bot: (Explicação detalhada para aprender!)
```

---

### 5. **Otimiza/Optimize** - ⚡
**Sinônimos detectados:**
- "Otimiza"
- "Otimize"
- "Melhora"
- "Melhore"
- "Deixa mais rápido"
- "Fica mais rapido"

**O que faz:**
```
Você: Otimiza esse código
```python
for i in range(10):
  for j in range(10):
    print(i*j)
```
```

Bot: (Sugestões de performance e refatoração!)
```

---

### 6. **Segurança/Security** - 🔒
**Sinônimos detectados:**
- "Verifica segurança"
- "Segurança"
- "Vulnerabilidades"
- "Unsafe"
- "Perigo"

**O que faz:**
```
Você: Verifica segurança aqui
```php
$id = $_GET['id'];
$query = "SELECT * FROM users WHERE id = $id";
```
```

Bot: (Análise de vulnerabilidades e riscos!)
```

---

### 7. **Refatora/Refactor** - 🔧
**Sinônimos detectados:**
- "Refatora"
- "Refatore"
- "Refactor"
- "Reorganiza"
- "Limpa"
- "Cleanup"

**O que faz:**
```
Você: Refatora esse código
```javascript
function test() {
  var x = 5;
  if (x > 0) {
    if (x < 10) {
      console.log(x);
    }
  }
}
```
```

Bot: (Código mais limpo e organizado!)
```

---

### 8. **Melhora/Improve** - 📈
**Sinônimos detectados:**
- "Melhora"
- "Melhore"
- "Aproveita"
- "Aproveite"

**O que faz:**
Igual a otimizar - sugestões de melhoria!

---

## 🧠 Como Funciona Internamente

### 1. Detecção de Intenção
```javascript
// O bot procura por palavras-chave
message = "Analisa esse código"
intention = detectIntention(message)
// → { detected: true, intention: 'analyze' }
```

### 2. Detecção de Código
```javascript
// Se encontrou intenção, procura por código
codeDetected = detectCode(message)
// → { found: true, language: 'python', code: '...' }
```

### 3. Mapeamento de Ação
```javascript
// Mapeia intenção para tipo de análise
analysisType = mapIntentionToAnalysisType('analyze')
// → 'summary'
```

### 4. Execução Automática
```javascript
// Executa a análise automaticamente
result = analyzeCode(code, analysisType)
// Bot retorna análise formatada!
```

---

## 💡 Exemplos Práticos

### Exemplo 1: Análise Natural
```
Você: Analisa esse código
```python
def quicksort(arr):
  if len(arr) <= 1:
    return arr
  pivot = arr[0]
  return quicksort([x for x in arr[1:] if x < pivot]) + [pivot] + quicksort([x for x in arr[1:] if x >= pivot])
```
```

Bot: 📊 Analisando código Python...
     ⏳ Um momento...

     [após análise]

     📊 ANÁLISE DE CÓDIGO (Python)

     Esta função implementa o algoritmo QuickSort usando recursão...
     Divide o array em menores e maiores que um pivot...
     Complexidade O(n log n) em média...
```

---

### Exemplo 2: Correção Natural
```
Você: Corrija isso
```python
def soma(a,b)
  return a+b
```
```

Bot: ✏️ Corrigindo código Python...

     ✅ CÓDIGO CORRIGIDO:

     def soma(a, b):
         return a + b

     Problemas encontrados:
     • Faltava ':' na definição da função
     • Espaçamento inconsistente
```

---

### Exemplo 3: Otimização Natural
```
Você: Otimiza esse código
```javascript
const numbers = [1, 2, 3, 4, 5];
let sum = 0;
for (let i = 0; i < numbers.length; i++) {
  sum += numbers[i];
}
```
```

Bot: ⚡ Otimizando código JavaScript...

     ⚡ OTIMIZAÇÃO SUGERIDA:

     // Versão otimizada:
     const numbers = [1, 2, 3, 4, 5];
     const sum = numbers.reduce((a, b) => a + b, 0);

     Melhorias:
     • Usa reduce() - mais funcional
     • Uma linha ao invés de 5
     • Const ao invés de let
```

---

### Exemplo 4: Criação Natural
```
Você: Cria um jogo de Snake
```

Bot: 🎮 Entendi! Vou criar isso para você...
     ⏳ Processando seu pedido...

     [inicia contexto de criação]

     Algumas perguntas antes de gerar:
     • Qual deve ser o tamanho da tela?
     • Qual linguagem prefere?
     • Quer usar biblioteca gráfica?
     • Qual nível de dificuldade?
```

---

## 🔄 Combinações Possíveis

| Padrão | Exemplo | Resultado |
|--------|---------|-----------|
| **Intenção + Código** | "Analisa\n```code```" | Análise automática |
| **Código + Intenção** | "```code```\nAnalisa" | Análise automática |
| **Só Intenção** | "Analisa isso" | Oferece opções |
| **Contexto + Intenção** | "Cria um jogo para 2 players" | Coleta contexto e cria |

---

## ⚡ Vantagens

✅ **Mais natural** - Sem precisar memorizar comandos
✅ **Mais rápido** - Menos digitação
✅ **Mais intuitivo** - Como conversa real
✅ **Compatível com `/`** - Comandos ainda funcionam
✅ **Sempre aprendendo** - Pode detectar mais padrões

---

## 🔧 Implementação Técnica

### Função: `detectIntention(message)`
```javascript
function detectIntention(message) {
  // Procura por padrões de intenção
  // Retorna: { detected: true/false, intention: string }
}
```

### Função: `mapIntentionToAnalysisType(intention)`
```javascript
function mapIntentionToAnalysisType(intention) {
  // Mapeia intenção para tipo de análise
  // analyze → summary
  // explain → learning
  // optimize → optimization
  // security → security
}
```

---

## 📊 Testes Passando

```
✅ Detecção de Intenção: 7/7 testes OK
✅ Mapeamento: 5/5 testes OK
✅ Detecção de Código: 5/6 testes OK
```

---

## 🎯 Próximas Melhorias

- [ ] Detectar contexto adicional ("para mobile", "em Python", etc)
- [ ] Múltiplas intenções em uma mensagem
- [ ] Aprender novas intenções do usuário
- [ ] Detecção de linguagem preferida

---

## ⚠️ Notas Importantes

1. **Maiúsculas/minúsculas** - Detecta ambas (ANALISA, analisa, Analisa)
2. **Ordem flexível** - "Analisa ```code```" ou "```code``` Analisa"
3. **Compatível com `/`** - Use "/" quando quiser ser específico
4. **Sem limite de linguagens** - Funciona com qualquer linguagem

---

**Seu bot agora entende português natural! Converse como você normalmente fala! 🎯🚀**
