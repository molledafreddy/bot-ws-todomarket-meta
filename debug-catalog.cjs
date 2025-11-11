// 🔍 DEBUG: Herramienta para debuggear catálogo de Meta Business API
// Ejecutar con: node debug-catalog.js

require('dotenv/config');

// Importar fetch para Node.js si no está disponible globalmente
const fetch = globalThis.fetch || require('node-fetch');

// Función para debuggear y listar todos los productos disponibles en el catálogo de Meta
async function debugCatalogProducts(catalogId, accessToken) {
    try {
        console.log('\n🔍 === DEBUG: LISTANDO PRODUCTOS DEL CATÁLOGO ===');
        console.log('📋 Catalog ID:', catalogId);
        console.log('🔑 Token disponible:', !!accessToken);
        
        if (!accessToken) {
            console.log('❌ No se encontró token de acceso');
            return;
        }
        
        const catalogUrl = `https://graph.facebook.com/v22.0/${catalogId}/products`;
        const catalogParams = {
            fields: 'id,name,description,price,currency,retailer_id,availability,condition,brand',
            access_token: accessToken,
            limit: '50' // Limitar para no sobrecargar
        };
        
        const catalogQueryString = new URLSearchParams(catalogParams).toString();
        const catalogFullUrl = `${catalogUrl}?${catalogQueryString}`;
        
        console.log('📡 Consultando catálogo completo...');
        console.log('🔗 URL:', catalogFullUrl.replace(accessToken, '***TOKEN***'));
        
        const response = await fetch(catalogFullUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        console.log('📊 Status:', response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Respuesta exitosa del catálogo');
            
            if (data && data.data && Array.isArray(data.data)) {
                console.log(`📦 Productos encontrados: ${data.data.length}`);
                console.log('\n📋 LISTA DE PRODUCTOS:');
                console.log('========================');
                
                data.data.forEach((product, index) => {
                    console.log(`${index + 1}. ID: ${product.id || 'N/A'}`);
                    console.log(`   Retailer ID: ${product.retailer_id || 'N/A'}`);
                    console.log(`   Nombre: ${product.name || 'N/A'}`);
                    console.log(`   Precio: ${product.price || 'N/A'} ${product.currency || ''}`);
                    console.log(`   Disponibilidad: ${product.availability || 'N/A'}`);
                    console.log(`   Marca: ${product.brand || 'N/A'}`);
                    console.log('   ---');
                });
                
                // Buscar los IDs específicos que estamos probando
                const testIds = ['51803h3qku', 'ip1nctw0hq', '5snmm6fndt', 'ypgstd82t1'];
                console.log('\n🔍 VERIFICANDO IDs DE PRUEBA:');
                console.log('=============================');
                
                testIds.forEach(testId => {
                    const foundById = data.data.find(p => p.id === testId);
                    const foundByRetailerId = data.data.find(p => p.retailer_id === testId);
                    
                    if (foundById) {
                        console.log(`✅ ${testId}: ENCONTRADO por ID -> ${foundById.name}`);
                    } else if (foundByRetailerId) {
                        console.log(`✅ ${testId}: ENCONTRADO por Retailer ID -> ${foundByRetailerId.name}`);
                    } else {
                        console.log(`❌ ${testId}: NO ENCONTRADO en catálogo`);
                    }
                });
                
                // Mostrar paginación si existe
                if (data.paging) {
                    console.log('\n📄 PAGINACIÓN:');
                    console.log('===============');
                    if (data.paging.next) {
                        console.log('➡️  Siguiente página disponible');
                    }
                    if (data.paging.previous) {
                        console.log('⬅️  Página anterior disponible');
                    }
                }
                
            } else {
                console.log('⚠️  No se encontraron productos en la respuesta');
                console.log('📦 Estructura de respuesta:', JSON.stringify(data, null, 2));
            }
        } else {
            console.log('❌ Error HTTP:', response.status, response.statusText);
            const errorText = await response.text();
            console.log('📄 Respuesta de error:', errorText);
            
            // Intentar parsear el error como JSON
            try {
                const errorJson = JSON.parse(errorText);
                console.log('📋 Error detallado:', JSON.stringify(errorJson, null, 2));
            } catch (parseError) {
                console.log('📋 Error no es JSON válido');
            }
        }
        
        console.log('\n=== FIN DEBUG CATÁLOGO ===\n');
        
    } catch (error) {
        console.error('❌ Error debuggeando catálogo:', error);
        if (error instanceof Error) {
            console.error('📋 Stack trace:', error.stack);
        }
    }
}

// Función para probar consulta individual de producto
async function testIndividualProduct(catalogId, productId, accessToken) {
    try {
        console.log('\n🔍 === PRUEBA: CONSULTA INDIVIDUAL ===');
        console.log('📋 Catalog ID:', catalogId);
        console.log('🆔 Product ID:', productId);
        
        // Método 1: Acceso directo
        const directUrl = `https://graph.facebook.com/v22.0/${catalogId}/products/${productId}`;
        const directParams = {
            fields: 'id,name,description,price,currency,retailer_id,availability,condition,brand',
            access_token: accessToken
        };
        
        const directQueryString = new URLSearchParams(directParams).toString();
        const directFullUrl = `${directUrl}?${directQueryString}`;
        
        console.log('📡 Método 1: Acceso directo');
        console.log('🔗 URL:', directFullUrl.replace(accessToken, '***TOKEN***'));
        
        const directResponse = await fetch(directFullUrl);
        console.log('📊 Status directo:', directResponse.status, directResponse.statusText);
        
        if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log('✅ Respuesta directa exitosa:', JSON.stringify(directData, null, 2));
        } else {
            const errorText = await directResponse.text();
            console.log('❌ Error acceso directo:', errorText);
        }
        
        console.log('\n=== FIN PRUEBA INDIVIDUAL ===\n');
        
    } catch (error) {
        console.error('❌ Error en prueba individual:', error);
    }
}

// Ejecutar el debug
async function main() {
    console.log('🚀 INICIANDO DEBUG DEL CATÁLOGO DE META');
    console.log('=====================================');
    
    const catalogId = '1057244946408276';
    const accessToken = process.env.JWT_TOKEN;
    
    if (!accessToken) {
        console.log('❌ No se encontró JWT_TOKEN en las variables de entorno');
        console.log('💡 Asegúrate de tener un archivo .env con JWT_TOKEN configurado');
        return;
    }
    
    // 1. Debuggear catálogo completo
    await debugCatalogProducts(catalogId, accessToken);
    
    // 2. Probar consulta individual con uno de los IDs problemáticos
    await testIndividualProduct(catalogId, '5snmm6fndt', accessToken);
    
    console.log('✅ Debug completado');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    debugCatalogProducts,
    testIndividualProduct
};
