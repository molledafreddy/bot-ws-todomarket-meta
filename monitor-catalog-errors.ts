/**
 * MONITOR DE ERRORES DE CATÁLOGO EN TIEMPO REAL
 * 
 * Captura y analiza errores específicos del catálogo
 */

import 'dotenv/config';

async function monitorCatalogErrors() {
    console.log('🔍 MONITOR DE ERRORES DE CATÁLOGO - INICIADO\n');
    console.log('📋 Fecha:', new Date().toLocaleString());
    console.log('═══════════════════════════════════════════════════════════════');
    
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = process.env.NUMBER_ID;
    const businessId = process.env.BUSINESS_ID || '1349962220108819';
    
    console.log('✅ Configuración actual:');
    console.log(`📱 Phone Number ID: ${phoneNumberId}`);
    console.log(`🏢 Business ID: ${businessId}`);
    console.log(`🔑 Token: ${accessToken?.substring(0, 20)}...`);
    console.log('');
    
    try {
        // 1. Verificar estado del catálogo
        console.log('📋 PASO 1: Verificando estado del catálogo...');
        
        const catalogUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_product_catalogs`;
        const catalogParams = new URLSearchParams({
            access_token: accessToken!,
            fields: 'id,name,product_count,vertical,business'
        });
        
        const catalogResponse = await fetch(`${catalogUrl}?${catalogParams}`);
        const catalogData = await catalogResponse.json();
        
        if (catalogResponse.ok && catalogData.data) {
            console.log('✅ Catálogos encontrados:', catalogData.data.length);
            
            for (const catalog of catalogData.data) {
                console.log(`\n📦 Catálogo: ${catalog.name}`);
                console.log(`   🆔 ID: ${catalog.id}`);
                console.log(`   📊 Productos: ${catalog.product_count}`);
                console.log(`   📂 Vertical: ${catalog.vertical}`);
                
                // Verificar productos del catálogo
                await checkCatalogProducts(catalog.id, accessToken!);
            }
        } else {
            console.log('❌ Error obteniendo catálogos:', catalogData);
        }
        
        // 2. Verificar conexión WhatsApp Business
        console.log('\n📱 PASO 2: Verificando conexión WhatsApp Business...');
        
        const wabaUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`;
        const wabaParams = new URLSearchParams({
            access_token: accessToken!,
            fields: 'id,name,account_review_status,business_verification_status'
        });
        
        const wabaResponse = await fetch(`${wabaUrl}?${wabaParams}`);
        const wabaData = await wabaResponse.json();
        
        if (wabaResponse.ok && wabaData.data) {
            console.log('✅ Cuentas WhatsApp Business:', wabaData.data.length);
            
            for (const waba of wabaData.data) {
                console.log(`\n📞 WABA: ${waba.name}`);
                console.log(`   🆔 ID: ${waba.id}`);
                console.log(`   📊 Estado: ${waba.account_review_status}`);
                console.log(`   ✅ Verificación: ${waba.business_verification_status}`);
                
                // Verificar si el catálogo está conectado a esta WABA
                await checkWABACatalogConnection(waba.id, accessToken!);
            }
        } else {
            console.log('❌ Error obteniendo WABA:', wabaData);
        }
        
        // 3. Probar envío de mensaje de catálogo
        console.log('\n📨 PASO 3: Probando envío de mensaje de catálogo...');
        await testCatalogMessage(phoneNumberId!, accessToken!);
        
        // 4. Generar reporte de errores
        console.log('\n📋 PASO 4: Generando reporte de estado...');
        generateErrorReport();
        
    } catch (error) {
        console.error('💥 Error en el monitoreo:', error);
        
        if (error instanceof Error) {
            console.log('\n🔍 ANÁLISIS DEL ERROR:');
            console.log(`Tipo: ${error.name}`);
            console.log(`Mensaje: ${error.message}`);
            console.log(`Stack: ${error.stack?.substring(0, 500)}...`);
        }
    }
}

async function checkCatalogProducts(catalogId: string, accessToken: string) {
    try {
        console.log(`\n   🔍 Revisando productos del catálogo ${catalogId}...`);
        
        const productsUrl = `https://graph.facebook.com/v18.0/${catalogId}/products`;
        const productsParams = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,description,availability,condition,price,image_url',
            limit: '10'
        });
        
        const productsResponse = await fetch(`${productsUrl}?${productsParams}`);
        const productsData = await productsResponse.json();
        
        if (productsResponse.ok) {
            console.log(`   ✅ Productos encontrados: ${productsData.data?.length || 0}`);
            
            if (productsData.data && productsData.data.length > 0) {
                productsData.data.slice(0, 3).forEach((product: any, index: number) => {
                    console.log(`   ${index + 1}. ${product.name} (${product.id})`);
                    console.log(`      💰 Precio: ${product.price || 'N/A'}`);
                    console.log(`      📦 Disponibilidad: ${product.availability || 'N/A'}`);
                });
            }
        } else {
            console.log(`   ❌ Error obteniendo productos:`, productsData);
        }
    } catch (error) {
        console.log(`   💥 Error verificando productos:`, error);
    }
}

