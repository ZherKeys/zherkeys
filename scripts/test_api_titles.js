fetch('http://localhost:3000/api/products')
    .then(r => r.json())
    .then(data => {
        console.log('✅ PRODUTOS NA API AO VIVO (' + data.length + ' produtos):');
        data.forEach((p, i) => console.log(`${i+1}. ${p.title}`));
    }).catch(e => console.error(e));
