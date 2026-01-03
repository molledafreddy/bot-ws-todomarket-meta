// Script para verificar qué número tiene catálogo asociado
import { config } from 'dotenv';

config();

async function testBothNumbers() {
    console.log('🔍 ANÁLISIS DE NÚMEROS DE WHATSAPP BUSINESS\n');
    
    const accessToken = process.env.JWT_TOKEN;
    if (!accessToken) {
        console.error('❌ Falta JWT_TOKEN');
        return;
    }
    
    const numbers = [
        { name: 'NUMBER_ID oficial (.env)', number: '725315067342333' },
        { name: 'Número alternativo', number: '56979643935' }
    ];
    
    for (const { name, number } of numbers) {
        console.log(`\n📱 PROBANDO: ${name} (${number})`);
        console.log('='.repeat(50));
        
        try {
            // Test 1: Información del número
            console.log('📋 Test 1: Obteniendo información del número...');
            const infoUrl = `https://graph.facebook.com/v18.0/${number}`;
            const infoParams = new URLSearchParams({
                fields: 'id,verified_name,display_phone_number,quality_rating',
                access_token: accessToken
            });
            
            const infoResponse = await fetch(`${infoUrl}?${infoParams}`);
            
            if (infoResponse.ok) {
                const infoData = await infoResponse.json();
                console.log('✅ Información obtenida:');
                console.log(`   - ID: ${infoData.id}`);
                console.log(`   - Nombre verificado: ${infoData.verified_name || 'N/A'}`);
                console.log(`   - Número mostrado: ${infoData.display_phone_number || 'N/A'}`);
                console.log(`   - Calidad: ${infoData.quality_rating || 'N/A'}`);
            } else {
                const errorText = await infoResponse.text();
                console.log('❌ Error obteniendo información:', infoResponse.status);
                console.log('   Detalle:', errorText);
                continue; // Si no puede obtener info, saltar al siguiente
            }
            
            // Test 2: Probar envío de catálogo
            console.log('\n🛍️ Test 2: Probando mensaje de catálogo...');
            const catalogPayload = {
                messaging_product: "whatsapp",
                to: "56936499908", // Tu número para prueba
                type: "interactive",
                interactive: {
                    type: "catalog_message",
                    body: {
                        text: `🧪 Prueba de catálogo con ${number}`
                    },
                    action: {
                        name: "catalog_message"
                    }
                }
            };
            
            const catalogUrl = `https://graph.facebook.com/v18.0/${number}/messages`;
            const catalogResponse = await fetch(catalogUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(catalogPayload)
            });
            
            if (catalogResponse.ok) {
                const result = await catalogResponse.json();
                console.log('✅ CATÁLOGO FUNCIONA con este número');
                console.log('   Mensaje ID:', result.messages?.[0]?.id || 'N/A');
            } else {
                const errorText = await catalogResponse.text();
                console.log('❌ Error con catálogo:', catalogResponse.status);
                console.log('   Detalle:', errorText);
                
                // Analizar el tipo de error
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorText.includes('catalog') && errorText.includes('not found')) {
                        console.log('📋 DIAGNÓSTICO: Este número NO tiene catálogo asociado');
                    } else if (errorText.includes('Products not found')) {
                        console.log('📋 DIAGNÓSTICO: Este número SÍ tiene catálogo, pero problemas con productos');
                    }
                } catch (e) {
                    // Ignorar errores de parsing
                }
            }
            
        } catch (error) {
            console.error(`❌ Error general con ${number}:`, error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar entre pruebas
    }
    
    console.log('\n🎯 CONCLUSIÓN:');
    console.log('- El número que devuelva ✅ CATÁLOGO FUNCIONA es el correcto');
    console.log('- Si ambos fallan, revisar configuración de catálogo en Meta Business');
    console.log('- Si uno tiene "Products not found", ese ES el número correcto');
}

testBothNumbers();
