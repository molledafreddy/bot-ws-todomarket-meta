/**
 * VERIFICADOR DE CONEXIÓN DE CATÁLOGO - WHATSAPP BUSINESS
 * 
 * Te ayuda a encontrar exactamente dónde está el problema
 */

import 'dotenv/config';

async function verifyCatalogConnection() {
    console.log('🔍 VERIFICADOR DE CONEXIÓN DE CATÁLOGO\n');
    console.log('Este script te dirá exactamente qué necesitas buscar en Meta Business Manager');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const businessId = '1349962220108819';
    const phoneNumberId = '725315067342333';
    
    try {
        // 1. Verificar todos los catálogos del negocio
        console.log('📋 PASO 1: Verificando todos tus catálogos...');
        
        const catalogsUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_product_catalogs`;
        const catalogsResponse = await fetch(`${catalogsUrl}?access_token=${accessToken}&fields=id,name,product_count,vertical,business`);
        const catalogsData = await catalogsResponse.json();
        
        if (catalogsData.data) {
            console.log(`✅ Tienes ${catalogsData.data.length} catálogos:\n`);
            
            for (let i = 0; i < catalogsData.data.length; i++) {
                const catalog = catalogsData.data[i];
                console.log(`${i + 1}. 📦 CATÁLOGO: "${catalog.name}"`);
                console.log(`   🆔 ID: ${catalog.id}`);
                console.log(`   📊 Productos: ${catalog.product_count}`);
                console.log(`   📂 Vertical: ${catalog.vertical}`);
                console.log('');
            }
        }
        
        // 2. Verificar conexión específica del número WhatsApp
        console.log('📱 PASO 2: Verificando tu número WhatsApp...');
        
        const phoneUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
        const phoneResponse = await fetch(`${phoneUrl}?access_token=${accessToken}&fields=id,verified_name,display_phone_number,quality_rating`);
        const phoneData = await phoneResponse.json();
        
        if (phoneResponse.ok) {
            console.log('✅ Tu número WhatsApp Business:');
            console.log(`📞 Número: ${phoneData.display_phone_number}`);
            console.log(`✅ Nombre verificado: ${phoneData.verified_name}`);
            console.log(`⭐ Calidad: ${phoneData.quality_rating}`);
            console.log('');
        }
        
        // 3. Buscar WABA y sus configuraciones
        console.log('🏢 PASO 3: Verificando tu cuenta WhatsApp Business (WABA)...');
        
        const wabaUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`;
        const wabaResponse = await fetch(`${wabaUrl}?access_token=${accessToken}&fields=id,name,account_review_status`);
        const wabaData = await wabaResponse.json();
        
        if (wabaData.data && wabaData.data.length > 0) {
            const waba = wabaData.data[0];
            console.log('✅ Tu cuenta WABA:');
            console.log(`🆔 WABA ID: ${waba.id}`);
            console.log(`📛 Nombre: ${waba.name}`);
            console.log(`📊 Estado: ${waba.account_review_status}`);
            console.log('');
            
            // 4. CLAVE: Verificar si hay catálogo conectado a la WABA
            console.log('🔗 PASO 4: Verificando catálogo conectado a WABA...');
            
            try {
                const wabaSettingsUrl = `https://graph.facebook.com/v18.0/${waba.id}`;
                const wabaSettingsResponse = await fetch(`${wabaSettingsUrl}?access_token=${accessToken}&fields=id,name,catalog_id`);
                const wabaSettingsData = await wabaSettingsResponse.json();
                
                if (wabaSettingsData.catalog_id) {
                    console.log('✅ ¡CATÁLOGO CONECTADO ENCONTRADO!');
                    console.log(`📦 Catálogo ID conectado: ${wabaSettingsData.catalog_id}`);
                    
                    // Verificar si este catálogo coincide con alguno de los disponibles
                    const connectedCatalog = catalogsData.data?.find((cat: any) => cat.id === wabaSettingsData.catalog_id);
                    
                    if (connectedCatalog) {
                        console.log(`✅ Catálogo conectado: "${connectedCatalog.name}"`);
                        console.log(`📊 Productos disponibles: ${connectedCatalog.product_count}`);
                        
                        if (connectedCatalog.product_count > 0) {
                            console.log('\n🎉 ¡EL CATÁLOGO ESTÁ CONECTADO Y TIENE PRODUCTOS!');
                            console.log('El problema podría ser diferente. Vamos a probar...\n');
                            
                            // Probar envío directo
                            await testDirectCatalogSend(phoneNumberId, accessToken!);
                        } else {
                            console.log('\n⚠️ El catálogo está conectado pero no tiene productos');
                        }
                    } else {
                        console.log('\n⚠️ El catálogo conectado no está en tu lista de catálogos');
                    }
                } else {
                    console.log('❌ NO HAY CATÁLOGO CONECTADO');
                    console.log('\n🎯 ESTO ES LO QUE NECESITAS HACER:');
                    console.log('═══════════════════════════════════════════════════════════════');
                    console.log('1. Ve a Meta Business Manager');
                    console.log('2. Busca una de estas opciones:');
                    console.log('   - "WhatsApp Business API"');
                    console.log('   - "Cuentas" > "WhatsApp"');
                    console.log('   - "Aplicaciones" > tu app');
                    console.log(`3. Selecciona tu número: ${phoneData.display_phone_number}`);
                    console.log('4. Busca la opción "Catálogo" o "Catalog"');
                    console.log('5. Conecta uno de estos catálogos:');
                    
                    catalogsData.data?.forEach((catalog: any, index: number) => {
                        if (catalog.product_count > 0) {
                            console.log(`   ✅ "${catalog.name}" (${catalog.product_count} productos)`);
                        }
                    });
                }
                
            } catch (error) {
                console.log('⚠️ No se pudo verificar la configuración de catálogo de WABA');
                console.log('Esto confirma que necesitas conectar manualmente en Meta Business Manager');
            }
        }
        
        // 5. Dar instrucciones específicas según lo encontrado
        console.log('\n📋 RESUMEN Y SIGUIENTES PASOS:');
        console.log('═══════════════════════════════════════════════════════════════');
        
        if (catalogsData.data && catalogsData.data.length > 0) {
            const bestCatalog = catalogsData.data.find((cat: any) => cat.product_count > 0) || catalogsData.data[0];
            
            console.log('🎯 QUÉ BUSCAR EN META BUSINESS MANAGER:');
            console.log(`📞 Tu número: ${phoneData.display_phone_number || '+56 9 7964 3935'}`);
            console.log(`📦 Conectar este catálogo: "${bestCatalog.name}"`);
            console.log(`🆔 ID del catálogo: ${bestCatalog.id}`);
            console.log(`📊 Productos disponibles: ${bestCatalog.product_count}`);
            console.log('');
            console.log('💡 RUTAS ALTERNATIVAS PARA ENCONTRAR LA CONFIGURACIÓN:');
            console.log('1. business.facebook.com/wa/manage/phone-numbers/');
            console.log('2. business.facebook.com > Configuración > WhatsApp Business');
            console.log('3. business.facebook.com > Cuentas > WhatsApp');
            console.log('4. business.facebook.com > Aplicaciones > bot-ws-todomarket');
        }
        
    } catch (error) {
        console.error('💥 Error en verificación:', error);
    }
}

async function testDirectCatalogSend(phoneNumberId: string, accessToken: string) {
    console.log('🧪 PROBANDO ENVÍO DIRECTO DE CATÁLOGO...');
    
    const payload = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "template",
        template: {
            name: "ccatalogo_todomarket",
            language: { code: "es_CL" }
        }
    };
    
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('🎉 ¡CATÁLOGO FUNCIONANDO! El problema estaba en el payload');
            console.log(`✅ Message ID: ${result.messages[0].id}`);
        } else {
            console.log('❌ Confirmado: El catálogo necesita ser conectado manualmente');
            console.log(`Error: ${result.error?.message}`);
        }
    } catch (error) {
        console.log('💥 Error en prueba:', error);
    }
}

verifyCatalogConnection().catch(console.error);
