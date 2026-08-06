async function checkOrders() {
    try {
        console.log("🔑 Testando login na API do ZherKeys (https://zherkeys.com/login)...");
        const loginRes = await fetch('https://zherkeys.com/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'zherkeys@gmail.com', password: 'admin123' })
        });

        const loginData = await loginRes.json().catch(() => ({}));
        console.log("Resposta do Login:", loginData);

        const cookie = loginRes.headers.get('set-cookie');

        console.log("📦 Buscando pedidos da conta no ZherKeys...");
        const ordersRes = await fetch('https://zherkeys.com/api/user/orders', {
            headers: cookie ? { 'Cookie': cookie } : {}
        });

        const ordersData = await ordersRes.json().catch(() => ({}));
        console.log("Pedidos na conta:", ordersData);

    } catch (e) {
        console.error("Erro na verificação dos pedidos:", e.message);
    }
}

checkOrders();
