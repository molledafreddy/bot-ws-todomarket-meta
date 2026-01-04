/**
 * CONSULTA DIRECTA DE LA PLANTILLA REAL
 * 
 * Para ver exactamente cómo está configurada en Meta
 */

import 'dotenv/config';

async function getTemplateExactStructure() {
    console.log('🔍 CONSULTANDO ESTRUCTURA EXACTA DE LA PLANTILLA\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const templateId = '1845275256134045';
    
    try {
        // Consulta directa de la plantilla
        const templateUrl = `https://graph.facebook.com/v18.0/${templateId}`;
        const templateParams = new URLSearchParams({
            access_token: accessToken!,
            fields: 'name,status,category,language,id,components'
        });
        
        const response = await fetch(`${templateUrl}?${templateParams}`);
        const templateData = await response.json();
        
        if (response.ok) {
            console.log('✅ ESTRUCTURA REAL DE LA PLANTILLA:');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log(JSON.stringify(templateData, null, 2));
            console.log('═══════════════════════════════════════════════════════════════\n');
            
            console.log('📋 ANÁLISIS DE COMPONENTES:');
            
            if (templateData.components) {
                templateData.components.forEach((comp: any, index: number) => {
                    console.log(`${index + 1}. TIPO: ${comp.type}`);
                    
                    if (comp.text) {
                        console.log(`   Texto: "${comp.text}"`);
                    }
                    
                    if (comp.format) {
                        console.log(`   Formato: ${comp.format}`);
                    }
                    
                    if (comp.buttons) {
                        console.log(`   Botones: ${comp.buttons.length}`);
                        comp.buttons.forEach((btn: any, btnIndex: number) => {
                            console.log(`     ${btnIndex + 1}. Tipo: ${btn.type}, Texto: "${btn.text}"`);
                        });
                    }
                    
                    if (comp.example) {
                        console.log(`   Ejemplo: ${JSON.stringify(comp.example)}`);
                    }
                    
                    console.log('');
                });
                
                // Generar payload basado en la estructura real
                console.log('🎯 GENERANDO PAYLOAD CORRECTO BASADO EN ESTRUCTURA REAL:');
                
                const correctPayload: any = {
                    messaging_product: "whatsapp",
                    to: "56936499908",
                    type: "template",
                    template: {
                        name: templateData.name,
                        language: {
                            code: templateData.language
                        }
                    }
                };
                
                // Determinar si necesita componentes o no
                const needsComponents = templateData.components.some((comp: any) => 
                    comp.type === 'HEADER' || 
                    comp.type === 'BODY' || 
                    comp.type === 'FOOTER'
                );
                
                if (needsComponents) {
                    correctPayload.template.components = [];
                    
                    templateData.components.forEach((comp: any) => {
                        if (comp.type === 'BODY') {
                            correctPayload.template.components.push({
                                type: "body"
                            });
                        }
                        
                        if (comp.type === 'FOOTER') {
                            correctPayload.template.components.push({
                                type: "footer"
                            });
                        }
                        
                        if (comp.type === 'HEADER') {
                            correctPayload.template.components.push({
                                type: "header"
                            });
                        }
                    });
                }
                
                console.log('📦 PAYLOAD CORRECTO SUGERIDO:');
                console.log('═══════════════════════════════════════════════════════════════');
                console.log(JSON.stringify(correctPayload, null, 2));
                console.log('═══════════════════════════════════════════════════════════════');
                
                // Probar este payload
                console.log('\n🧪 PROBANDO PAYLOAD CORREGIDO...');
                
                const sendUrl = `https://graph.facebook.com/v18.0/725315067342333/messages`;
                
                const sendResponse = await fetch(sendUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${accessToken}`
                    },
                    body: JSON.stringify(correctPayload)
                });
                
                const sendResult = await sendResponse.json();
                
                if (sendResponse.ok) {
                    console.log('🎉 ¡ÉXITO! MENSAJE ENVIADO CORRECTAMENTE');
                    console.log(`✅ Message ID: ${sendResult.messages[0].id}`);
                    console.log(`✅ Status: ${sendResult.messages[0].message_status}`);
                } else {
                    console.log('❌ Error con payload corregido:');
                    console.log(JSON.stringify(sendResult, null, 2));
                }
                
            } else {
                console.log('⚠️ No se encontraron componentes en la plantilla');
            }
            
        } else {
            console.log('❌ Error obteniendo plantilla:', templateData);
        }
        
    } catch (error) {
        console.error('💥 Error en consulta:', error);
    }
}

getTemplateExactStructure().catch(console.error);
