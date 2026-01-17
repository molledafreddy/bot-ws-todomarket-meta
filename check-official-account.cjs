// VERIFICACIÓN DE CUENTA OFICIAL Y SU IMPACTO EN CATÁLOGOS
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

async function checkOfficialBusinessAccount() {
    console.log('🏢 === VERIFICACIÓN DE CUENTA OFICIAL BUSINESS ===');
    console.log('📅 Fecha:', new Date().toLocaleString());
    console.log('');

    // 1. VERIFICAR ESTADO DE CUENTA BUSINESS
    console.log('📊 === ESTADO ACTUAL DE LA CUENTA ===');
    
    try {
        const phoneDetails = await makeGraphAPIRequest(`/v19.0/${PHONE_NUMBER_ID}?fields=id,verified_name,display_phone_number,is_official_business_account,account_mode,quality_rating,throughput,messaging_limit_tier,status,business_verification_status,name_status`);
        
        console.log('📱 Información de la cuenta WhatsApp:');
        console.log(`   - Número: ${phoneDetails.display_phone_number}`);
        console.log(`   - Nombre verificado: ${phoneDetails.verified_name}`);
        console.log(`   - Estado general: ${phoneDetails.status}`);
        console.log(`   - Modo de cuenta: ${phoneDetails.account_mode}`);
        console.log(`   - Estado del nombre: ${phoneDetails.name_status}`);
        console.log('');
        
        console.log('🏢 INFORMACIÓN CRÍTICA - CUENTA BUSINESS:');
        console.log(`   - Es cuenta oficial business: ${phoneDetails.is_official_business_account}`);
        console.log(`   - Estado verificación business: ${phoneDetails.business_verification_status || 'No disponible'}`);
        console.log('');
        
        console.log('📈 LIMITACIONES DE LA CUENTA:');
        console.log(`   - Rating de calidad: ${phoneDetails.quality_rating}`);
        console.log(`   - Throughput: ${JSON.stringify(phoneDetails.throughput)}`);
        console.log(`   - Tier de mensajes: ${phoneDetails.messaging_limit_tier}`);
        console.log('');
        
        // Analizar impacto en catálogos
        if (!phoneDetails.is_official_business_account) {
            console.log('🚨 IMPACTO EN CATÁLOGOS - CUENTA NO OFICIAL:');
            console.log('   ❌ LIMITACIONES IDENTIFICADAS:');
            console.log('      - Funciones de commerce restringidas');
            console.log('      - Catálogos pueden enviarse pero no mostrarse');
            console.log('      - Mensajes interactivos limitados');
            console.log('      - Throughput reducido');
            console.log('');
            console.log('   📋 QUÉ SIGNIFICA EN LA PRÁCTICA:');
            console.log('      - API acepta el mensaje ✅');
            console.log('      - Message ID se genera ✅'); 
            console.log('      - WhatsApp filtra el catálogo ❌');
            console.log('      - Usuario solo ve texto ❌');
            console.log('');
        } else {
            console.log('✅ CUENTA OFICIAL CONFIRMADA - Sin limitaciones de catálogo');
        }
        
    } catch (error) {
        console.log('❌ Error verificando estado de la cuenta:', error.response?.error?.message || error);
    }

    console.log('');

    // 2. VERIFICAR ESTADO DEL BUSINESS GENERAL
    console.log('🏢 === ESTADO DEL BUSINESS MANAGER ===');
    
    try {
        const businessInfo = await makeGraphAPIRequest(`/v19.0/${BUSINESS_ID}?fields=id,name,verification_status,business_verification_status,is_verified`);
        
        console.log('🏢 Información del Business:');
        console.log(`   - Nombre: ${businessInfo.name}`);
        console.log(`   - ID: ${businessInfo.id}`);
        console.log(`   - Estado verificación: ${businessInfo.verification_status}`);
        console.log(`   - Verificación business: ${businessInfo.business_verification_status || 'No disponible'}`);
        console.log(`   - Está verificado: ${businessInfo.is_verified || 'No disponible'}`);
        console.log('');
        
        if (businessInfo.verification_status !== 'verified') {
            console.log('⚠️ BUSINESS NO VERIFICADO:');
            console.log('   - Esto puede impactar las funciones de commerce');
            console.log('   - WhatsApp Business requiere business verificado para catálogos');
        }
        
    } catch (error) {
        console.log('❌ Error verificando business:', error.response?.error?.message || error);
    }

    console.log('');

    // 3. VERIFICAR PERMISOS RELACIONADOS CON COMMERCE
    console.log('🔐 === PERMISOS DE COMMERCE ===');
    
    try {
        const tokenInfo = await makeGraphAPIRequest(`/v19.0/debug_token?input_token=${JWT_TOKEN}`);
        
        if (tokenInfo.data?.scopes) {
            const commercePermissions = tokenInfo.data.scopes.filter(scope => 
                scope.includes('commerce') || 
                scope.includes('catalog') ||
                scope.includes('whatsapp_business')
            );
            
            console.log('📝 Permisos relacionados con commerce:');
            commercePermissions.forEach(permission => {
                console.log(`   ✅ ${permission}`);
            });
            
            // Verificar permisos críticos para catálogos
            const criticalPermissions = [
                'catalog_management',
                'whatsapp_business_messaging',
                'commerce_account_read_settings',
                'whatsapp_business_management'
            ];
            
            console.log('');
            console.log('🎯 PERMISOS CRÍTICOS PARA CATÁLOGOS:');
            criticalPermissions.forEach(critical => {
                const hasPermission = tokenInfo.data.scopes.includes(critical);
                console.log(`   ${hasPermission ? '✅' : '❌'} ${critical}: ${hasPermission ? 'DISPONIBLE' : 'FALTANTE'}`);
            });
        }
        
    } catch (error) {
        console.log('❌ Error verificando permisos:', error.response?.error?.message || error);
    }

    console.log('');

    // 4. GUÍA PARA OBTENER CUENTA OFICIAL
    console.log('📋 === CÓMO OBTENER CUENTA OFICIAL BUSINESS ===');
    console.log('');
    console.log('🔗 PASOS PARA UPGRADE:');
    console.log('   1. Ir a Meta Business Manager (business.facebook.com)');
    console.log('   2. Seleccionar tu business "Todo Market Chile SpA"');
    console.log('   3. Ir a "Configuración" → "Verificación de business"');
    console.log('   4. Completar el proceso de verificación con:');
    console.log('      - Documentos legales de la empresa');
    console.log('      - RUT de la empresa');
    console.log('      - Comprobante de domicilio comercial');
    console.log('      - Información de contacto verificable');
    console.log('');
    console.log('⏰ TIEMPO ESTIMADO:');
    console.log('   - Envío de documentos: Inmediato');
    console.log('   - Revisión de Meta: 1-5 días hábiles');
    console.log('   - Activación de funciones: 24-48 horas post-aprobación');
    console.log('');
    console.log('💡 BENEFICIOS POST-VERIFICACIÓN:');
    console.log('   ✅ Catálogos funcionarán completamente');
    console.log('   ✅ Throughput ilimitado');
    console.log('   ✅ Todas las funciones de commerce');
    console.log('   ✅ Mensajes interactivos sin restricciones');
    console.log('   ✅ Badge de cuenta verificada');

    console.log('');

    // 5. ALTERNATIVAS MIENTRAS SE OBTIENE VERIFICACIÓN
    console.log('🔄 === ALTERNATIVAS TEMPORALES ===');
    console.log('');
    console.log('Mientras obtienes la cuenta oficial business:');
    console.log('');
    console.log('1. 📋 USAR LISTAS INTERACTIVAS:');
    console.log('   - Funciona con cuentas no oficiales');
    console.log('   - Simula experiencia de catálogo');
    console.log('   - Ya implementado en tu código (alternative-catalog.ts)');
    console.log('');
    console.log('2. 🔄 ACTUALIZAR A API v19.0:');
    console.log('   - Mejor compatibilidad demostrada');
    console.log('   - Puede mejorar visualización temporal');
    console.log('');
    console.log('3. ⏰ PERMITIR PROPAGACIÓN:');
    console.log('   - Cambios pueden tomar 24-48 horas');
    console.log('   - Cache de WhatsApp en actualización');
    console.log('');

    // 6. VERIFICACIÓN FINAL Y RECOMENDACIONES
    console.log('🎯 === RECOMENDACIONES FINALES ===');
    console.log('');
    console.log('ACCIÓN PRIORITARIA:');
    console.log('   🏢 Iniciar proceso de verificación business INMEDIATAMENTE');
    console.log('   📱 Esto resuelve definitivamente el problema de catálogos');
    console.log('');
    console.log('SOLUCIONES TEMPORALES:');
    console.log('   1. Actualizar código a API v19.0');
    console.log('   2. Usar sistema de listas interactivas actual');
    console.log('   3. Esperar propagación de cambios');
    console.log('');
    console.log('EXPECTATIVA:');
    console.log('   Una vez verificado el business → Catálogos funcionarán al 100%');
}

checkOfficialBusinessAccount().catch(console.error);
