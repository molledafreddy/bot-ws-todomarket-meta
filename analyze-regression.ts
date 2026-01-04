// Análisis especializado: Catálogo funcionaba antes, ahora falló sin cambios de código
import { config } from 'dotenv';

config();

async function analyzeRegressionIssue() {
    console.log('🔥 ANÁLISIS ESPECIALIZADO: REGRESIÓN EN CATÁLOGO META');
    console.log('📋 ESCENARIO: Funcionaba antes → Dejó de funcionar SIN cambios de código');
    console.log('=' .repeat(80));
    
    const accessToken = process.env.JWT_TOKEN;
    const numberId = process.env.NUMBER_ID;
    const businessId = '1349962220108819';
    
    // 1. VERIFICAR ESTADO ACTUAL DEL WHATSAPP BUSINESS ACCOUNT
    console.log('\n🔍 1. DIAGNÓSTICO DE WHATSAPP BUSINESS ACCOUNT:');
    console.log('-'.repeat(60));
    
    try {
        // Método alternativo para encontrar WABA
        const phoneUrl = `https://graph.facebook.com/v18.0/${numberId}`;
        const phoneParams = new URLSearchParams({
            fields: 'id,verified_name,display_phone_number,whatsapp_business_account_id',
            access_token: accessToken
        });
        
        console.log('📱 Buscando WABA desde el número de teléfono...');
        const phoneResponse = await fetch(`${phoneUrl}?${phoneParams}`);
        
        if (phoneResponse.ok) {
            const phoneData = await phoneResponse.json();
            console.log('✅ Información del número:');
            console.log(`   - Phone ID: ${phoneData.id}`);
            console.log(`   - Nombre: ${phoneData.verified_name}`);
            console.log(`   - Display: ${phoneData.display_phone_number}`);
            
            // Importante: Verificar si hay WABA ID
            if (phoneData.whatsapp_business_account_id) {
                console.log(`   - WABA ID: ${phoneData.whatsapp_business_account_id}`);
                await analyzeWABA(phoneData.whatsapp_business_account_id, accessToken);
            } else {
                console.log('   ❌ NO HAY WABA ID - PROBLEMA DETECTADO');
                console.log('   📊 DIAGNÓSTICO: El teléfono NO está asociado a WhatsApp Business Account');
            }
        } else {
            const errorText = await phoneResponse.text();
            console.log('❌ Error obteniendo info del número:', errorText);
        }
    } catch (error) {
        console.log('❌ Excepción:', error.message);
    }
    
    // 2. VERIFICAR POLÍTICAS Y RESTRICCIONES
    console.log('\n⚖️ 2. VERIFICANDO POLÍTICAS Y RESTRICCIONES:');
    console.log('-'.repeat(60));
    
    try {
        // Verificar si hay restricciones en el business
        const businessUrl = `https://graph.facebook.com/v18.0/${businessId}`;
        const businessParams = new URLSearchParams({
            fields: 'id,name,verification_status,business_status,restriction_info',
            access_token: accessToken
        });
        
        const businessResponse = await fetch(`${businessUrl}?${businessParams}`);
        
        if (businessResponse.ok) {
            const businessData = await businessResponse.json();
            console.log('📊 Estado del Business:');
            console.log(`   - ID: ${businessData.id}`);
            console.log(`   - Nombre: ${businessData.name || 'N/A'}`);
            console.log(`   - Estado verificación: ${businessData.verification_status || 'N/A'}`);
            console.log(`   - Estado business: ${businessData.business_status || 'N/A'}`);
            
            if (businessData.restriction_info) {
                console.log('⚠️ RESTRICCIONES DETECTADAS:');
                console.log(JSON.stringify(businessData.restriction_info, null, 4));
            } else {
                console.log('✅ No hay restricciones aparentes');
            }
        }
    } catch (error) {
        console.log('❌ Error verificando políticas:', error.message);
    }
    
    // 3. VERIFICAR CAMBIOS EN LAS APIS DE META
    console.log('\n🔄 3. VERIFICANDO CAMBIOS EN APIS DE META:');
    console.log('-'.repeat(60));
    
    console.log('📋 Verificando versión de API y cambios recientes...');
    
    try {
        // Probar diferentes versiones de API
        const versions = ['v18.0', 'v19.0', 'v20.0'];
        
        for (const version of versions) {
            console.log(`\n   🧪 Probando API ${version}:`);
            
            const testUrl = `https://graph.facebook.com/${version}/${numberId}`;
            const testParams = new URLSearchParams({
                fields: 'id,verified_name',
                access_token: accessToken
            });
            
            const testResponse = await fetch(`${testUrl}?${testParams}`);
            
            if (testResponse.ok) {
                console.log(`      ✅ ${version}: Funcional`);
            } else {
                const errorText = await testResponse.text();
                console.log(`      ❌ ${version}: ${errorText.substring(0, 100)}...`);
            }
        }
    } catch (error) {
        console.log('❌ Error probando versiones API:', error.message);
    }
    
    // 4. ANÁLISIS DE CAUSAS TÍPICAS DE REGRESIÓN
    console.log('\n🎯 4. ANÁLISIS DE CAUSAS DE REGRESIÓN:');
    console.log('-'.repeat(60));
    
    console.log('\n🔴 POSIBLES CAUSAS (SIN CAMBIO DE CÓDIGO):');
    
    console.log('\n📊 A. CAMBIOS DEL LADO DE META:');
    console.log('   1. ❌ Actualización de API que rompió compatibilidad');
    console.log('   2. ❌ Cambio en políticas de WhatsApp Business');
    console.log('   3. ❌ Migración forzada de versión de API');
    console.log('   4. ❌ Actualización en el Commerce Manager');
    console.log('   5. ❌ Cambios en requerimientos de verificación');
    
    console.log('\n🔐 B. PROBLEMAS DE CUENTA/PERMISOS:');
    console.log('   6. ❌ Token expirado o revocado');
    console.log('   7. ❌ Cuenta suspendida temporalmente');
    console.log('   8. ❌ WhatsApp Business desvinculado del Business Manager');
    console.log('   9. ❌ Cambios en los permisos de la app');
    console.log('   10. ❌ Verificación de negocio vencida');
    
    console.log('\n⚖️ C. VIOLACIONES DE POLÍTICA:');
    console.log('   11. ❌ Contenido de catálogo flaggeado');
    console.log('   12. ❌ Demasiados mensajes/spam detectado');
    console.log('   13. ❌ Productos que violan políticas de commerce');
    console.log('   14. ❌ Reportes de usuarios');
    
    console.log('\n🔧 D. PROBLEMAS DE CONFIGURACIÓN AUTOMÁTICA:');
    console.log('   15. ❌ Catálogo desconectado automáticamente');
    console.log('   16. ❌ Configuración de webhook cambiada');
    console.log('   17. ❌ Certificados SSL vencidos (lado Meta)');
    
    // 5. PRUEBA ESPECÍFICA DE REGRESIÓN
    console.log('\n🧪 5. PRUEBA ESPECÍFICA DE CATÁLOGO:');
    console.log('-'.repeat(60));
    
    await testCatalogRegression(accessToken, numberId);
    
    // 6. RECOMENDACIONES ESPECÍFICAS
    console.log('\n🎯 6. PLAN DE ACCIÓN PARA REGRESIÓN:');
    console.log('-'.repeat(60));
    
    console.log('\n🔥 ACCIONES INMEDIATAS:');
    console.log('   1. 🔍 Verificar Meta Business Manager → Commerce → WhatsApp');
    console.log('   2. 📱 Re-conectar WhatsApp Business Account si está desconectado');
    console.log('   3. 🔄 Revisar notificaciones de Meta (emails recientes)');
    console.log('   4. ⚖️ Verificar compliance en Business Manager');
    console.log('   5. 🔐 Regenerar access token si está próximo a vencer');
    
    console.log('\n🛠️ VALIDACIONES TÉCNICAS:');
    console.log('   1. Probar con webhook de prueba');
    console.log('   2. Verificar logs del Business Manager');
    console.log('   3. Contactar soporte de Meta si no hay causa aparente');
    console.log('   4. Implementar fallback robusto mientras se resuelve');
    
    console.log('\n📈 PREVENCIÓN FUTURA:');
    console.log('   1. Monitoreo automático de estado de catálogo');
    console.log('   2. Alertas por cambios en API de Meta');
    console.log('   3. Backup de configuraciones críticas');
    console.log('   4. Documentación de configuración funcional');
}

