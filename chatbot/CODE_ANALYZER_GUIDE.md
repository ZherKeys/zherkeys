# 📊 Analisador de Código - Code Analyzer

## O que é?

Um sistema **inteligente de análise de código** que:

- ✅ Detecta código automaticamente
- ✅ Resume o que o código faz
- ✅ Explica detalhadamente
- ✅ Sugere otimizações
- ✅ Analisa segurança
- ✅ Suporta qualquer linguagem!

---

## 🚀 Como Usar

### Detectar Automaticamente

Simplesmente **envie um bloco de código** e o bot detecta:

```
Você: ```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
```

Bot: 📊 Detectei código em Python!

💡 Sugestões:
⚠️ Código muito longo - considere dividir em funções

Use:
• /resumir — Resumo breve
• /explicar — Explicação detalhada
• /otimizar — Melhorias de performance
• /seguranca — Análise de segurança
```

---

## 📋 Comandos de Análise

### `/resumir` - Resumo Rápido
**Resumo breve do que o código faz**

```
Você: ```javascript
function findMax(arr) {
  return arr.reduce((a, b) => a > b ? a : b);
}
```

Depois: /resumir

Bot: 📝 ANÁLISE DE CÓDIGO (JavaScript)

Esta função encontra o valor máximo em um array usando o método reduce().
O método reduce() itera sobre cada elemento do array, comparando o valor
acumulado com o elemento atual e mantendo sempre o maior.

A função é útil para encontrar o maior número em uma lista sem usar loops
tradicionais ou a função Math.max().

Entrada: array de números. Saída: número (máximo valor).
```

### `/explicar` - Explicação Detalhada
**Para aprender e entender bem o código**

```
Você: [envie código]
Depois: /explicar

Bot: 🎓 ANÁLISE DE CÓDIGO (Python)

Propósito geral: Esta função implementa o algoritmo Fibonacci usando recursão...
Funções/métodos principais: A função factorial chama a si mesma...
Fluxo de execução: ...
Entradas e saídas: A função recebe um inteiro n...
```

### `/otimizar` - Sugestões de Performance
**Identifique gargalos e melhorias**

```
Você: [envie código]
Depois: /otimizar

Bot: ⚡ ANÁLISE DE CÓDIGO (Python)

Problemas de performance:
• Recursão sem memoização - O(2^n)
• Recalcula mesmos valores repetidamente

Melhorias possíveis:
• Use memoização (decorador @lru_cache)
• Implemente versão iterativa - O(n)
• Use programação dinâmica

Complexidade atual: Tempo O(2^n), Espaço O(n)
```

### `/seguranca` - Análise de Segurança
**Encontre vulnerabilidades**

```
Você: ```php
$user_id = $_GET['id'];
$query = "SELECT * FROM users WHERE id = $user_id";
```

Depois: /seguranca

Bot: 🔒 ANÁLISE DE CÓDIGO (PHP)

Vulnerabilidades encontradas:
❌ SQL Injection - Entrada não sanitizada
❌ $_GET não validado diretamente em query
❌ Sem prepared statements

Recomendações:
✅ Use prepared statements com placeholders
✅ Valide e sanitize inputs
✅ Use ORM (Eloquent, Doctrine)
```

### `/analisar` - Análise Geral
**Resumo automático com contexto**

```
Você: /analisar ```javascript
const x = 5;
console.log(x);
```

Bot: 📊 Analisando código JavaScript...
⏳ Isso pode levar alguns segundos...

Bot: 📊 ANÁLISE DE CÓDIGO (JavaScript)
...análise completa...
```

---

## 🧠 Detecção Automática

O bot detecta automaticamente código nos formatos:

### 1. Bloco com ```
```javascript
// Detecta automaticamente
const x = 5;
console.log(x);
```

### 2. Código inline com indentação
```
if (x > 10)
  console.log('maior')
  return x
```

### 3. Estrutura de código reconhecível
```
def hello():
    print("oi")
    return True
```

---

## 🎯 Exemplos Reais

### Exemplo 1: Resumir Algoritmo
```
Você: ```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[0]
    left = [x for x in arr[1:] if x < pivot]
    right = [x for x in arr[1:] if x >= pivot]
    return quicksort(left) + [pivot] + quicksort(right)
```

Bot: [detecta automaticamente]

Você: /resumir

Bot: Implementa ordenação QuickSort usando pivot...
     Divide lista em menores/maiores que pivot...
     Combina recursivamente...
```

