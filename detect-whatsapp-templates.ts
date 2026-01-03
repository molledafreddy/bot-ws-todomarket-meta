/**
 * SCRIPT ALTERNATIVO PARA DETECTAR PLANTILLAS DE WHATSAPP BUSINESS
 * 
 * Este script usa el WhatsApp Business Account ID en lugar del Business ID
 */

import 'dotenv/config';

async function detectWhatsAppTemplates() {
    console.log('🚀 DETECCIÓN ALTERNATIVA DE PLANTILLAS WHATSAPP\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = process.env.NUMBER_ID;
    
    if (!accessToken || !phoneNumberId) {
        console.error('❌ Variables de entorno faltantes');
        return;
    }
    
    try {
        // Método 1: Obtener información del número de teléfono para encontrar WABA ID
        console.log('📱 MÉTODO 1: Obteniendo información del número de teléfono...');
        
        const phoneInfoUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
        const phoneParams = new URLSearchParams({
            fields: 'id,verified_name,display_phone_number,quality_rating,whatsapp_business_account_id',
            access_token: accessToken
        });
        
        const phoneResponse = await fetch(`${phoneInfoUrl}?${phoneParams}`);
        
        if (phoneResponse.ok) {
            const phoneData = await phoneResponse.json();
            console.log('📞 Información del número:', JSON.stringify(phoneData, null, 2));
            
            const wabaId = phoneData.whatsapp_business_account_id;
            
            if (wabaId) {
                console.log(`✅ WhatsApp Business Account ID encontrado: ${wabaId}`);
                
                // Método 2: Usar WABA ID para obtener plantillas
                console.log('\n📋 MÉTODO 2: Obteniendo plantillas con WABA ID...');
                
                const templatesUrl = `https://graph.facebook.com/v18.0/${wabaId}/message_templates`;
                const templateParams = new URLSearchParams({
                    fields: 'name,status,category,language,id,components',
                    access_token: accessToken,
                    limit: '50'
                });
                
                const templatesResponse = await fetch(`${templatesUrl}?${templateParams}`);
                
                if (templatesResponse.ok) {
                    const templatesData = await templatesResponse.json();
                    
                    console.log(`📋 Plantillas encontradas: ${templatesData.data?.length || 0}`);
                    
                    if (templatesData.data && templatesData.data.length > 0) {
                        console.log('\n✅ PLANTILLAS DISPONIBLES:');
                        console.log('═══════════════════════════');
                        
                        templatesData.data.forEach((template, index) => {
                            console.log(`${index + 1}. NOMBRE: "${template.name}"`);
                            console.log(`   ID: ${template.id}`);
                            console.log(`   ESTADO: ${template.status}`);
                            console.log(`   CATEGORÍA: ${template.category}`);
                            console.log(`   IDIOMA: ${template.language}`);
                            
                            // Mostrar componentes si existen
                            if (template.components && template.components.length > 0) {
                                console.log(`   COMPONENTES:`);
                                template.components.forEach((comp, compIndex) => {
                                    console.log(`     ${compIndex + 1}. ${comp.type}: ${comp.text || 'N/A'}`);
                                    if (comp.buttons) {
                                        comp.buttons.forEach((btn, btnIndex) => {
                                            console.log(`        Botón ${btnIndex + 1}: ${btn.type} - "${btn.text}"`);
                                        });
                                    }
                                });
                            }
                            console.log('   ───────────────────────────');
                        });
                        
                        // Buscar plantillas aprobadas de catálogo
                        const catalogTemplates = templatesData.data.filter(template => 
                            template.status === 'APPROVED' && 
                            (template.name.toLowerCase().includes('catalog') ||
                             template.name.toLowerCase().includes('catalogo') ||
                             template.category === 'UTILITY')
                        );
                        
                        if (catalogTemplates.length > 0) {
                            console.log('\n🎯 PLANTILLAS DE CATÁLOGO RECOMENDADAS:');
                            console.log('═══════════════════════════════════════');
                            
                            catalogTemplates.forEach((template, index) => {
                                console.log(`${index + 1}. USAR: "${template.name}"`);
                                console.log(`   Estado: ${template.status}`);
                                console.log(`   Categoría: ${template.category}`);
                                
                                // Generar payload de ejemplo para esta plantilla
                                const examplePayload: any = {
                                    messaging_product: "whatsapp",
                                    to: "56936499908",
                                    type: "template",
                                    template: {
                                        name: template.name,
                                        language: {
                                            code: template.language || "es_CL"
                                        }
                                    }
                                };
                                
                                // Agregar componentes si los hay
                                if (template.components) {
                                    examplePayload.template.components = [];
                                    
                                    template.components.forEach(comp => {
                                        if (comp.type === 'HEADER') {
                                            examplePayload.template.components.push({
                                                type: "header",
                                                parameters: [
                                                    {
                                                        type: "text",
                                                        text: "TodoMarket"
                                                    }
                                                ]
                                            });
                                        }
                                        
                                        if (comp.type === 'BODY') {
                                            examplePayload.template.components.push({
                                                type: "body",
                                                parameters: [
                                                    {
                                                        type: "text",
                                                        text: "Minimarket de barrio"
                                                    }
                                                ]
                                            });
                                        }
                                    });
                                }
                                
                                console.log('\n📨 PAYLOAD PARA ESTA PLANTILLA:');
                                console.log(JSON.stringify(examplePayload, null, 2));
                                console.log('');
                            });
                            
                            // Dar instrucciones específicas
                            const bestTemplate = catalogTemplates[0];
                            console.log('🔧 INSTRUCCIONES PARA IMPLEMENTAR:');
                            console.log('═══════════════════════════════════');
                            console.log(`1. Abrir meta-templates.ts`);
                            console.log(`2. Cambiar el campo "name" por: "${bestTemplate.name}"`);
                            console.log(`3. Verificar que el language sea: "${bestTemplate.language}"`);
                            console.log(`4. Ejecutar: npm run build`);
                            console.log(`5. Desplegar los cambios`);
                            console.log(`6. Probar enviando "1" al bot`);
                            
                        } else {
                            console.log('\n⚠️ No se encontraron plantillas de catálogo aprobadas');
                            console.log('💡 Plantillas disponibles para revisar:');
                            templatesData.data.forEach((template, index) => {
                                console.log(`${index + 1}. ${template.name} (${template.status}) - ${template.category}`);
                            });
                        }
                        
                    } else {
                        console.log('⚠️ No se encontraron plantillas en la cuenta');
                    }
                    
                } else {
                    const errorText = await templatesResponse.text();
                    console.error('❌ Error obteniendo plantillas:', templatesResponse.status, errorText);
                }
                
            } else {
                console.log('❌ No se encontró WhatsApp Business Account ID');
            }
            
        } else {
            const errorText = await phoneResponse.text();
            console.error('❌ Error obteniendo información del teléfono:', phoneResponse.status, errorText);
        }
        
    } catch (error) {
        console.error('💥 Error en la detección alternativa:', error);
    }
}

// Ejecutar detección
detectWhatsAppTemplates().catch(console.error);