async function checkWABACatalogConnection(wabaId: string, accessToken: string) {
    try {
        console.log(`\n   🔗 Verificando conexión de catálogo para WABA ${wabaId}...`);
        
        // Verificar el número de teléfono asociado
        const phonesUrl = `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers`;
        const phonesParams = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,verified_name,display_phone_number,quality_rating'
        });
        
        const phonesResponse = await fetch(`${phonesUrl}?${phonesParams}`);
        const phonesData = await phonesResponse.json();
        
        if (phonesResponse.ok && phonesData.data) {
            console.log(`   📞 Números de teléfono: ${phonesData.data.length}`);
            
            phonesData.data.forEach((phone: any) => {
                console.log(`      📱 ${phone.display_phone_number} (${phone.verified_name})`);
                console.log(`      🔗 ID: ${phone.id}`);
                console.log(`      ⭐ Calidad: ${phone.quality_rating || 'N/A'}`);
            });
        }
        
    } catch (error) {
        console.log(`   💥 Error verificando conexión WABA:`, error);
    }
}

async function testCatalogMessage(phoneNumberId: string, accessToken: string) {
    try {
        console.log('🧪 Probando envío de mensaje de catálogo...');
        
        // Payload de prueba con la plantilla detectada
        const testPayload = {
            messaging_product: "whatsapp",
            to: "56936499908", // Número de prueba
            type: "template",
            template: {
                name: "ccatalogo_todomarket",
                language: {
                    code: "es_CL"
                },
                components: [
                    {
                        type: "body"
                    },
                    {
                        type: "footer"
                    }
                ]
            }
        };
        
        console.log('📦 Payload a enviar:');
        console.log(JSON.stringify(testPayload, null, 2));
        
        const sendUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
        
        const sendResponse = await fetch(sendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(testPayload)
        });
        
        const sendData = await sendResponse.json();
        
        if (sendResponse.ok) {
            console.log('✅ Mensaje enviado exitosamente:');
            console.log(`   🆔 Message ID: ${sendData.messages[0].id}`);
            console.log(`   📱 WAMID: ${sendData.messages[0].message_status}`);
        } else {
            console.log('❌ Error enviando mensaje:');
            console.log('   Status:', sendResponse.status);
            console.log('   Error:', JSON.stringify(sendData, null, 2));
            
            // Analizar errores específicos
            analyzeMessageError(sendData);
        }
        
    } catch (error) {
        console.log('💥 Error en prueba de envío:', error);
    }
}

function analyzeMessageError(errorData: any) {
    console.log('\n🔍 ANÁLISIS ESPECÍFICO DEL ERROR:');
    
    if (errorData.error) {
        const error = errorData.error;
        
        console.log(`Código: ${error.code}`);
        console.log(`Tipo: ${error.type}`);
        console.log(`Mensaje: ${error.message}`);
        
        // Errores comunes y soluciones
        switch (error.code) {
            case 100:
                console.log('\n💡 POSIBLE CAUSA: Campo o configuración incorrecta');
                console.log('   - Verificar que la plantilla existe');
                console.log('   - Revisar los componentes de la plantilla');
                break;
                
            case 131056:
                console.log('\n💡 POSIBLE CAUSA: Plantilla no aprobada o suspendida');
                console.log('   - Verificar estado en Meta Business Manager');
                console.log('   - Revisar políticas de WhatsApp Business');
                break;
                
            case 132000:
                console.log('\n💡 POSIBLE CAUSA: Número de teléfono no verificado');
                console.log('   - Verificar el número en Meta Business Manager');
                break;
                
            case 80007:
                console.log('\n💡 POSIBLE CAUSA: Catálogo desconectado');
                console.log('   - Reconectar catálogo en Meta Business Manager');
                break;
                
            default:
                console.log('\n💡 Error no catalogado - revisar documentación de Meta');
        }
    }
}

function generateErrorReport() {
    console.log('\n📋 REPORTE DE ESTADO - CATÁLOGO TODOMARKET');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
    console.log('🔍 Estado: En análisis');
    console.log('');
    console.log('📝 PRÓXIMOS PASOS:');
    console.log('1. Revisar errores específicos arriba');
    console.log('2. Verificar Meta Business Manager');
    console.log('3. Comprobar conexión del catálogo');
    console.log('4. Probar con número real (no de prueba)');
    console.log('');
    console.log('🆘 Si persisten los errores:');
    console.log('   - Copiar los logs exactos del error');
    console.log('   - Verificar en Railway console');
    console.log('   - Revisar Meta Business Manager');
}

// Ejecutar monitoreo
monitorCatalogErrors().catch(console.error);
