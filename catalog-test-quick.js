require('dotenv').config();

async function testCatalogs() {
  console.log('⚡ === TEST RÁPIDO DE CATÁLOGOS ===\n');
  
  const token = process.env.JWT_TOKEN;
  const todomarketId = process.env.CATALOG_TODOMARKET_ID;
  const bebidasId = process.env.CATALOG_BEBIDAS_ID;
  
  console.log('🔧 Configuración:');
  console.log(`   Token: ${token ? '✅ Configurado' : '❌ Faltante'}`);
  console.log(`   TodoMarket ID: ${todomarketId || '❌ Faltante'}`);
  console.log(`   Bebidas ID: ${bebidasId || '❌ Faltante'}\n`);
  
  if (!token || !todomarketId || !bebidasId) {
    console.log('❌ Configuración incompleta');
    return;
  }
  
  const tests = [
    { name: 'TodoMarket', id: todomarketId },
    { name: 'Bebidas', id: bebidasId }
  ];
  
  for (const test of tests) {
    try {
      console.log(`🔍 Testeando ${test.name}...`);
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${test.id}?access_token=${token}`
      );
      
      const data = await response.json();
      
      if (response.ok) {
        console.log(`✅ ${test.name}: ACCESIBLE`);
        console.log(`   📝 Nombre: ${data.name || 'N/A'}`);
        console.log(`   📊 Productos: ${data.product_count || 'N/A'}`);
      } else {
        console.log(`❌ ${test.name}: ERROR`);
        console.log(`   💥 ${data.error?.message || 'Error desconocido'}`);
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: EXCEPCIÓN`);
      console.log(`   💥 ${error.message}`);
    }
    
    console.log('');
  }
}

testCatalogs().then(() => console.log('🏁 Test completado'));
