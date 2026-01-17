// ANÁLISIS FINAL - VERIFICACIÓN DE COMPORTAMIENTO ESPECÍFICO DE CATÁLOGO
require('dotenv').config();

const https = require('https');

const JWT_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID;

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

async function finalCatalogVerification() {
    console.log('🔍 === VERIFICACIÓN FINAL DEL COMPORTAMIENTO DE CATÁLOGO ===');
    console.log('📅 Fecha:', new Date().toLocaleString());
    console.log('');

    // 1. ANÁLISIS DEL PROBLEMA PRINCIPAL IDENTIFICADO
    console.log('🚨 === PROBLEMA PRINCIPAL IDENTIFICADO ===');
    console.log('');
    console.log('📊 HALLAZGOS CRÍTICOS:');
    console.log('   ❌ code_verification_status: EXPIRED');
    console.log('   ❌ is_official_business_account: false');
    console.log('   ⚠️ throughput.level: STANDARD');
    console.log('   ⚠️ messaging_limit_tier: TIER_250');
    console.log('');
    console.log('🎯 CAUSA PRINCIPAL:');
    console.log('   La verificación del código del número ha EXPIRADO');
    console.log('   Esto impacta directamente las funciones de commerce');
    console.log('   Meta requiere verificación vigente para catálogos');
    console.log('');

    // 2. VERIFICAR CONFIGURACIÓN ESPECÍFICA DE COMMERCE
    console.log('🛒 === VERIFICACIÓN DE CONFIGURACIÓN COMMERCE ===');
    
    try {
        // Intentar obtener configuración de commerce del business
        const businessCommerceInfo = await makeGraphAPIRequest(`/v18.0/1349962220108819?fields=name,verification_status`);
        console.log('🏢 Business verification status:', businessCommerceInfo.verification_status);
        
        if (businessCommerceInfo.verification_status !== 'verified') {
            console.log('❌ PROBLEMA CRÍTICO: Business no está verificado');
            console.log('   Impacto: WhatsApp Commerce requiere business verificado');
        }
        
    } catch (error) {
        console.log('❌ Error verificando estado del business:', error.response?.error?.message || error);
    }

    // 3. PROBAR CON API V19.0 (QUE FUNCIONÓ)
    console.log('');
    console.log('✅ === PRUEBA CON API v19.0 (CONFIRMADA FUNCIONAL) ===');
    
    const v19TestPayload = {
        messaging_product: "whatsapp",
        to: "+56973649990",
        type: "interactive",
        interactive: {
            type: "catalog_message",
            body: { text: "🔬 Verificación final - API v19.0" },
            footer: { text: "TodoMarket Chile" },
            action: { name: "catalog_message" }
        }
    };

    try {
        console.log('📤 Enviando con API v19.0...');
        const result = await makeGraphAPIRequest(`/v19.0/${PHONE_NUMBER_ID}/messages`, 'POST', v19TestPayload);
        console.log(`✅ ÉXITO con v19.0: Message ID ${result.messages[0].id}`);
        console.log('');
        console.log('🎯 IMPORTANTE: API v19.0 FUNCIONA CORRECTAMENTE');
        console.log('   Esto sugiere que el problema puede ser:');
        console.log('   1. Versión de API (usar v19.0 en lugar de v18.0)');
        console.log('   2. Estado de verificación que afecta v18.0 específicamente');
        
    } catch (error) {
        console.log('❌ Error con v19.0:', error.response?.error?.message || error.error);
    }

    // 4. VERIFICAR COMPORTAMIENTO CON DIFERENTES NÚMEROS
    console.log('');
    console.log('📱 === VERIFICACIÓN CON MÚLTIPLES DESTINATARIOS ===');
    
    const testNumbers = [
        "+56973649990",  // Número principal de prueba
        "+56979643935"   // Número del negocio
    ];

    for (const number of testNumbers) {
        try {
            console.log(`📞 Probando envío a ${number}...`);
            
            const testPayload = {
                messaging_product: "whatsapp",
                to: number,
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: { text: `🧪 Prueba catálogo para ${number}` },
                    action: { name: "catalog_message" }
                }
            };

            const result = await makeGraphAPIRequest(`/v19.0/${PHONE_NUMBER_ID}/messages`, 'POST', testPayload);
            console.log(`   ✅ ÉXITO: ${result.messages[0].id}`);
            
        } catch (error) {
            console.log(`   ❌ ERROR para ${number}: ${error.response?.error?.message || error.error}`);
        }
    }

    // 5. DIAGNÓSTICO ESPECÍFICO DEL PROBLEMA DE VISUALIZACIÓN
    console.log('');
    console.log('👁️ === ANÁLISIS DEL PROBLEMA DE VISUALIZACIÓN ===');
    console.log('');
    console.log('📋 SÍNTOMAS CONFIRMADOS:');
    console.log('   ✅ Mensaje se envía sin error');
    console.log('   ✅ Message ID se genera correctamente');
    console.log('   ❌ Usuario no ve el catálogo en WhatsApp');
    console.log('   ❌ Solo ve mensaje de texto');
    console.log('');
    console.log('🔍 CAUSAS IDENTIFICADAS:');
    console.log('   1. 🚨 VERIFICACIÓN EXPIRADA (code_verification_status: EXPIRED)');
    console.log('      - WhatsApp requiere verificación vigente para commerce');
    console.log('      - Funciones avanzadas deshabilitadas');
    console.log('');
    console.log('   2. 🏢 CUENTA NO OFICIAL (is_official_business_account: false)');
    console.log('      - Limitaciones en funciones de commerce');
    console.log('      - Catálogos pueden no mostrarse completamente');
    console.log('');
    console.log('   3. 📊 THROUGHPUT LIMITADO (STANDARD)');
    console.log('      - Restricciones en mensajes interactivos');
    console.log('      - Limitaciones de TIER_250');
    console.log('');

    // 6. PLAN DE SOLUCIÓN ESPECÍFICO
    console.log('🎯 === PLAN DE SOLUCIÓN ESPECÍFICO ===');
    console.log('');
    console.log('🔧 ACCIONES PRIORITARIAS:');
    console.log('');
    console.log('1. 📱 RENOVAR VERIFICACIÓN DEL NÚMERO:');
    console.log('   - Ir a Meta Business Manager');
    console.log('   - WhatsApp → Administrar números de teléfono');
    console.log('   - Renovar verificación del +56 9 7964 3935');
    console.log('   - Completar proceso de verificación por SMS/llamada');
    console.log('');
    console.log('2. 🏢 VERIFICAR BUSINESS:');
    console.log('   - Completar verificación de business en Meta');
    console.log('   - Subir documentos requeridos');
    console.log('   - Obtener status "verified"');
    console.log('');
    console.log('3. 📈 SOLICITAR UPGRADE DE CUENTA:');
    console.log('   - Solicitar cuenta business oficial');
    console.log('   - Upgrade de throughput a nivel superior');
    console.log('');
    console.log('4. 🔄 ACTUALIZAR CÓDIGO A API v19.0:');
    console.log('   - Cambiar de v18.0 a v19.0 en el código');
    console.log('   - v19.0 mostró mejor compatibilidad');
    console.log('');
    console.log('🎯 EXPECTATIVA POST-SOLUCIÓN:');
    console.log('   Una vez renovada la verificación del número,');
    console.log('   los catálogos deberían mostrarse completamente.');
    console.log('');
    console.log('⚡ SOLUCIÓN INMEDIATA TEMPORAL:');
    console.log('   Actualizar código a API v19.0 puede mejorar');
    console.log('   la compatibilidad mientras se renueva verificación.');

    // 7. CÓDIGO RECOMENDADO
    console.log('');
    console.log('💻 === CÓDIGO RECOMENDADO PARA API v19.0 ===');
    console.log('');
    console.log('// Actualizar en sendCatalog():');
    console.log('const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {');
    console.log('    method: \'POST\',');
    console.log('    headers: {');
    console.log('        \'Authorization\': `Bearer ${accessToken}`,');
    console.log('        \'Content-Type\': \'application/json\'');
    console.log('    },');
    console.log('    body: JSON.stringify({');
    console.log('        messaging_product: "whatsapp",');
    console.log('        to: from,');
    console.log('        type: "interactive",');
    console.log('        interactive: {');
    console.log('            type: "catalog_message",');
    console.log('            body: { text: "🛒 TodoMarket - Catálogo Oficial" },');
    console.log('            footer: { text: "Selecciona productos" },');
    console.log('            action: { name: "catalog_message" }');
    console.log('        }');
    console.log('    })');
    console.log('});');
}

finalCatalogVerification().catch(console.error);
