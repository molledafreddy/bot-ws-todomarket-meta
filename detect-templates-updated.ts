/**
 * DETECTOR DE PLANTILLAS WHATSAPP BUSINESS - VERSIÓN ACTUALIZADA 2026
 * 
 * Utiliza endpoints actualizados de Meta Graph API
 */

import 'dotenv/config';

async function detectTemplatesUpdated() {
    console.log('🚀 DETECCIÓN DE PLANTILLAS WHATSAPP BUSINESS - ACTUALIZADA\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const businessId = process.env.BUSINESS_ID;
    const appId = process.env.META_APP_ID || process.env.NUMBER_ID; // Usar APP ID si está disponible
    
    if (!accessToken) {
        console.error('❌ JWT_TOKEN no encontrado en variables de entorno');
        return;
    }
    
    console.log('✅ Configuración encontrada:');
    console.log(`📋 Business ID: ${businessId || 'No configurado'}`);
    console.log(`📋 App ID: ${appId || 'No configurado'}`);
    console.log(`📋 Access Token: ${accessToken.substring(0, 20)}...`);
    console.log('');
    
    try {
        // Método 1: Intentar con Business ID si existe
        if (businessId) {
            console.log('📱 MÉTODO 1: Usando Business ID...');
            
            // Nuevo endpoint para plantillas de WhatsApp Business
            const wabaUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`;
            const wabaParams = new URLSearchParams({
                fields: 'id,name,message_template_namespace',
                access_token: accessToken
            });
            
            const wabaResponse = await fetch(`${wabaUrl}?${wabaParams}`);
            
            if (wabaResponse.ok) {
                const wabaData = await wabaResponse.json();
                console.log('📞 Cuentas WhatsApp Business:', JSON.stringify(wabaData, null, 2));
                
                if (wabaData.data && wabaData.data.length > 0) {
                    const wabaAccount = wabaData.data[0];
                    console.log(`✅ Cuenta WABA encontrada: ${wabaAccount.id}`);
                    
                    // Obtener plantillas de la cuenta WABA
                    const templatesUrl = `https://graph.facebook.com/v18.0/${wabaAccount.id}/message_templates`;
                    const templateParams = new URLSearchParams({
                        fields: 'name,status,category,language,id,components',
                        access_token: accessToken,
                        limit: '100'
                    });
                    
                    const templatesResponse = await fetch(`${templatesUrl}?${templateParams}`);
                    
                    if (templatesResponse.ok) {
                        const templatesData = await templatesResponse.json();
                        await displayTemplates(templatesData);
                        return; // Éxito, no necesitamos otros métodos
                    } else {
                        const errorText = await templatesResponse.text();
                        console.error('❌ Error obteniendo plantillas con WABA:', templatesResponse.status, errorText);
                    }
                } else {
                    console.log('⚠️ No se encontraron cuentas WhatsApp Business');
                }
            } else {
                const errorText = await wabaResponse.text();
                console.error('❌ Error obteniendo cuentas WABA:', wabaResponse.status, errorText);
            }
        }
        
        // Método 2: Intentar con el APP ID directamente
        if (appId) {
            console.log('\n📱 MÉTODO 2: Usando App ID...');
            
            const appTemplatesUrl = `https://graph.facebook.com/v18.0/${appId}/message_templates`;
            const appParams = new URLSearchParams({
                fields: 'name,status,category,language,id,components',
                access_token: accessToken,
                limit: '100'
            });
            
            const appResponse = await fetch(`${appTemplatesUrl}?${appParams}`);
            
            if (appResponse.ok) {
                const appData = await appResponse.json();
                await displayTemplates(appData);
                return; // Éxito
            } else {
                const errorText = await appResponse.text();
                console.error('❌ Error obteniendo plantillas con App ID:', appResponse.status, errorText);
            }
        }
        
        // Método 3: Verificar el token y obtener información de la app
        console.log('\n📱 MÉTODO 3: Verificando token y obteniendo información de la app...');
        
        const debugUrl = `https://graph.facebook.com/v18.0/debug_token`;
        const debugParams = new URLSearchParams({
            input_token: accessToken,
            access_token: accessToken
        });
        
        const debugResponse = await fetch(`${debugUrl}?${debugParams}`);
        
        if (debugResponse.ok) {
            const debugData = await debugResponse.json();
            console.log('🔍 Información del token:', JSON.stringify(debugData, null, 2));
            
            if (debugData.data && debugData.data.app_id) {
                const realAppId = debugData.data.app_id;
                console.log(`✅ App ID real encontrado: ${realAppId}`);
                
                // Intentar obtener plantillas con el App ID real
                const realTemplatesUrl = `https://graph.facebook.com/v18.0/${realAppId}/message_templates`;
                const realParams = new URLSearchParams({
                    fields: 'name,status,category,language,id,components',
                    access_token: accessToken,
                    limit: '100'
                });
                
                const realResponse = await fetch(`${realTemplatesUrl}?${realParams}`);
                
                if (realResponse.ok) {
                    const realData = await realResponse.json();
                    await displayTemplates(realData);
                } else {
                    const errorText = await realResponse.text();
                    console.error('❌ Error con App ID real:', realResponse.status, errorText);
                }
            }
        } else {
            const errorText = await debugResponse.text();
            console.error('❌ Error verificando token:', debugResponse.status, errorText);
        }
        
    } catch (error) {
        console.error('💥 Error en la detección:', error);
    }
}

