// Análisis técnico completo del problema de visualización de productos en catálogo Meta
import { config } from 'dotenv';

config();

async function analyzeProductViewError() {
    console.log('🔍 ANÁLISIS TÉCNICO: ERROR AL VER PRODUCTOS EN CATÁLOGO META');
    console.log('=' .repeat(80));
    
    const accessToken = process.env.JWT_TOKEN;
    const numberId = process.env.NUMBER_ID;
    const businessId = '1349962220108819';
    
    console.log('\n📋 DATOS DE LA CONFIGURACIÓN:');
    console.log(`  - Business ID: ${businessId}`);
    console.log(`  - Number ID (App): ${numberId}`);
    console.log(`  - Phone Number: 56979643935`);
    console.log(`  - Access Token: ${accessToken ? 'Disponible' : 'Faltante'}`);
    
    if (!accessToken) {
        console.error('❌ No se puede continuar sin access token');
        return;
    }
    
    // 1. VERIFICAR ESTADO DEL BUSINESS
    console.log('\n🏢 1. VERIFICANDO BUSINESS MANAGER:');
    console.log('-'.repeat(50));
    
    try {
        const businessUrl = `https://graph.facebook.com/v18.0/${businessId}`;
        const businessParams = new URLSearchParams({
            fields: 'id,name,verification_status,permitted_tasks',
            access_token: accessToken
        });
        
        const businessResponse = await fetch(`${businessUrl}?${businessParams}`);
        
        if (businessResponse.ok) {
            const businessData = await businessResponse.json();
            console.log('✅ Business Manager accesible:');
            console.log(`   - ID: ${businessData.id}`);
            console.log(`   - Nombre: ${businessData.name || 'N/A'}`);
            console.log(`   - Estado verificación: ${businessData.verification_status || 'N/A'}`);
            console.log(`   - Tareas permitidas: ${businessData.permitted_tasks?.length || 0}`);
        } else {
            const errorText = await businessResponse.text();
            console.log('❌ Error accediendo Business Manager:');
            console.log(`   Status: ${businessResponse.status}`);
            console.log(`   Error: ${errorText}`);
        }
    } catch (error) {
        console.log('❌ Excepción verificando business:', error.message);
    }
    
    // 2. VERIFICAR CATÁLOGOS Y SUS CONFIGURACIONES
    console.log('\n📦 2. VERIFICANDO CATÁLOGOS:');
    console.log('-'.repeat(50));
    
    try {
        const catalogsUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_product_catalogs`;
        const catalogsParams = new URLSearchParams({
            fields: 'id,name,product_count,business,commerce_merchant_settings',
            access_token: accessToken
        });
        
        const catalogsResponse = await fetch(`${catalogsUrl}?${catalogsParams}`);
        
        if (catalogsResponse.ok) {
            const catalogsData = await catalogsResponse.json();
            console.log(`✅ Catálogos encontrados: ${catalogsData.data?.length || 0}`);
            
            for (const catalog of catalogsData.data || []) {
                console.log(`\n   📋 Catálogo: ${catalog.name} (ID: ${catalog.id})`);
                console.log(`      - Productos: ${catalog.product_count}`);
                
                // Verificar configuraciones específicas de cada catálogo
                await analyzeCatalogConfiguration(catalog.id, accessToken);
            }
        } else {
            const errorText = await catalogsResponse.text();
            console.log('❌ Error obteniendo catálogos:', errorText);
        }
    } catch (error) {
        console.log('❌ Excepción verificando catálogos:', error.message);
    }
    
    // 3. VERIFICAR PERMISOS DEL TOKEN
    console.log('\n🔐 3. VERIFICANDO PERMISOS DEL TOKEN:');
    console.log('-'.repeat(50));
    
    try {
        const tokenUrl = `https://graph.facebook.com/v18.0/me/permissions`;
        const tokenParams = new URLSearchParams({
            access_token: accessToken
        });
        
        const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`);
        
        if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            console.log('✅ Permisos del token:');
            
            const requiredPermissions = [
                'catalog_management',
                'business_management',
                'whatsapp_business_messaging',
                'whatsapp_business_management'
            ];
            
            const grantedPermissions = tokenData.data || [];
            
            requiredPermissions.forEach(permission => {
                const granted = grantedPermissions.find(p => p.permission === permission && p.status === 'granted');
                console.log(`   ${granted ? '✅' : '❌'} ${permission}: ${granted ? 'GRANTED' : 'NO GRANTED/MISSING'}`);
            });
            
            console.log('\n   📋 Todos los permisos:');
            grantedPermissions.forEach(perm => {
                console.log(`      - ${perm.permission}: ${perm.status}`);
            });
            
        } else {
            const errorText = await tokenResponse.text();
            console.log('❌ Error verificando permisos:', errorText);
        }
    } catch (error) {
        console.log('❌ Excepción verificando permisos:', error.message);
    }
    
    // 4. VERIFICAR CONFIGURACIÓN DE WHATSAPP BUSINESS ACCOUNT
    console.log('\n📱 4. VERIFICANDO WHATSAPP BUSINESS ACCOUNT:');
    console.log('-'.repeat(50));
    
    try {
        const wabaUrl = `https://graph.facebook.com/v18.0/${businessId}/client_whatsapp_business_accounts`;
        const wabaParams = new URLSearchParams({
            fields: 'id,name,currency,timezone,message_template_namespace,account_review_status',
            access_token: accessToken
        });
        
        const wabaResponse = await fetch(`${wabaUrl}?${wabaParams}`);
        
        if (wabaResponse.ok) {
            const wabaData = await wabaResponse.json();
            console.log(`✅ WhatsApp Business Accounts: ${wabaData.data?.length || 0}`);
            
            for (const waba of wabaData.data || []) {
                console.log(`\n   📱 WABA: ${waba.name} (ID: ${waba.id})`);
                console.log(`      - Currency: ${waba.currency || 'N/A'}`);
                console.log(`      - Timezone: ${waba.timezone || 'N/A'}`);
                console.log(`      - Template Namespace: ${waba.message_template_namespace || 'N/A'}`);
                console.log(`      - Review Status: ${waba.account_review_status || 'N/A'}`);
            }
        } else {
            const errorText = await wabaResponse.text();
            console.log('❌ Error verificando WABA:', errorText);
        }
    } catch (error) {
        console.log('❌ Excepción verificando WABA:', error.message);
    }
    
    // 5. GENERAR DIAGNÓSTICO
    console.log('\n🎯 5. DIAGNÓSTICO DEL PROBLEMA:');
    console.log('-'.repeat(50));
    
    console.log('\n📊 POSIBLES CAUSAS DEL ERROR AL VER PRODUCTOS:');
    console.log('\n🔴 A. PROBLEMAS DE CONFIGURACIÓN EN META:');
    console.log('   1. Catálogo no configurado para WhatsApp Business');
    console.log('   2. Productos no sincronizados con WhatsApp');
    console.log('   3. Configuración de Commerce Manager incompleta');
    console.log('   4. Políticas de Facebook no cumplidas');
    console.log('   5. Business Manager sin verificación completa');
    
    console.log('\n🔴 B. PROBLEMAS DE PERMISOS:');
    console.log('   1. Token sin permisos catalog_management');
    console.log('   2. Token sin permisos business_management');
    console.log('   3. App sin acceso al Business Manager');
    console.log('   4. WhatsApp Business Account no conectado correctamente');
    
    console.log('\n🔴 C. PROBLEMAS TÉCNICOS:');
    console.log('   1. Productos con errores de validación');
    console.log('   2. URLs de productos inaccesibles');
    console.log('   3. Imágenes de productos no disponibles');
    console.log('   4. Precios o currency mal configurados');
    
    console.log('\n🔍 PASOS PARA IDENTIFICAR LA CAUSA EXACTA:');
    console.log('   1. Revisar los resultados de este análisis');
    console.log('   2. Verificar en Meta Business Manager si el catálogo está conectado a WhatsApp');
    console.log('   3. Comprobar que los productos estén "Published" y "Available"');
    console.log('   4. Verificar que no hay violaciones de políticas');
    console.log('   5. Confirmar que la app tiene todos los permisos necesarios');
}

