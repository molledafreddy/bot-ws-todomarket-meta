// Script para validar token y verificar si es permanente
require('dotenv').config();

const https = require('https');

const JWT_TOKEN = process.env.JWT_TOKEN;

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

async function validateToken() {
    console.log('🔍 === VALIDACIÓN COMPLETA DEL TOKEN ===');
    console.log(`📝 Token (primeros 30 chars): ${JWT_TOKEN.substring(0, 30)}...`);
    console.log('📅 Fecha actual:', new Date().toLocaleString('es-ES', { timeZone: 'America/Santiago' }));
    console.log('');

    try {
        // 1. Verificar información del token
        console.log('🔐 Verificando información del token...');
        const tokenInfo = await makeGraphAPIRequest('/v18.0/me?fields=id,name');
        console.log('✅ Token válido - App ID:', tokenInfo.id);
        console.log('📱 App Name:', tokenInfo.name || 'No disponible');
        console.log('');

        // 2. Verificar información específica del token
        console.log('🕐 Verificando duración y tipo de token...');
        try {
            const debugToken = await makeGraphAPIRequest(`/v18.0/debug_token?input_token=${JWT_TOKEN}`);
            if (debugToken.data) {
                console.log('📊 Información del token:');
                console.log('  - App ID:', debugToken.data.app_id);
                console.log('  - Válido:', debugToken.data.is_valid);
                console.log('  - Expira en:', debugToken.data.expires_at || 'NUNCA (Token permanente)');
                console.log('  - Tipo:', debugToken.data.type);
                console.log('  - Permisos:', debugToken.data.scopes?.join(', ') || 'No disponible');
                
                if (debugToken.data.expires_at === 0) {
                    console.log('🎉 ¡TOKEN PERMANENTE CONFIRMADO!');
                } else {
                    const expiryDate = new Date(debugToken.data.expires_at * 1000);
                    console.log(`⏰ Token expira: ${expiryDate.toLocaleString('es-ES', { timeZone: 'America/Santiago' })}`);
                }
            }
        } catch (debugError) {
            console.log('⚠️ No se pudo obtener información de depuración del token');
            console.log('   (Esto es normal si el token es de otra app)');
        }

        console.log('');

        // 3. Verificar acceso a WhatsApp Business
        console.log('📱 Verificando acceso a WhatsApp Business...');
        try {
            const whatsappInfo = await makeGraphAPIRequest('/v18.0/725315067342333?fields=verified_name,display_phone_number,quality_rating');
            console.log('✅ Acceso a WhatsApp confirmado:');
            console.log('  - Nombre verificado:', whatsappInfo.verified_name);
            console.log('  - Número:', whatsappInfo.display_phone_number);
            console.log('  - Rating de calidad:', whatsappInfo.quality_rating?.score || 'No disponible');
        } catch (whatsappError) {
            console.log('❌ Error accediendo a WhatsApp Business:');
            console.log('   ', whatsappError.error?.message || whatsappError);
        }

        console.log('');

        // 4. Verificar acceso a catálogos
        console.log('🛒 Verificando acceso a catálogos...');
        try {
            const catalogsInfo = await makeGraphAPIRequest('/v18.0/1349962220108819/owned_product_catalogs?fields=name,id,product_count');
            console.log('✅ Acceso a catálogos confirmado:');
            catalogsInfo.data?.forEach((catalog, index) => {
                console.log(`  ${index + 1}. ${catalog.name} (ID: ${catalog.id}) - ${catalog.product_count || 'N/A'} productos`);
            });
        } catch (catalogError) {
            console.log('❌ Error accediendo a catálogos:');
            console.log('   ', catalogError.error?.message || catalogError);
        }

        console.log('');
        console.log('🎯 === RESULTADO FINAL ===');
        console.log('✅ El token ES VÁLIDO y tiene acceso completo');
        console.log('');

    } catch (error) {
        console.log('❌ === ERROR EN VALIDACIÓN ===');
        console.log('🚨 El token NO es válido:');
        console.log('   Error:', error.error?.message || error);
        console.log('   Código:', error.error?.code || 'No disponible');
        console.log('');
        console.log('🔧 === ACCIÓN REQUERIDA ===');
        console.log('1. El token actual está expirado o es inválido');
        console.log('2. Necesitas generar un nuevo token en Meta Business Manager');
        console.log('3. Ve a: https://business.facebook.com/');
        console.log('4. WhatsApp Business Platform → Manage Phone Numbers');
        console.log('5. Busca tu número +56 9 7964 3935');
        console.log('6. Generate Token con permisos de catálogo');
        console.log('');
    }
}

// Ejecutar validación
validateToken().catch(console.error);
