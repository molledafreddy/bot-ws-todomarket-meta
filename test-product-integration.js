// 🧪 EJEMPLO DE TESTING - Integración de Productos Meta API
// Archivo: test-product-integration.js

// Datos de prueba que simulan lo que viene desde Meta
const mockOrderData = {
    catalog_id: '1057244946408276',
    product_items: [
        {
            product_retailer_id: '51803h3qku',
            quantity: 1,
            item_price: 1900,
            currency: 'CLP'
        },
        {
            product_retailer_id: 'ip1nctw0hq',
            quantity: 1,
            item_price: 1600,
            currency: 'CLP'
        },
        {
            product_retailer_id: '5snmm6fndt',
            quantity: 1,
            item_price: 1500,
            currency: 'CLP'
        },
        {
            product_retailer_id: 'ypgstd82t1',
            quantity: 1,
            item_price: 1700,
            currency: 'CLP'
        }
    ]
};

// Simulación de respuesta exitosa de Meta API
const mockMetaAPIResponse = {
    '51803h3qku': {
        data: [{
            id: '51803h3qku',
            name: 'Coca Cola Lata 350ml Original',
            description: 'Bebida gaseosa cola en lata de 350ml, sabor clásico',
            price: '1900',
            currency: 'CLP',
            brand: 'Coca Cola',
            availability: 'in stock',
            condition: 'new'
        }]
    },
    'ip1nctw0hq': {
        data: [{
            id: 'ip1nctw0hq',
            name: 'Pan de Molde Integral Bimbo 500g',
            description: 'Pan de molde integral marca Bimbo, paquete de 500g',
            price: '1600',
            currency: 'CLP',
            brand: 'Bimbo',
            availability: 'in stock'
        }]
    },
    '5snmm6fndt': {
        data: [{
            id: '5snmm6fndt',
            name: 'Leche Entera Soprole 1L',
            description: 'Leche entera Soprole en envase de 1 litro',
            price: '1500',
            currency: 'CLP',
            brand: 'Soprole',
            availability: 'in stock'
        }]
    },
    'ypgstd82t1': {
        data: [{
            id: 'ypgstd82t1',
            name: 'Arroz Grado 1 Tucapel 1kg',
            description: 'Arroz grado 1 marca Tucapel, bolsa de 1 kilogramo',
            price: '1700',
            currency: 'CLP',
            brand: 'Tucapel',
            availability: 'in stock'
        }]
    }
};

// RESULTADO ESPERADO CON LA NUEVA INTEGRACIÓN:
console.log('📋 EJEMPLO DE RESULTADO MEJORADO:');
console.log('==========================================');

console.log('\n🔍 Datos originales de la orden:');
console.log(JSON.stringify(mockOrderData, null, 2));

console.log('\n📡 Después de consultar Meta API:');
console.log('\n*Productos Seleccionados desde Catálogo*\n');

mockOrderData.product_items.forEach((item, index) => {
    const productId = item.product_retailer_id;
    const mockResponse = mockMetaAPIResponse[productId];
    const productName = mockResponse ? mockResponse.data[0].name : `Producto ${productId}`;
    const brand = mockResponse ? mockResponse.data[0].brand : '';
    
    console.log(`👉 #${index + 1} ${productName} | ID: ${productId} | Cantidad: ${item.quantity} | Precio: $${item.item_price}`);
});

const total = mockOrderData.product_items.reduce((sum, item) => sum + (item.item_price * item.quantity), 0);
console.log(`\n💰 Total a Pagar: $${total}`);

console.log('\n🎯 BENEFICIOS ALCANZADOS:');
console.log('✅ Nombres descriptivos en lugar de solo IDs');
console.log('✅ Información actualizada desde Meta Business API');
console.log('✅ Fallback robusto en caso de errores');
console.log('✅ Mejor experiencia para agentes y clientes');

console.log('\n📊 COMPARACIÓN:');
console.log('\nANTES:');
console.log('👉 #1 ID: 51803h3qku | Cantidad: 1 | Precio: $1900');

console.log('\nAHORA:');
console.log('👉 #1 Coca Cola Lata 350ml Original | ID: 51803h3qku | Cantidad: 1 | Precio: $1900');

console.log('\n==========================================');

// Ejemplo de flujo completo del mensaje al agente
console.log('\n📧 MENSAJE COMPLETO AL AGENTE:');
console.log('==========================================');

const finalMessage = `*🛒 Se registró nuevo pedido con Detalle: 🛒*

*Nombre Cliente:* Juan Pérez
*Teléfono:* +56912345678  
*Dirección:* Av. Libertador 123, Santiago, Depto 4B Torre Norte

*Productos:*
👉 #1 Coca Cola Lata 350ml Original | ID: 51803h3qku | Cantidad: 1 | Precio: $1900
👉 #2 Pan de Molde Integral Bimbo 500g | ID: ip1nctw0hq | Cantidad: 1 | Precio: $1600  
👉 #3 Leche Entera Soprole 1L | ID: 5snmm6fndt | Cantidad: 1 | Precio: $1500
👉 #4 Arroz Grado 1 Tucapel 1kg | ID: ypgstd82t1 | Cantidad: 1 | Precio: $1700

💰 Total a Pagar: $6700`;

console.log(finalMessage);
console.log('==========================================');