async function analyzeCatalogConfiguration(catalogId: string, accessToken: string) {
    try {
        console.log(`\n      🔍 Analizando configuración del catálogo ${catalogId}:`);
        
        // Verificar algunos productos del catálogo
        const productsUrl = `https://graph.facebook.com/v18.0/${catalogId}/products`;
        const productsParams = new URLSearchParams({
            fields: 'id,name,description,url,image_url,price,currency,availability,condition,brand,retailer_id',
            access_token: accessToken,
            limit: '5'
        });
        
        const productsResponse = await fetch(`${productsUrl}?${productsParams}`);
        
        if (productsResponse.ok) {
            const productsData = await productsResponse.json();
            const products = productsData.data || [];
            
            console.log(`         ✅ Productos analizados: ${products.length}`);
            
            let validProducts = 0;
            let problemProducts = 0;
            
            products.forEach((product, index) => {
                console.log(`\n         📦 Producto ${index + 1}:`);
                console.log(`            - ID: ${product.id}`);
                console.log(`            - Retailer ID: ${product.retailer_id || 'N/A'}`);
                console.log(`            - Nombre: ${product.name || 'N/A'}`);
                console.log(`            - Precio: ${product.price || 'N/A'} ${product.currency || ''}`);
                console.log(`            - Disponibilidad: ${product.availability || 'N/A'}`);
                console.log(`            - Condición: ${product.condition || 'N/A'}`);
                console.log(`            - URL: ${product.url ? 'Disponible' : 'Faltante'}`);
                console.log(`            - Imagen: ${product.image_url ? 'Disponible' : 'Faltante'}`);
                
                // Validar campos críticos
                const hasRequiredFields = product.name && product.price && product.availability;
                if (hasRequiredFields) {
                    validProducts++;
                    console.log(`            ✅ Producto válido`);
                } else {
                    problemProducts++;
                    console.log(`            ❌ Producto con problemas (faltan campos)`);
                }
            });
            
            console.log(`\n      📊 Resumen del catálogo:`);
            console.log(`         - Productos válidos: ${validProducts}`);
            console.log(`         - Productos con problemas: ${problemProducts}`);
            
        } else {
            const errorText = await productsResponse.text();
            console.log(`         ❌ Error obteniendo productos: ${errorText}`);
        }
        
    } catch (error) {
        console.log(`         ❌ Excepción analizando catálogo: ${error.message}`);
    }
}

analyzeProductViewError();