async function analyzeWABA(wabaId: string, accessToken: string) {
    try {
        console.log(`\n📱 Analizando WABA: ${wabaId}`);
        
        const wabaUrl = `https://graph.facebook.com/v18.0/${wabaId}`;
        const wabaParams = new URLSearchParams({
            fields: 'id,name,account_review_status,currency,message_template_namespace,business_profile',
            access_token: accessToken
        });
        
        const wabaResponse = await fetch(`${wabaUrl}?${wabaParams}`);
        
        if (wabaResponse.ok) {
            const wabaData = await wabaResponse.json();
            console.log('✅ Detalles WABA:');
            console.log(`   - Nombre: ${wabaData.name || 'N/A'}`);
            console.log(`   - Review Status: ${wabaData.account_review_status || 'N/A'}`);
            console.log(`   - Currency: ${wabaData.currency || 'N/A'}`);
            console.log(`   - Template Namespace: ${wabaData.message_template_namespace || 'N/A'}`);
            
            // Verificar si el status no es "APPROVED"
            if (wabaData.account_review_status !== 'APPROVED') {
                console.log('🚨 PROBLEMA DETECTADO: WABA no está APPROVED');
                console.log('📋 CAUSA PROBABLE: Cambio en el estado de verificación');
            }
        } else {
            const errorText = await wabaResponse.text();
            console.log('❌ Error obteniendo WABA:', errorText);
        }
    } catch (error) {
        console.log('❌ Error analizando WABA:', error.message);
    }
}

