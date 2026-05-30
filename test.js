fetch('https://zherkeys.onrender.com/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test4@test.com', password: '123' })
}).then(res => res.json()).then(console.log).catch(console.error);