async function displayTemplates(templatesData: any) {
    console.log(`📋 Plantillas encontradas: ${templatesData.data?.length || 0}`);
    
    if (templatesData.data && templatesData.data.length > 0) {
        console.log('\n✅ PLANTILLAS DISPONIBLES:');
        console.log('═══════════════════════════════════════════════════════════════');
        
        templatesData.data.forEach((template: any, index: number) => {
            console.log(`${index + 1}. NOMBRE: "${template.name}"`);
            console.log(`   🆔 ID: ${template.id}`);
            console.log(`   📊 ESTADO: ${template.status}`);
            console.log(`   📂 CATEGORÍA: ${template.category}`);
            console.log(`   🌐 IDIOMA: ${template.language}`);
            
            // Mostrar componentes si existen
            if (template.components && template.components.length > 0) {
                console.log(`   🧩 COMPONENTES:`);
                template.components.forEach((comp: any, compIndex: number) => {
                    console.log(`     ${compIndex + 1}. Tipo: ${comp.type}`);
                    if (comp.text) {
                        console.log(`        Texto: "${comp.text.substring(0, 100)}${comp.text.length > 100 ? '...' : ''}"`);
                    }
                    if (comp.buttons) {
                        comp.buttons.forEach((btn: any, btnIndex: number) => {
                            console.log(`        Botón ${btnIndex + 1}: ${btn.type} - "${btn.text}"`);
                            if (btn.url) {
                                console.log(`          URL: ${btn.url}`);
                            }
                        });
                    }
                });
            }
            
            // Verificar si es plantilla de catálogo
            const isCatalogTemplate = template.name.toLowerCase().includes('catalog') ||
                                    template.name.toLowerCase().includes('catalogo') ||
                                    (template.components && template.components.some((comp: any) => 
                                        comp.buttons && comp.buttons.some((btn: any) => 
                                            btn.type === 'catalog'
                                        )
                                    ));
            
            if (isCatalogTemplate && template.status === 'APPROVED') {
                console.log(`   ⭐ ¡PLANTILLA DE CATÁLOGO DETECTADA!`);
            }
            
            console.log('   ───────────────────────────────────────────────────────────────');
        });
        
        // Buscar plantillas aprobadas de catálogo
        const catalogTemplates = templatesData.data.filter((template: any) => 
            template.status === 'APPROVED' && 
            (template.name.toLowerCase().includes('catalog') ||
             template.name.toLowerCase().includes('catalogo') ||
             (template.components && template.components.some((comp: any) => 
                comp.buttons && comp.buttons.some((btn: any) => btn.type === 'catalog')
             )))
        );
        
        if (catalogTemplates.length > 0) {
            console.log('\n🎯 PLANTILLAS DE CATÁLOGO APROBADAS ENCONTRADAS:');
            console.log('═══════════════════════════════════════════════════════════════');
            
            catalogTemplates.forEach((template: any, index: number) => {
                console.log(`${index + 1}. 🏆 USAR ESTA: "${template.name}"`);
                console.log(`   🆔 ID: ${template.id}`);
                console.log(`   📊 Estado: ${template.status}`);
                console.log(`   📂 Categoría: ${template.category}`);
                console.log(`   🌐 Idioma: ${template.language}`);
                
                // Mostrar estructura para implementar
                console.log('\n📋 ESTRUCTURA PARA IMPLEMENTAR:');
                console.log(`   Template Name: "${template.name}"`);
                console.log(`   Language Code: "${template.language}"`);
                console.log(`   Template ID: "${template.id}"`);
                
                if (template.components) {
                    console.log('   Componentes requeridos:');
                    template.components.forEach((comp: any) => {
                        console.log(`     - ${comp.type}: ${comp.text ? '"' + comp.text.substring(0, 50) + '..."' : 'Variable'}`);
                    });
                }
                console.log('');
            });
            
            // Dar instrucciones específicas para la mejor plantilla
            const bestTemplate = catalogTemplates[0];
            console.log('🔧 INSTRUCCIONES PARA ACTUALIZAR EL CÓDIGO:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`1. Abrir el archivo: meta-templates.ts`);
            console.log(`2. Actualizar estas líneas:`);
            console.log(`   name: "${bestTemplate.name}",`);
            console.log(`   language: { code: "${bestTemplate.language}" },`);
            console.log(`3. Ejecutar: npm run build`);
            console.log(`4. Reiniciar la aplicación`);
            console.log(`5. Probar enviando "1" al bot`);
            console.log('');
            console.log('✅ ¡Con esta configuración deberían funcionar los catálogos!');
            
        } else {
            console.log('\n⚠️ NO SE ENCONTRARON PLANTILLAS DE CATÁLOGO APROBADAS');
            console.log('');
            console.log('💡 SIGUIENTES PASOS:');
            console.log('1. Ir a Meta Business Manager');
            console.log('2. Crear una nueva plantilla de mensaje');
            console.log('3. Configurarla como tipo "Catálogo"');
            console.log('4. Esperar aprobación de Meta');
            console.log('5. Volver a ejecutar este script');
        }
        
    } else {
        console.log('⚠️ No se encontraron plantillas en la cuenta');
        console.log('');
        console.log('🔍 POSIBLES CAUSAS:');
        console.log('1. El token no tiene permisos adecuados');
        console.log('2. No hay plantillas creadas en Meta Business Manager');
        console.log('3. Las plantillas están en otra cuenta/app');
        console.log('4. Los IDs de configuración son incorrectos');
    }
}

// Ejecutar detección
detectTemplatesUpdated().catch(console.error);
