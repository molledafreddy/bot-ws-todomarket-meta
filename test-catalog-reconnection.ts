// Test rápido para confirmar reconexión del catálogo
import { config } from 'dotenv';

config();

async function testCatalogReconnection() {
    console.log('🔄 TEST DE RECONEXIÓN DE CATÁLOGO META\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const numberId = process.env.NUMBER_ID;
    
    // Test básico de catálogo
    const catalogPayload = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "interactive",
        interactive: {
            type: "catalog_message",
            body: {
                text: "🧪 Test post-reconexión\n\n¿Los productos se ven correctamente ahora?"
            },
            action: {
                name: "catalog_message"
            }
        }
    };
    
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${numberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(catalogPayload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Catálogo enviado exitosamente');
            console.log(`📱 Mensaje ID: ${result.messages?.[0]?.id}`);
            console.log('\n🎯 INSTRUCCIONES:');
            console.log('1. Abre WhatsApp y busca el mensaje');
            console.log('2. Toca el catálogo');
            console.log('3. Verifica si ahora SÍ puedes ver los productos');
            console.log('4. Si funciona = Problema resuelto ✅');
            console.log('5. Si sigue fallando = Necesitamos más investigación');
        } else {
            const errorText = await response.text();
            console.log('❌ Error:', errorText);
        }
        
    } catch (error) {
        console.log('❌ Excepción:', error.message);
    }
}

testCatalogReconnection();
