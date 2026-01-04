/**
 * DETECTOR DE PLANTILLAS WHATSAPP - MÉTODO DIRECTO 2026
 * 
 * Usa el enfoque correcto para la nueva API de Meta
 */

import 'dotenv/config';

async function detectTemplatesDirectMethod() {
    console.log('🚀 DETECCIÓN DIRECTA DE PLANTILLAS WHATSAPP BUSINESS\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const businessId = '1349962220108819'; // Tu Business ID conocido
    const appId = '1542683137156779'; // App ID real del token
    
    console.log('✅ Configuración confirmada:');
    console.log(`📋 Business ID: ${businessId}`);
    console.log(`📋 App ID Real: ${appId}`);
    console.log(`📋 Access Token: ${accessToken?.substring(0, 20)}...`);
    console.log('');
    
    try {
        // Método 1: Buscar cuentas WhatsApp Business del negocio
        console.log('📱 MÉTODO 1: Obteniendo cuentas WhatsApp Business...');
        
        const wabaUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_whatsapp_business_accounts`;
        const wabaParams = new URLSearchParams({
            access_token: accessToken!,
            fields: 'id,name,timezone_id,account_review_status'
        });
        
        const wabaResponse = await fetch(`${wabaUrl}?${wabaParams}`);
        const wabaData = await wabaResponse.json();
        
        console.log('📞 Respuesta WABA:', JSON.stringify(wabaData, null, 2));
        
        if (wabaData.data && wabaData.data.length > 0) {
            for (const waba of wabaData.data) {
                console.log(`\\n✅ Procesando WABA: ${waba.id} (${waba.name})`);
                
                // Obtener plantillas de esta WABA
                const templatesUrl = `https://graph.facebook.com/v18.0/${waba.id}/message_templates`;
                const templateParams = new URLSearchParams({
                    access_token: accessToken!,
                    fields: 'name,status,category,language,id,components',
                    limit: '100'
                });
                
                const templatesResponse = await fetch(`${templatesUrl}?${templateParams}`);
                const templatesData = await templatesResponse.json();
                
                if (templatesResponse.ok) {
                    await displayTemplatesFound(templatesData, waba.id);
                } else {
                    console.log(`❌ Error obteniendo plantillas para WABA ${waba.id}:`, templatesData);
                }
            }
        } else {
            console.log('⚠️ No se encontraron cuentas WhatsApp Business');
            console.log('Error en respuesta:', wabaData);
        }
        
        // Método 2: Intentar buscar plantillas que ya sabemos que existen
        console.log('\\n📱 MÉTODO 2: Verificando plantilla conocida...');
        
        const knownTemplateId = '1845275256134045';
        const templateCheckUrl = `https://graph.facebook.com/v18.0/${knownTemplateId}`;
        const templateCheckParams = new URLSearchParams({
            access_token: accessToken!,
            fields: 'name,status,category,language,id,components'
        });
        
        const templateCheckResponse = await fetch(`${templateCheckUrl}?${templateCheckParams}`);
        const templateCheckData = await templateCheckResponse.json();
        
        if (templateCheckResponse.ok) {
            console.log('✅ PLANTILLA CONOCIDA ENCONTRADA:');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(`🏆 NOMBRE: "${templateCheckData.name}"`);
            console.log(`🆔 ID: ${templateCheckData.id}`);
            console.log(`📊 Estado: ${templateCheckData.status}`);
            console.log(`📂 Categoría: ${templateCheckData.category}`);
            console.log(`🌐 Idioma: ${templateCheckData.language}`);
            
            if (templateCheckData.components) {
                console.log('🧩 COMPONENTES:');
                templateCheckData.components.forEach((comp: any, index: number) => {
                    console.log(`  ${index + 1}. Tipo: ${comp.type}`);
                    if (comp.text) {
                        console.log(`     Texto: "${comp.text}"`);
                    }
                    if (comp.buttons) {
                        comp.buttons.forEach((btn: any, btnIndex: number) => {
                            console.log(`     Botón ${btnIndex + 1}: ${btn.type} - "${btn.text}"`);
                        });
                    }
                });
            }
            
            console.log('\\n🔧 CONFIGURACIÓN PARA TU CÓDIGO:');
            console.log('═══════════════════════════════════════════════════════════');
            console.log(`Template Name: "${templateCheckData.name}"`);
            console.log(`Template ID: "${templateCheckData.id}"`);
            console.log(`Language Code: "${templateCheckData.language}"`);
            console.log(`Status: ${templateCheckData.status}`);
            
            if (templateCheckData.status === 'APPROVED') {
                console.log('\\n✅ ¡ESTA PLANTILLA ESTÁ APROBADA Y LISTA PARA USAR!');
                console.log('\\n📝 PASOS PARA ACTUALIZAR TU CÓDIGO:');
                console.log('1. Abrir meta-templates.ts');
                console.log(`2. Cambiar name a: "${templateCheckData.name}"`);
                console.log(`3. Cambiar language.code a: "${templateCheckData.language}"`);
                console.log('4. Ejecutar: npm run build');
                console.log('5. Reiniciar la app y probar con "1"');
            } else {
                console.log(`\\n⚠️ Plantilla en estado: ${templateCheckData.status}`);
                console.log('Necesita estar APPROVED para funcionar');
            }
            
        } else {
            console.log('❌ Error verificando plantilla conocida:', templateCheckData);
        }
        
        // Método 3: Listar todas las apps y sus plantillas
        console.log('\\n📱 MÉTODO 3: Explorando estructura de negocio...');
        
        const businessUrl = `https://graph.facebook.com/v18.0/${businessId}`;
        const businessParams = new URLSearchParams({
            access_token: accessToken!,
            fields: 'id,name,apps,owned_apps,client_apps'
        });
        
        const businessResponse = await fetch(`${businessUrl}?${businessParams}`);
        const businessData = await businessResponse.json();
        
        console.log('🏢 Información del negocio:', JSON.stringify(businessData, null, 2));
        
    } catch (error) {
        console.error('💥 Error en la detección:', error);
    }
}

