// ANÁLISIS AVANZADO - OTRAS CAUSAS DEL PROBLEMA DE CATÁLOGO
require('dotenv').config();

const https = require('https');

const JWT_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID;
const BUSINESS_ID = "1349962220108819";

function makeGraphAPIRequest(endpoint, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.facebook.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(response);
                    } else {
                        reject({ statusCode: res.statusCode, response });
                    }
                } catch (error) {
                    reject({ error: 'Invalid JSON response', data, statusCode: res.statusCode });
                }
            });
        });

        req.on('error', (error) => reject({ error: error.message }));
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        
        req.end();
    });
}

async function advancedCatalogAnalysis() {
    console.log('🔬 === ANÁLISIS AVANZADO DEL PROBLEMA DE CATÁLOGO ===');
    console.log('📅 Fecha:', new Date().toLocaleString());
    console.log('');
    console.log('🎯 PREMISA: Catálogo activado y relacionado al número');
    console.log('🎯 PREMISA: Productos con imágenes y precios correctos');
    console.log('🎯 OBJETIVO: Encontrar otras causas del problema');
    console.log('');

    // 1. ANÁLISIS DETALLADO DE PRODUCTOS ESPECÍFICOS
    console.log('📦 === 1. ANÁLISIS DETALLADO DE PRODUCTOS ===');
    
    const catalogId = '817382327367357'; // Catálogo principal con 2 productos
    
    try {
        const products = await makeGraphAPIRequest(`/v18.0/${catalogId}/products?fields=id,name,price,currency,image_url,url,availability,visibility,description,retailer_id,brand,condition,review_status,commerce_insights`);
        
        console.log('🛒 Productos encontrados:', products.data?.length || 0);
        console.log('');
        
        for (const product of products.data || []) {
            console.log(`📱 PRODUCTO: ${product.name}`);
            console.log(`   - ID: ${product.id}`);
            console.log(`   - Retailer ID: ${product.retailer_id}`);
            console.log(`   - Precio: ${product.price} ${product.currency}`);
            console.log(`   - Disponibilidad: ${product.availability}`);
            console.log(`   - Visibilidad: ${product.visibility}`);
            console.log(`   - Estado review: ${product.review_status}`);
            console.log(`   - Condición: ${product.condition}`);
            console.log(`   - Imagen URL: ${product.image_url}`);
            console.log(`   - URL producto: ${product.url || 'No configurada'}`);
            console.log(`   - Marca: ${product.brand || 'No configurada'}`);
            console.log(`   - Descripción: ${product.description ? 'Configurada' : 'No configurada'}`);
            
            // Verificar si la imagen es accesible
            if (product.image_url) {
                try {
                    const imageCheck = await checkImageURL(product.image_url);
                    console.log(`   - Estado imagen: ${imageCheck}`);
                } catch (imgError) {
                    console.log(`   ❌ Error verificando imagen: ${imgError}`);
                }
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.log('❌ Error obteniendo productos detallados:', error.response?.error?.message || error);
    }

    // 2. VERIFICAR LIMITACIONES DEL NÚMERO WHATSAPP
    console.log('📱 === 2. LIMITACIONES DEL NÚMERO WHATSAPP ===');
    
    try {
        const phoneDetails = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}?fields=id,verified_name,code_verification_status,display_phone_number,quality_rating,throughput,messaging_limit_tier,is_official_business_account,account_mode,status,name_status`);
        
        console.log('📊 Estado detallado del número:');
        console.log('   - Nombre verificado:', phoneDetails.verified_name);
        console.log('   - Estado verificación:', phoneDetails.code_verification_status);
        console.log('   - Rating calidad:', phoneDetails.quality_rating);
        console.log('   - Throughput:', JSON.stringify(phoneDetails.throughput));
        console.log('   - Tier de messaging:', phoneDetails.messaging_limit_tier);
        console.log('   - Cuenta oficial business:', phoneDetails.is_official_business_account);
        console.log('   - Modo cuenta:', phoneDetails.account_mode);
        console.log('   - Estado general:', phoneDetails.status);
        console.log('   - Estado nombre:', phoneDetails.name_status);
        
        // Verificar limitaciones críticas
        if (!phoneDetails.is_official_business_account) {
            console.log('⚠️ LIMITACIÓN CRÍTICA: Cuenta no es oficial business');
            console.log('   - Impacto: Funciones de commerce limitadas o deshabilitadas');
            console.log('   - Solución: Proceso de verificación business oficial');
        }
        
        if (phoneDetails.throughput?.level === 'STANDARD') {
            console.log('⚠️ LIMITACIÓN: Throughput en nivel STANDARD');
            console.log('   - Impacto: Limitaciones en mensajes interactivos avanzados');
        }
        
        if (phoneDetails.quality_rating !== 'GREEN') {
            console.log('⚠️ LIMITACIÓN: Rating de calidad no es GREEN');
            console.log('   - Impacto: Funciones avanzadas pueden estar limitadas');
        }
        
    } catch (error) {
        console.log('❌ Error verificando detalles del número:', error.response?.error?.message || error);
    }

    console.log('');

    // 3. VERIFICAR WEBHOOKS Y CONFIGURACIÓN
    console.log('🔗 === 3. VERIFICACIÓN DE WEBHOOKS Y CONFIGURACIÓN ===');
    
    try {
        // Verificar configuración de aplicación
        const appInfo = await makeGraphAPIRequest(`/v18.0/1542683137156779?fields=name,category,company,privacy_policy_url,terms_of_service_url,app_domains,whitelisted_domains`);
        
        console.log('📱 Información de la aplicación:');
        console.log('   - Nombre:', appInfo.name);
        console.log('   - Categoría:', appInfo.category);
        console.log('   - Compañía:', appInfo.company);
        console.log('   - Dominios whitelisted:', appInfo.whitelisted_domains);
        console.log('   - Dominios app:', appInfo.app_domains);
        
    } catch (error) {
        console.log('❌ Error verificando configuración de app:', error.response?.error?.message || error);
    }

    // 4. PROBAR DIFERENTES VERSIONES DE API Y FORMATOS
    console.log('');
    console.log('🔄 === 4. PRUEBAS CON DIFERENTES VERSIONES Y FORMATOS ===');
    
    const testConfigurations = [
        {
            name: "API v19.0 - Formato básico",
            version: "v19.0",
            payload: {
                messaging_product: "whatsapp",
                to: "+56973649990",
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: { text: "🧪 Prueba v19.0" },
                    action: { name: "catalog_message" }
                }
            }
        },
        {
            name: "API v18.0 - Con header",
            version: "v18.0",
            payload: {
                messaging_product: "whatsapp",
                to: "+56973649990",
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    header: { type: "text", text: "Nuestros Productos" },
                    body: { text: "🧪 Prueba con header" },
                    action: { name: "catalog_message" }
                }
            }
        },
        {
            name: "API v18.0 - Con footer",
            version: "v18.0",
            payload: {
                messaging_product: "whatsapp",
                to: "+56973649990",
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: { text: "🧪 Prueba con footer" },
                    footer: { text: "TodoMarket - Selecciona productos" },
                    action: { name: "catalog_message" }
                }
            }
        }
    ];
    
    for (const config of testConfigurations) {
        try {
            console.log(`🧪 Probando: ${config.name}...`);
            
            const result = await makeGraphAPIRequest(`/${config.version}/${PHONE_NUMBER_ID}/messages`, 'POST', config.payload);
            console.log(`   ✅ ÉXITO: Message ID ${result.messages[0].id}`);
            
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.response?.error?.message || error.error}`);
            if (error.response?.error?.error_data) {
                console.log(`   📝 Detalles: ${JSON.stringify(error.response.error.error_data)}`);
            }
        }
    }

    console.log('');

    // 5. ANÁLISIS DE CONFIGURACIÓN DE BUSINESS
    console.log('🏢 === 5. ANÁLISIS DE CONFIGURACIÓN DE BUSINESS ===');
    
    try {
        const businessInfo = await makeGraphAPIRequest(`/v18.0/${BUSINESS_ID}?fields=name,id,verification_status,country_page_likes,timezone_id,website`);
        
        console.log('🏢 Business configuration:');
        console.log('   - Nombre:', businessInfo.name);
        console.log('   - Estado verificación:', businessInfo.verification_status);
        console.log('   - Timezone:', businessInfo.timezone_id);
        console.log('   - Website:', businessInfo.website);
        console.log('   - País:', businessInfo.country_page_likes);
        
        // Verificar si está configurado para Chile
        const isChileConfig = businessInfo.timezone_id?.includes('Chile') || 
                            businessInfo.timezone_id?.includes('Santiago') ||
                            businessInfo.country_page_likes === 'CL';
        
        if (isChileConfig) {
            console.log('✅ Configuración regional para Chile detectada');
        } else {
            console.log('⚠️ Verificar configuración regional - puede afectar commerce');
        }
        
    } catch (error) {
        console.log('❌ Error verificando configuración de business:', error.response?.error?.message || error);
    }

    // 6. DIAGNÓSTICO FINAL Y RECOMENDACIONES
    console.log('');
    console.log('🎯 === DIAGNÓSTICO ESPECÍFICO Y SIGUIENTES PASOS ===');
    console.log('');
    console.log('🔍 POSIBLES CAUSAS ADICIONALES IDENTIFICADAS:');
    console.log('');
    console.log('1. 🏢 CUENTA NO OFICIAL BUSINESS:');
    console.log('   - Limitación principal para funciones de commerce');
    console.log('   - WhatsApp puede bloquear catálogos en cuentas no oficiales');
    console.log('   - Solución: Proceso de verificación business oficial');
    console.log('');
    console.log('2. 📱 VERSIÓN DE API:');
    console.log('   - v18.0 puede tener limitaciones regionales');
    console.log('   - Probar con v19.0 o v20.0');
    console.log('');
    console.log('3. ⚙️ CONFIGURACIÓN REGIONAL:');
    console.log('   - Timezone y configuración de país');
    console.log('   - Commerce puede tener restricciones regionales');
    console.log('');
    console.log('4. 📊 ESTADO DE PRODUCTOS:');
    console.log('   - Review status de productos individuales');
    console.log('   - Accesibilidad de imágenes desde servidores de WhatsApp');
    console.log('');
    console.log('🚀 PRÓXIMOS PASOS RECOMENDADOS:');
    console.log('1. Verificar review status detallado de productos');
    console.log('2. Probar upgrade de cuenta a Business Official');
    console.log('3. Probar API v19.0+ con diferentes formatos');
    console.log('4. Verificar configuración regional del business');
}

// Función auxiliar para verificar URLs de imágenes
function checkImageURL(url) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                method: 'HEAD'
            };

            const req = https.request(options, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(`✅ Accesible (${res.statusCode})`);
                } else {
                    resolve(`❌ Error HTTP ${res.statusCode}`);
                }
            });

            req.on('error', () => resolve('❌ No accesible'));
            req.setTimeout(5000, () => resolve('⏱️ Timeout'));
            req.end();
        } catch (error) {
            resolve('❌ URL inválida');
        }
    });
}

advancedCatalogAnalysis().catch(console.error);
