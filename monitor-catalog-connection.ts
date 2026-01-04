// Monitor en tiempo real del estado de conexión del catálogo
import { config } from 'dotenv';

config();

let monitorInterval: NodeJS.Timeout;

async function monitorCatalogConnection() {
    console.log('📡 MONITOR DE CONEXIÓN DE CATÁLOGO META');
    console.log('🔄 Verificando cada 10 segundos...');
    console.log('Press Ctrl+C para detener\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const numberId = process.env.NUMBER_ID;
    
    let attemptCount = 1;
    
    async function checkConnection() {
        try {
            console.log(`\n⏰ Intento ${attemptCount} - ${new Date().toLocaleTimeString()}`);
            
            // Test rápido de catálogo
            const testPayload = {
                messaging_product: "whatsapp",
                to: "56936499908",
                type: "interactive", 
                interactive: {
                    type: "catalog_message",
                    body: {
                        text: `🧪 Monitor test #${attemptCount}`
                    },
                    action: {
                        name: "catalog_message"
                    }
                }
            };
            
            const response = await fetch(`https://graph.facebook.com/v18.0/${numberId}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(testPayload)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`✅ Catálogo CONECTADO - ID: ${result.messages?.[0]?.id}`);
                console.log('📱 Revisa WhatsApp para ver si los productos se muestran');
                
                // Si funciona, preguntamos si seguir monitoreando
                if (attemptCount > 3) {
                    console.log('\n🎉 ¡El catálogo parece estar funcionando!');
                    console.log('💡 Tip: Abre WhatsApp y verifica que puedes ver los productos');
                }
            } else {
                const errorText = await response.text();
                console.log(`❌ Error: ${response.status}`);
                
                try {
                    const errorJson = JSON.parse(errorText);
                    const errorMsg = errorJson.error?.message;
                    
                    if (errorMsg?.includes('catalog')) {
                        console.log('🔍 Estado: Catálogo AÚN NO CONECTADO');
                        console.log('⏳ Continúa con la configuración en Meta Business Manager');
                    } else {
                        console.log(`📋 Error: ${errorMsg}`);
                    }
                } catch (e) {
                    console.log(`📋 Error: ${errorText.substring(0, 100)}`);
                }
            }
            
            attemptCount++;
            
        } catch (error) {
            console.log(`❌ Excepción: ${error.message}`);
        }
    }
    
    // Primera verificación inmediata
    await checkConnection();
    
    // Monitorear cada 10 segundos
    monitorInterval = setInterval(checkConnection, 10000);
}

// Manejar Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n🛑 Deteniendo monitor...');
    if (monitorInterval) {
        clearInterval(monitorInterval);
    }
    
    console.log('\n📋 RESUMEN FINAL:');
    console.log('✅ Si viste "CONECTADO" = La conexión API funciona');
    console.log('🔍 PRUEBA FINAL: Abre WhatsApp y toca el catálogo');
    console.log('🎯 Si ves productos = ¡PROBLEMA RESUELTO! 🎉');
    console.log('❌ Si sigues viendo error = Necesitamos más investigación');
    
    process.exit(0);
});

console.log('🚀 INICIANDO MONITOR DE CATÁLOGO META...\n');
console.log('📋 INSTRUCCIONES:');
console.log('1. Mantén esta terminal abierta');
console.log('2. Ve a Meta Business Manager en tu navegador');
console.log('3. Sigue los pasos de la guía');
console.log('4. Observa los cambios aquí en tiempo real');
console.log('5. Presiona Ctrl+C cuando termine\n');

monitorCatalogConnection();