async function displayTemplatesFound(templatesData: any, wabaId: string) {
    console.log(`📋 Plantillas en WABA ${wabaId}: ${templatesData.data?.length || 0}`);
    
    if (templatesData.data && templatesData.data.length > 0) {
        console.log('\\n✅ PLANTILLAS ENCONTRADAS:');
        console.log('═══════════════════════════════════════════════════════════════');
        
        let catalogTemplates = [];
        
        for (const template of templatesData.data) {
            console.log(`\\n🏷️ NOMBRE: "${template.name}"`);
            console.log(`   🆔 ID: ${template.id}`);
            console.log(`   📊 ESTADO: ${template.status}`);
            console.log(`   📂 CATEGORÍA: ${template.category}`);
            console.log(`   🌐 IDIOMA: ${template.language}`);
            
            // Verificar si es plantilla de catálogo
            const isCatalogTemplate = template.name.toLowerCase().includes('catalog') ||
                                    template.name.toLowerCase().includes('catalogo') ||
                                    (template.components && template.components.some((comp: any) => 
                                        comp.buttons && comp.buttons.some((btn: any) => 
                                            btn.type === 'catalog'
                                        )
                                    ));
            
            if (isCatalogTemplate) {
                catalogTemplates.push(template);
                console.log(`   ⭐ ¡PLANTILLA DE CATÁLOGO DETECTADA!`);
            }
            
            if (template.components) {
                console.log(`   🧩 COMPONENTES:`);
                template.components.forEach((comp: any, index: number) => {
                    console.log(`     ${index + 1}. ${comp.type}: ${comp.text || 'Variable'}`);
                    if (comp.buttons) {
                        comp.buttons.forEach((btn: any, btnIndex: number) => {
                            console.log(`        Botón ${btnIndex + 1}: ${btn.type} - "${btn.text}"`);
                        });
                    }
                });
            }
        }
        
        if (catalogTemplates.length > 0) {
            console.log('\\n🎯 RESUMEN DE PLANTILLAS DE CATÁLOGO:');
            console.log('═══════════════════════════════════════════════════════════════');
            
            catalogTemplates.forEach((template: any, index: number) => {
                const statusIcon = template.status === 'APPROVED' ? '✅' : '⚠️';
                console.log(`${index + 1}. ${statusIcon} "${template.name}" (${template.status})`);
            });
        }
    }
}

// Ejecutar
detectTemplatesDirectMethod().catch(console.error);
