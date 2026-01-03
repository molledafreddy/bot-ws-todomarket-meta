// Script simplificado para detectar plantillas de WhatsApp Business
import { config } from 'dotenv';

// Cargar variables de entorno
config();

async function detectTemplatesViaApps() {
    const businessId = '1349962220108819'; // Desde la URL proporcionada
    const accessToken = process.env.JWT_TOKEN;
    
    if (!accessToken) {
        console.log('Variables disponibles:');
        console.log('JWT_TOKEN:', process.env.JWT_TOKEN ? 'SÍ' : 'NO');
        console.log('NUMBER_ID:', process.env.NUMBER_ID ? 'SÍ' : 'NO');
        throw new Error('❌ Falta JWT_TOKEN en variables de entorno');
    }

    console.log('🚀 DETECCIÓN DE PLANTILLAS VÍA BUSINESS APPS\n');
    console.log(`📊 Business ID: ${businessId}`);
    console.log(`🎯 Access Token: ${accessToken.substring(0, 20)}...\n`);

    try {
        // Obtener apps del negocio
        console.log('📱 Obteniendo aplicaciones del negocio...');
        const appsUrl = `https://graph.facebook.com/v18.0/${businessId}/apps`;
        const appsResponse = await fetch(`${appsUrl}?access_token=${accessToken}`);
        const appsData = await appsResponse.json();

        if (!appsResponse.ok) {
            throw new Error(`Apps Error: ${JSON.stringify(appsData)}`);
        }

        console.log('✅ Apps encontradas:', appsData);

        // Si hay apps, intentar obtener WhatsApp Business Account
        if (appsData.data && appsData.data.length > 0) {
            const appId = appsData.data[0].id;
            console.log(`📲 Usando App ID: ${appId}`);

            // Intentar obtener WhatsApp Business Accounts
            console.log('\n🏢 Buscando WhatsApp Business Accounts...');
            const wabaUrl = `https://graph.facebook.com/v18.0/${businessId}/client_whatsapp_business_accounts`;
            const wabaResponse = await fetch(`${wabaUrl}?access_token=${accessToken}`);
            const wabaData = await wabaResponse.json();

            console.log('📋 WABA Response:', JSON.stringify(wabaData, null, 2));

            if (wabaData.data && wabaData.data.length > 0) {
                const wabaId = wabaData.data[0].id;
                console.log(`✅ WhatsApp Business Account ID: ${wabaId}`);

                // Obtener plantillas
                await getTemplatesFromWABA(wabaId, accessToken);
            }
        }

        // Método alternativo: usar directamente el número de teléfono conocido
        console.log('\n🔍 MÉTODO ALTERNATIVO: Intentando con número de teléfono...');
        const phoneNumberId = process.env.NUMBER_ID;
        if (phoneNumberId) {
            await getPhoneInfo(phoneNumberId, accessToken);
        }

    } catch (error) {
        console.error('❌ Error general:', error.message);
        
        // Último recurso: probar con plantilla conocida
        console.log('\n🎯 ÚLTIMO RECURSO: Probando plantilla conocida...');
        await testKnownTemplate(accessToken);
    }
}

async function getTemplatesFromWABA(wabaId: string, accessToken: string) {
    try {
        console.log(`\n📋 Obteniendo plantillas de WABA: ${wabaId}...`);
        const templatesUrl = `https://graph.facebook.com/v18.0/${wabaId}/message_templates`;
        const params = new URLSearchParams({
            fields: 'name,status,category,language,id,components',
            access_token: accessToken,
            limit: '20'
        });

        const response = await fetch(`${templatesUrl}?${params}`);
        const data = await response.json();

        if (response.ok && data.data) {
            console.log(`✅ ${data.data.length} plantillas encontradas:`);
            data.data.forEach((template: any, index: number) => {
                console.log(`\n🏷️  Template ${index + 1}:`);
                console.log(`   Name: ${template.name}`);
                console.log(`   Status: ${template.status}`);
                console.log(`   Category: ${template.category}`);
                console.log(`   Language: ${template.language}`);
                console.log(`   ID: ${template.id}`);
                
                if (template.category === 'MARKETING' || template.name.toLowerCase().includes('catalog')) {
                    console.log(`   🎯 POSIBLE TEMPLATE DE CATÁLOGO: ${template.name}`);
                }
            });
        } else {
            console.error('❌ Error obteniendo plantillas:', JSON.stringify(data));
        }
    } catch (error) {
        console.error('❌ Error en getTemplatesFromWABA:', error.message);
    }
}

async function getPhoneInfo(phoneNumberId: string, accessToken: string) {
    try {
        console.log(`📞 Obteniendo info del número: ${phoneNumberId}...`);
        const url = `https://graph.facebook.com/v18.0/${phoneNumberId}`;
        const params = new URLSearchParams({
            fields: 'id,verified_name,display_phone_number,quality_rating',
            access_token: accessToken
        });

        const response = await fetch(`${url}?${params}`);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Información del número:', JSON.stringify(data, null, 2));
        } else {
            console.error('❌ Error info número:', JSON.stringify(data));
        }
    } catch (error) {
        console.error('❌ Error en getPhoneInfo:', error.message);
    }
}

async function testKnownTemplate(accessToken: string) {
    try {
        console.log('🧪 Probando con template ID conocido desde la URL...');
        
        // Desde la URL: https://business.facebook.com/wa/manage/message-templates/1845275256134045/?business_id=1349962220108819
        const templateId = '1845275256134045';
        
        const url = `https://graph.facebook.com/v18.0/${templateId}`;
        const params = new URLSearchParams({
            fields: 'name,status,category,language,id,components',
            access_token: accessToken
        });

        const response = await fetch(`${url}?${params}`);
        const data = await response.json();

        if (response.ok) {
            console.log('🎉 ¡TEMPLATE ENCONTRADO!');
            console.log('📋 Detalles del template:', JSON.stringify(data, null, 2));
            
            console.log('\n🔧 CONFIGURACIÓN PARA meta-templates.ts:');
            console.log(`export const CATALOG_TEMPLATE_NAME = "${data.name}";`);
            console.log(`export const CATALOG_TEMPLATE_ID = "${data.id}";`);
            
        } else {
            console.error('❌ Error probando template conocido:', JSON.stringify(data));
        }
    } catch (error) {
        console.error('❌ Error en testKnownTemplate:', error.message);
    }
}

// Ejecutar
detectTemplatesViaApps()
    .then(() => console.log('\n✅ Detección completada'))
    .catch(error => console.error('\n❌ Error final:', error.message));
