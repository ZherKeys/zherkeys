#!/usr/bin/env node

/**
 * Script de teste para Code Analyzer
 * Testa detecção, linguagem e análises
 */

const codeAnalyzer = require('./chatbot/core/codeAnalyzer');

console.log('\n📊 ========== CODE ANALYZER TEST ==========\n');

// Testes de detecção
const tests = [
  {
    name: 'Python - Fibonacci',
    code: `\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
\`\`\``,
    expectLanguage: 'python'
  },
  {
    name: 'JavaScript - Array Max',
    code: `\`\`\`javascript
function findMax(arr) {
  return arr.reduce((a, b) => a > b ? a : b);
}
\`\`\``,
    expectLanguage: 'javascript'
  },
  {
    name: 'SQL - Query',
    code: `\`\`\`sql
SELECT * FROM users WHERE id = $1;
\`\`\``,
    expectLanguage: 'sql'
  },
  {
    name: 'PHP - SQL Injection Vulnerability',
    code: `\`\`\`php
$id = $_GET['id'];
$query = "SELECT * FROM users WHERE id = $id";
$result = mysqli_query($conn, $query);
\`\`\``,
    expectLanguage: 'php'
  },
  {
    name: 'C++ - Vector Loop',
    code: `\`\`\`cpp
#include <vector>
for (int i = 0; i < vec.size(); i++) {
  if (vec[i] > 10) {
    vec[i] *= 2;
  }
}
\`\`\``,
    expectLanguage: 'cpp'
  },
  {
    name: 'Código sem marcação',
    code: `function hello() {
  console.log('oi');
  return true;
}`,
    expectLanguage: 'javascript'
  }
];

// Test detection and language identification
console.log('🧪 TEST 1: Code Detection & Language Identification\n');

let passed = 0;
let failed = 0;

tests.forEach((test) => {
  const result = codeAnalyzer.detectCode(test.code);
  
  const detectedOk = result.found ? '✅' : '❌';
  const languageOk = result.language === test.expectLanguage ? '✅' : '⚠️';
  
  console.log(`${detectedOk} ${test.name}`);
  console.log(`   Language: ${result.language} (expected: ${test.expectLanguage}) ${languageOk}`);
  
  if (result.found && result.language === test.expectLanguage) {
    passed++;
  } else {
    failed++;
  }
  console.log('');
});

console.log(`\n📈 RESULTS: ${passed} passed, ${failed} failed\n`);

// Test suggestions
console.log('💡 TEST 2: Suggestion Generation\n');

const problematicCode = `
while (true) {
  if (x > 10) {
    eval(userInput);
    console.log('debug');
  }
}
`;

const suggestions = codeAnalyzer.generateSuggestions(problematicCode);
console.log('Problematic code suggestions:');
suggestions.forEach(s => console.log(`  ${s}`));

console.log('\n');

// Test format
console.log('📋 TEST 3: Analysis Output Format\n');

const analysisResult = {
  success: true,
  language: 'python',
  analysisType: 'summary',
  analysis: 'Esta função calcula o Fibonacci recursivamente usando recursão pura.',
  codePreview: 'def fibonacci(n): ...'
};

const formatted = codeAnalyzer.formatAnalysis(analysisResult);
console.log('Formatted output:');
console.log(formatted);

console.log('\n✅ Code Analyzer Tests Complete!\n');
