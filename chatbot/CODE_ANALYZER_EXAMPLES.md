# 🧪 Code Analyzer - Exemplos de Teste Completos

## 📋 Como Testar

### Pré-requisitos
```powershell
# Terminal 1: Ollama rodando
ollama serve

# Terminal 2: Chatbot rodando
cd chatbot
npm start

# Terminal 3: Testes (use os exemplos abaixo)
```

---

## 🐍 Teste 1: Python - Fibonacci Recursivo

### Código para Testar
```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

result = fibonacci(10)
print(result)
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

result = fibonacci(10)
print(result)
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Resposta Esperada
```
📊 Detectei código em Python!

💡 Sugestões:
⚠️ Recursão sem memoização - considere usar @lru_cache

Use:
• /resumir — Resumo breve
• /explicar — Explicação detalhada
• /otimizar — Melhorias de performance
• /seguranca — Análise de segurança
```

### Teste: /resumir
```powershell
$body = @{
    userId = "test_user"
    message = "/resumir"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Resposta Esperada
```
📝 ANÁLISE DE CÓDIGO (Python)

Esta função calcula números da sequência Fibonacci usando recursão pura.
A função retorna o enésimo número de Fibonacci, onde cada número é a soma
dos dois números anteriores (0, 1, 1, 2, 3, 5, 8, 13...).

Entrada: número inteiro n. Saída: enésimo número de Fibonacci.
A complexidade é exponencial O(2^n) - muito lenta para valores grandes.
```

### Teste: /otimizar
```powershell
$body = @{
    userId = "test_user"
    message = "/otimizar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Resposta Esperada
```
⚡ ANÁLISE DE CÓDIGO (Python)

Problemas de performance:
• Recursão sem memoização - O(2^n)
• Recalcula mesmos valores centenas de vezes

Melhorias possíveis:
• Use @lru_cache(maxsize=None) - O(n)
• Implemente versão iterativa com loop
• Use programação dinâmica com tabela

Complexidade atual: Tempo O(2^n), Espaço O(n)
```

---

## 🎮 Teste 2: JavaScript - Função de Array

### Código para Testar
```javascript
function findMax(arr) {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}

const numbers = [3, 1, 4, 1, 5, 9, 2, 6];
console.log(findMax(numbers));
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```javascript
function findMax(arr) {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /resumir
```powershell
$body = @{
    userId = "test_user"
    message = "/resumir"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /otimizar
```powershell
$body = @{
    userId = "test_user"
    message = "/otimizar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Resposta Esperada (otimizar)
```
⚡ ANÁLISE DE CÓDIGO (JavaScript)

Problemas:
• Loop manual desnecessário
• Math.max() seria mais eficiente

Sugestões:
• Use Math.max(...arr)
• Ou arr.reduce((a,b) => a > b ? a : b)
• Ou arr.sort()[arr.length-1]

Complexidade: O(n) - pode ser O(1) com reduce
```

---

## 🔐 Teste 3: PHP - SQL Injection (VULNERABILIDADE)

### Código Vulnerável para Testar
```php
<?php
$id = $_GET['id'];
$query = "SELECT * FROM users WHERE id = $id";
$result = mysqli_query($conn, $query);
?>
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```php
\$id = \$_GET['id'];
\$query = \"SELECT * FROM users WHERE id = \$id\";
\$result = mysqli_query(\$conn, \$query);
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /seguranca
```powershell
$body = @{
    userId = "test_user"
    message = "/seguranca"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Resposta Esperada
```
🔒 ANÁLISE DE CÓDIGO (PHP)

VULNERABILIDADES ENCONTRADAS:
❌ SQL Injection - Entrada não sanitizada
❌ $_GET usado diretamente em SQL
❌ Sem prepared statements

RECOMENDAÇÕES:
✅ Use prepared statements (mysqli_prepare)
✅ Use parametrizadas com placeholders ?
✅ Use ORM (Eloquent, Doctrine)
✅ Valide e sanitize todas as entradas

Exemplo seguro:
$stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
$stmt->bind_param("i", $id);
```

---

## 🎓 Teste 4: Java - Classe com Lógica

### Código para Testar
```java
public class Calculator {
    public static int add(int a, int b) {
        return a + b;
    }
    
    public static void main(String[] args) {
        int result = add(5, 3);
        System.out.println("Resultado: " + result);
    }
}
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```java
public class Calculator {
    public static int add(int a, int b) {
        return a + b;
    }
}
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /explicar
```powershell
$body = @{
    userId = "test_user"
    message = "/explicar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

---

## ⚡ Teste 5: C++ - Algoritmo

### Código para Testar
```cpp
#include <vector>
#include <iostream>

int main() {
    std::vector<int> numbers = {3, 1, 4, 1, 5, 9, 2, 6};
    
    for (int i = 0; i < numbers.size(); i++) {
        if (numbers[i] > 5) {
            numbers[i] *= 2;
        }
    }
    
    return 0;
}
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```cpp
#include <vector>
for (int i = 0; i < numbers.size(); i++) {
    if (numbers[i] > 5) {
        numbers[i] *= 2;
    }
}
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /otimizar

---

## 💾 Teste 6: SQL - Query

### Código para Testar
```sql
SELECT u.id, u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.id
ORDER BY order_count DESC
LIMIT 10;
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```sql
SELECT u.id, u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.id
ORDER BY order_count DESC
LIMIT 10;
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /resumir
```powershell
$body = @{
    userId = "test_user"
    message = "/resumir"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

---

## 📄 Teste 7: HTML/CSS - Página Web

### Código para Testar
```html
<!DOCTYPE html>
<html>
<head>
    <title>Meu Site</title>
    <style>
        body { font-family: Arial; }
        .container { max-width: 1200px; margin: 0 auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Bem-vindo!</h1>
        <p>Conteúdo aqui</p>
    </div>
</body>
</html>
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```html
<!DOCTYPE html>
<html>
<head>
    <title>Meu Site</title>
    <style>
        body { font-family: Arial; }
    </style>
</head>
<body>
    <h1>Bem-vindo!</h1>
</body>
</html>
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

---

## 🔄 Teste 8: Go - Concorrência

### Código para Testar
```go
package main

import (
    "fmt"
    "sync"
)

func worker(id int, jobs <-chan int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        fmt.Printf("Worker %d processing job %d\n", id, job)
    }
}

func main() {
    var wg sync.WaitGroup
    jobs := make(chan int, 10)
    
    for w := 1; w <= 3; w++ {
        wg.Add(1)
        go worker(w, jobs, &wg)
    }
}
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```go
func worker(id int, jobs <-chan int, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        fmt.Printf(\"Worker %d processing job %d\n\", id, job)
    }
}
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

---

## 🦀 Teste 9: Rust - Memory Safety

### Código para Testar
```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    
    println!("{}", s1); // Erro - s1 foi movido
}
```

### Teste via cURL
```powershell
$body = @{
    userId = "test_user"
    message = "```rust
let s1 = String::from(\"hello\");
let s2 = s1;
println!(\"{}\", s1);
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Teste: /explicar
```powershell
$body = @{
    userId = "test_user"
    message = "/explicar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

---

## 🎯 Teste 10: Todos os Comandos Juntos

### Sequência de Teste Completa

#### Passo 1: Enviar código
```powershell
$body = @{
    userId = "test_user_completo"
    message = "```python
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

**Resposta esperada:** Bot detecta Python e oferece opções

#### Passo 2: Testar /resumir
```powershell
$body = @{
    userId = "test_user_completo"
    message = "/resumir"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

#### Passo 3: Testar /explicar
```powershell
$body = @{
    userId = "test_user_completo"
    message = "/explicar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

#### Passo 4: Testar /otimizar
```powershell
$body = @{
    userId = "test_user_completo"
    message = "/otimizar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

**Resposta esperada:**
```
⚡ ANÁLISE DE CÓDIGO (Python)

Problemas de performance:
• Bubble sort é O(n²) - muito lento
• Muito mais lento que quicksort, mergesort

Melhorias possíveis:
• Use sorted(arr) nativo do Python
• Ou use lista.sort()
• Ou implemente quicksort O(n log n)

Complexidade: O(n²) - considere melhorar!
```

#### Passo 5: Testar /historico
```powershell
$body = @{
    userId = "test_user_completo"
    message = "/historico"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

**Resposta esperada:** Lista as últimas 15 mensagens com timestamps

---

## 📊 Teste 11: Detecção Automática

### Código sem Blocos (detecta mesmo assim)
```powershell
$body = @{
    userId = "test_user"
    message = "function hello() {
  console.log('oi');
  return true;
}"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

**Resposta esperada:** Bot detecta como JavaScript (mesmo sem ```)

---

## 🔍 Teste 12: Sugestões Automáticas

### Código com Problemas
```powershell
$body = @{
    userId = "test_user"
    message = "```python
while True:
    user_input = input()
    code = eval(user_input)
    console.log(code)
```"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

**Resposta esperada:**
```
📊 Detectei código em Python!

💡 Sugestões:
⚠️ Evite usar eval() - risco de segurança
⚠️ Loop infinito detectado

Use:
• /resumir
• /explicar
• /otimizar
• /seguranca
```

---

## 🚀 Teste 13: Teste Automático (Node.js)

### Executar Script de Teste
```powershell
cd c:\Users\convidado\ 1\Documents\zherkeysite
node test_analyzer.js
```

**Resposta esperada:**
```
📊 ========== CODE ANALYZER TEST ==========

🧪 TEST 1: Code Detection & Language Identification
✅ Python - Fibonacci
✅ JavaScript - Array Max
✅ SQL - Query
✅ PHP - SQL Injection Vulnerability
✅ C++ - Vector Loop

📈 RESULTS: 5 passed, 1 failed
```

---

## 📝 Teste 14: Verificar Histórico Salvo

### Listar usuários e históricos
```powershell
$body = @{
    userId = "test_user"
    message = "/relatorio"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

### Exportar histórico
```powershell
$body = @{
    userId = "test_user"
    message = "/exportar"
} | ConvertTo-Json

curl http://localhost:3001/api/chat -X POST `
  -H "Content-Type: application/json" `
  -d $body
```

---

## ✅ Checklist de Testes

- [ ] Teste 1: Python Fibonacci
- [ ] Teste 2: JavaScript Array
- [ ] Teste 3: PHP SQL Injection
- [ ] Teste 4: Java Calculator
- [ ] Teste 5: C++ Vector
- [ ] Teste 6: SQL Query
- [ ] Teste 7: HTML/CSS
- [ ] Teste 8: Go Concurrency
- [ ] Teste 9: Rust Memory
- [ ] Teste 10: Todos os comandos
- [ ] Teste 11: Detecção automática
- [ ] Teste 12: Sugestões automáticas
- [ ] Teste 13: Script de teste Node.js
- [ ] Teste 14: Histórico

---

## 🎯 Próximos Testes

- [ ] Teste com API externa
- [ ] Teste com múltiplos usuários simultâneos
- [ ] Teste com código muito grande (10K linhas)
- [ ] Teste de performance (tempo de resposta)
- [ ] Teste de memória (uso de RAM)

---

**Bom teste! 🚀**

*Qualquer comando não documentado aqui, sinta-se à vontade para testar!*