async function testCatalogRegression(accessToken: string, numberId: string) {
    console.log('\n🧪 Prueba específica de regresión del catálogo:');
    
    try {
        // Probar envío básico de catálogo
        const testPayload = {
            messaging_product: "whatsapp",
            to: "56936499908", // Tu número
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🧪 Test de regresión de catálogo"
                },
                action: {
                    name: "catalog_message"
                }
            }
        };
        
        console.log('   📡 Enviando test de catálogo...');
        
        const testUrl = `https://graph.facebook.com/v18.0/${numberId}/messages`;
        const testResponse = await fetch(testUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });
        
        if (testResponse.ok) {
            const result = await testResponse.json();
            console.log('   ✅ Test exitoso - Mensaje ID:', result.messages?.[0]?.id);
            console.log('   📊 CONCLUSIÓN: API funciona, problema específico en visualización');
        } else {
            const errorText = await testResponse.text();
            console.log('   ❌ Test falló:', errorText);
            
            // Analizar el error específico
            try {
                const errorJson = JSON.parse(errorText);
                const errorCode = errorJson.error?.code;
                const errorMessage = errorJson.error?.message;
                
                console.log(`   🔍 Código de error: ${errorCode}`);
                console.log(`   📋 Mensaje: ${errorMessage}`);
                
                // Errores comunes de regresión
                if (errorMessage?.includes('catalog')) {
                    console.log('   🎯 DIAGNÓSTICO: Problema específico de catálogo confirmado');
                } else if (errorMessage?.includes('permissions')) {
                    console.log('   🎯 DIAGNÓSTICO: Cambio en permisos detectado');
                } else if (errorMessage?.includes('account')) {
                    console.log('   🎯 DIAGNÓSTICO: Problema de cuenta/verificación');
                }
            } catch (e) {
                // Error no es JSON
            }
        }
        
    } catch (error) {
        console.log('   ❌ Excepción en test:', error.message);
    }
}

analyzeRegressionIssue();
