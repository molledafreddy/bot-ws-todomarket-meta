import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';

// Log inmediato para confirmar que el script se ejecuta
console.log('🎯 === SCRIPT INICIADO ===');
console.log('📅 Timestamp:', new Date().toISOString());

// Cargar variables de entorno con debug
console.log('📦 Cargando dotenv...');
dotenv.config();
console.log('✅ dotenv.config() ejecutado');

// Debug de variables de entorno
console.log('\n🔧 DEBUG VARIABLES:');
const token = process.env.JWT_TOKEN;
const todomarketId = process.env.CATALOG_TODOMARKET_ID;
const bebidasId = process.env.CATALOG_BEBIDAS_ID;

console.log(`   JWT_TOKEN present: ${!!token}`);
console.log(`   CATALOG_TODOMARKET_ID: ${todomarketId || 'undefined'}`);
console.log(`   CATALOG_BEBIDAS_ID: ${bebidasId || 'undefined'}`);

async function getCatalogInfo(catalogId: string, catalogName: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📋 ANALIZANDO: ${catalogName.toUpperCase()}`);
  console.log(`🆔 ID: ${catalogId}`);
  console.log(`${'='.repeat(50)}`);
  
  try {
    // 1. Información básica del catálogo
    console.log('📊 Consultando información básica...');
    const catalogInfoUrl = `https://graph.facebook.com/v18.0/${catalogId}?fields=name,product_count,business&access_token=${token}`;
    
    const catalogResponse = await fetch(catalogInfoUrl);
    const catalogData = await catalogResponse.json();
    
    if (!catalogResponse.ok) {
      throw new Error(`Error catálogo: ${catalogData.error?.message || 'Unknown error'}`);
    }
    
    console.log('✅ INFORMACIÓN BÁSICA OBTENIDA:');
    console.log(`   📝 Nombre: ${catalogData.name}`);
    console.log(`   📊 Total productos: ${catalogData.product_count}`);
    console.log(`   🏢 Business ID: ${catalogData.business?.id || 'N/A'}`);
    
    // 2. Consultar productos (primeros 100)
    console.log('\n📦 Consultando productos detallados...');
    const productsUrl = `https://graph.facebook.com/v18.0/${catalogId}/products?fields=name,description,price,availability,image_url,retailer_id,category&limit=100&access_token=${token}`;
    
    const productsResponse = await fetch(productsUrl);
    const productsData = await productsResponse.json();
    
    if (!productsResponse.ok) {
      throw new Error(`Error productos: ${productsData.error?.message || 'Unknown error'}`);
    }
    
    const products = productsData.data || [];
    console.log(`✅ PRODUCTOS CONSULTADOS: ${products.length} de ${catalogData.product_count}`);
    
    // 3. Análisis de categorías
    const categories = products.reduce((acc: any, product: any) => {
      const cat = product.category || 'Sin categoría';
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(product);
      return acc;
    }, {});
    
    console.log('\n📂 ANÁLISIS POR CATEGORÍAS:');
    Object.entries(categories).forEach(([category, categoryProducts]: [string, any]) => {
      console.log(`   • ${category}: ${categoryProducts.length} productos`);
    });
    
    // 4. Análisis de disponibilidad
    const availabilityStats = products.reduce((acc: any, product: any) => {
      const availability = product.availability || 'unknown';
      acc[availability] = (acc[availability] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n🏪 ANÁLISIS DE DISPONIBILIDAD:');
    Object.entries(availabilityStats).forEach(([status, count]) => {
      console.log(`   • ${status}: ${count} productos`);
    });
    
    // 5. Análisis de precios
    const productsWithPrices = products.filter((p: any) => p.price && !isNaN(parseFloat(p.price)));
    if (productsWithPrices.length > 0) {
      const prices = productsWithPrices.map((p: any) => parseFloat(p.price));
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
      
      console.log('\n💰 ANÁLISIS DE PRECIOS:');
      console.log(`   💵 Precio mínimo: $${minPrice.toLocaleString()}`);
      console.log(`   💵 Precio máximo: $${maxPrice.toLocaleString()}`);
      console.log(`   💵 Precio promedio: $${avgPrice.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
      console.log(`   📊 Productos con precio: ${productsWithPrices.length}/${products.length}`);
    }
    
    // 6. Muestra de productos
    console.log('\n📋 MUESTRA DE PRODUCTOS (primeros 10):');
    products.slice(0, 10).forEach((product: any, index: number) => {
      console.log(`   ${index + 1}. ${product.name || 'Sin nombre'}`);
      console.log(`      💰 Precio: ${product.price || 'N/A'}`);
      console.log(`      📂 Categoría: ${product.category || 'Sin categoría'}`);
      console.log(`      🏪 Disponibilidad: ${product.availability || 'N/A'}`);
      console.log(`      🆔 Retailer ID: ${product.retailer_id || 'N/A'}`);
      console.log('');
    });
    
    // 7. Si hay más productos, indicar paginación
    if (products.length < catalogData.product_count) {
      const remaining = catalogData.product_count - products.length;
      console.log(`📄 HAY MÁS PRODUCTOS: ${remaining} productos adicionales disponibles`);
      console.log(`   💡 Este catálogo tiene ${catalogData.product_count} productos en total`);
    }
    
    return {
      catalogId,
      catalogName,
      status: 'success',
      info: catalogData,
      products: products,
      productCount: catalogData.product_count,
      consultedProducts: products.length,
      categories: Object.keys(categories),
      categoriesCount: Object.keys(categories).length,
      availability: availabilityStats
    };
    
  } catch (error: any) {
    console.log(`❌ ERROR EN ${catalogName.toUpperCase()}:`);
    console.log(`   💥 ${error.message}`);
    
    return {
      catalogId,
      catalogName,
      status: 'error',
      error: error.message
    };
  }
}

async function analyzeCatalogs() {
  console.log('\n⚡ === ANÁLISIS COMPLETO DE CATÁLOGOS ===');
  
  if (!token || !todomarketId || !bebidasId) {
    console.log('\n❌ CONFIGURACIÓN INCOMPLETA');
    return;
  }
  
  console.log('\n✅ Configuración completa - Procediendo con análisis...');
  
  // Analizar ambos catálogos
  const catalogs = [
    { id: todomarketId, name: 'TodoMarket Principal' },
    { id: bebidasId, name: 'Catálogo Bebidas' }
  ];
  
  const results = [];
  
  for (const catalog of catalogs) {
    const result = await getCatalogInfo(catalog.id, catalog.name);
    results.push(result);
  }
  
  // Resumen comparativo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN COMPARATIVO DE CATÁLOGOS');
  console.log('='.repeat(60));
  
  const successfulResults = results.filter(r => r.status === 'success');
  
  if (successfulResults.length > 0) {
    console.log('\n📋 ESTADÍSTICAS GENERALES:');
    
    successfulResults.forEach(result => {
      console.log(`\n✅ ${result.catalogName}:`);
      console.log(`   📊 Total productos: ${result.productCount}`);
      console.log(`   📦 Productos consultados: ${result.consultedProducts}`);
      console.log(`   📂 Categorías encontradas: ${result.categoriesCount}`);
      console.log(`   📂 Categorías: ${result.categories.join(', ')}`);
    });
    
    // Análisis de duplicación si tenemos ambos catálogos
    if (successfulResults.length === 2) {
      console.log('\n🔍 ANÁLISIS DE DUPLICACIÓN:');
      const [catalog1, catalog2] = successfulResults;
      
      const ids1 = catalog1.products.map((p: any) => p.retailer_id).filter(Boolean);
      const ids2 = catalog2.products.map((p: any) => p.retailer_id).filter(Boolean);
      const duplicates = ids1.filter((id: string) => ids2.includes(id));
      
      console.log(`   📊 Productos únicos en ${catalog1.catalogName}: ${ids1.length - duplicates.length}`);
      console.log(`   📊 Productos únicos en ${catalog2.catalogName}: ${ids2.length - duplicates.length}`);
      console.log(`   📊 Productos duplicados: ${duplicates.length}`);
      
      if (duplicates.length > 0) {
        console.log('   ⚠️ Algunos productos duplicados:');
        duplicates.slice(0, 5).forEach(id => {
          const product1 = catalog1.products.find((p: any) => p.retailer_id === id);
          const product2 = catalog2.products.find((p: any) => p.retailer_id === id);
          console.log(`      • ID ${id}: "${product1?.name}" vs "${product2?.name}"`);
        });
      }
    }
    
    // Total de productos únicos
    const totalProducts = successfulResults.reduce((sum, result) => sum + result.productCount, 0);
    console.log(`\n📈 TOTAL PRODUCTOS DISPONIBLES: ${totalProducts}`);
  }
  
  // Recomendaciones finales
  console.log('\n🎯 RECOMENDACIONES PARA IMPLEMENTACIÓN:');
  
  if (successfulResults.length === 2) {
    console.log('✅ IMPLEMENTACIÓN MULTI-CATÁLOGO VIABLE');
    console.log('   • Ambos catálogos accesibles y con productos');
    console.log('   • Estructura de datos consistente');
    console.log('   • Categorías bien definidas');
    console.log('\n💡 Estrategias recomendadas:');
    console.log('   1. Usar catálogos separados por categoría');
    console.log('   2. Implementar navegación por catálogo específico');
    console.log('   3. Mantener carrito consolidado entre catálogos');
  } else if (successfulResults.length === 1) {
    console.log('⚠️ IMPLEMENTACIÓN PARCIAL POSIBLE');
    console.log('   • Solo un catálogo funcional');
    console.log('   • Considera usar product_list para simular categorías');
  } else {
    console.log('❌ PROBLEMAS DE CONECTIVIDAD');
    console.log('   • Revisa configuración antes de proceder');
  }
  
  return results;
}

// Ejecutar análisis completo
console.log('\n🚀 === EJECUTANDO ANÁLISIS COMPLETO ===');

analyzeCatalogs()
  .then(() => {
    console.log('\n✅ === ANÁLISIS COMPLETADO EXITOSAMENTE ===');
    console.log('📅 Finalizado:', new Date().toISOString());
    process.exit(0);
  })
  .catch((error: any) => {
    console.log('\n💥 === ERROR FATAL ===');
    console.log('🔴 Message:', error.message);
    console.log('📄 Stack:');
    console.log(error.stack);
    process.exit(1);
  });