### Exemplo 2: Aprender
```
Você: ```javascript
const promise = new Promise((resolve, reject) => {
  setTimeout(() => resolve('done'), 1000);
});
```

Você: /explicar

Bot: 🎓 Uma Promise é uma estrutura para operações assincronas...
     Resolve quando sucesso, reject quando erro...
     setTimeout simula operação lenta...
```

### Exemplo 3: Otimizar
```
Você: ```python
for i in range(10):
    for j in range(10):
        if i*j > 50:
            print(i, j)
```

Você: /otimizar

Bot: ⚡ Loop duplo - complexidade O(n²)...
     Considere usar filter() ou numpy...
     Pode ser paralelizado...
```

---

## 🔬 Tecnologia por Trás

### Detecção de Código
Reconhece:
- Blocos ``` (qualquer linguagem)
- Estrutura de código Python, JS, Java, etc
- Padrões comuns (functions, classes, loops)

### Detecção de Linguagem
Identifica automaticamente:
- Python, JavaScript, Java, C++, C, PHP
- HTML/CSS, SQL, Go, Rust, e mais!
- Até desconhecidas (tenta mesmo assim!)

### Análise com IA
Usa Ollama para:
- Resumir de forma inteligente
- Explicar para iniciantes
- Sugerir otimizações
- Encontrar vulnerabilidades

---

## 💡 Sugestões Automáticas

O bot oferece dicas automáticas:

| Sugestão | Indica |
|----------|--------|
| ⚠️ Loop infinito | `while(true)` sem break |
| ⚠️ Eval() | Risco de segurança |
| ⚠️ Console.log em prod | Remove em produção |
| ⚠️ TODOs pendentes | Código incompleto |
| 💡 Código longo | Divida em funções |
| 💡 Muita indentação | Reduza complexidade |

---

## 📊 Formatos Suportados

### Linguagens Detectadas
- Python ✅
- JavaScript/Node.js ✅
- Java ✅
- C++ ✅
- C ✅
- PHP ✅
- HTML/CSS ✅
- SQL ✅
- Go ✅
- Rust ✅
- E muitas outras!

### Formatos de Entrada
- Bloco ``` (preferido)
- Texto indentado
- Inline com `code`
- Mesmo sem marcação (detecta estrutura)

---

## 🔄 Fluxo Completo

```
USUÁRIO ENVIA CÓDIGO
        ↓
BOT DETECTA AUTOMATICAMENTE
        ↓
BOT OFERECE OPÇÕES:
  • /resumir
  • /explicar
  • /otimizar
  • /seguranca
        ↓
USUÁRIO ESCOLHE TIPO DE ANÁLISE
        ↓
BOT ENVIA PARA OLLAMA
        ↓
ANÁLISE INTELIGENTE
        ↓
BOT RETORNA RESULTADO FORMATADO
        ↓
HISTÓRICO SALVO (/historico)
```

---

## ⚙️ Configuração

### Mudar Comportamento

Em `core/codeAnalyzer.js`:

```javascript
// Mudar timeout de análise
const ANALYSIS_TIMEOUT = 30000; // 30 segundos

// Mudar tamanho máximo de código
const MAX_CODE_LENGTH = 10000; // caracteres
```

---

## 🆚 Diferenças de Análise

| Tipo | Objetivo | Duração | Público |
|------|----------|---------|---------|
| **Summary** | Resumo rápido | 3-5s | Qualquer um |
| **Detailed** | Entender bem | 5-10s | Desenvolvedores |
| **Learning** | Aprender | 5-10s | Iniciantes |
| **Optimization** | Melhorar | 5-10s | Programadores |
| **Security** | Vulnerabilidades | 5-10s | Security |

---

## 🚀 Próximas Melhorias

- [ ] Comparação de códigos
- [ ] Refatoração automática
- [ ] Testes automáticos
- [ ] Documentação gerada
- [ ] Complexidade O(n) calculada

---

## ✨ Benefícios

✅ **Aprenda** - Entenda qualquer código
✅ **Melhore** - Sugestões de otimização
✅ **Seguro** - Encontre vulnerabilidades
✅ **Rápido** - Análise em segundos
✅ **Qualquer linguagem** - Sem limitações
✅ **Offline** - Tudo local com Ollama
✅ **Gratuito** - Zero custos

---

**Seu bot agora é um especialista em análise de código! 📊🚀**

Envie qualquer código e receba análise inteligente instantaneamente!
