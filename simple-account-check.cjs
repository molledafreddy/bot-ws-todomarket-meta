// VERIFICACIÓN SIMPLE DEL ESTADO DE CUENTA OFICIAL
require('dotenv').config();

const https = require('https');
const JWT_TOKEN = process.env.JWT_TOKEN;
const PHONE_NUMBER_ID = process.env.NUMBER_ID;

function makeGraphAPIRequest(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'graph.facebook.com',
            path: endpoint,
            method: 'GET',
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
                    if (res.statusCode === 200) {
                        resolve(response);
                    } else {
                        reject(response);
                    }
                } catch (error) {
                    reject({ error: 'Invalid JSON response', data });
                }
            });
        });

        req.on('error', (error) => reject({ error: error.message }));
        req.end();
    });
}

async function simpleAccountCheck() {
    console.log('🔍 === VERIFICACIÓN SIMPLE DE CUENTA OFICIAL ===\n');

    try {
        // Verificar información básica de la cuenta
        const phoneInfo = await makeGraphAPIRequest(`/v18.0/${PHONE_NUMBER_ID}?fields=verified_name,display_phone_number,quality_rating,is_official_business_account,throughput,messaging_limit_tier,account_mode`);
        
        console.log('📱 INFORMACIÓN DE TU CUENTA WHATSAPP:');
        console.log(`   Nombre: ${phoneInfo.verified_name}`);
        console.log(`   Número: ${phoneInfo.display_phone_number}`);
        console.log(`   Calidad: ${phoneInfo.quality_rating}`);
        console.log(`   Modo: ${phoneInfo.account_mode}`);
        console.log('');
        
        console.log('🏢 ESTADO DE CUENTA BUSINESS:');
        console.log(`   ¿Es cuenta oficial business?: ${phoneInfo.is_official_business_account ? '✅ SÍ' : '❌ NO'}`);
        console.log(`   Throughput: ${phoneInfo.throughput?.level || 'No disponible'}`);
        console.log(`   Límite de mensajes: ${phoneInfo.messaging_limit_tier || 'No disponible'}`);
        console.log('');
        
        if (!phoneInfo.is_official_business_account) {
            console.log('🚨 PROBLEMA IDENTIFICADO:');
            console.log('   ❌ Tu cuenta NO es una cuenta oficial business');
            console.log('   ❌ Esto LIMITA las funciones de catálogo');
            console.log('');
            console.log('📋 CÓMO ESTO AFECTA EL CATÁLOGO:');
            console.log('   1. WhatsApp acepta el mensaje ✅');
            console.log('   2. Se genera el Message ID ✅');  
            console.log('   3. WhatsApp FILTRA el contenido interactivo ❌');
            console.log('   4. El usuario solo ve texto simple ❌');
            console.log('');
            console.log('🔧 DÓNDE VERIFICAR EN META BUSINESS MANAGER:');
            console.log('   1. Ve a: https://business.facebook.com/');
            console.log('   2. Selecciona: "Todo Market Chile SpA"');
            console.log('   3. Ve a: Configuración → Verificación de business');
            console.log('   4. Estado actual: Probablemente "No verificado" o "Pendiente"');
            console.log('');
            console.log('✅ CÓMO CONVERTIRLA EN CUENTA OFICIAL:');
            console.log('   1. En Meta Business Manager → Verificación');
            console.log('   2. Sube documentos de la empresa:');
            console.log('      - RUT de empresa');
            console.log('      - Comprobante de domicilio comercial');
            console.log('      - Documento constitución de empresa');
            console.log('   3. Completa información comercial');
            console.log('   4. Espera aprobación (1-5 días)');
            console.log('');
            console.log('⚡ SOLUCIÓN TEMPORAL:');
            console.log('   Mientras tanto, usa el sistema de listas interactivas');
            console.log('   que ya tienes implementado en alternative-catalog.ts');
        } else {
            console.log('✅ CUENTA OFICIAL CONFIRMADA');
            console.log('   El problema del catálogo debe ser otra causa.');
        }
        
    } catch (error) {
        console.log('❌ Error verificando cuenta:', error.error?.message || error);
    }
}

simpleAccountCheck();
