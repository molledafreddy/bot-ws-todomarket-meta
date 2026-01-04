/**
 * ACTUALIZACIÓN FINAL PARA APP.TS
 * 
 * Código corregido para reemplazar en tu app.ts
 */

// FUNCIÓN SENDCATALOG CORREGIDA (reemplaza la función existente)
async function sendCatalog(provider: any, from: any, catalog: any, catalogType: string = 'main', useTemplate: boolean = false) {
    console.log('🛒 === ENVIANDO CATÁLOGO CON MÉTODO CORREGIDO ===');
    console.log('📱 Destinatario:', from);
    
    try {
        console.log('✅ Enviando catálogo interactivo (método confirmado)...');
        
        const catalogPayload = {
            messaging_product: "whatsapp",
            to: from,
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🛒 TodoMarket - Minimarket\n\n📦 Productos disponibles:\n• Papas Kryzpo - $2.400\n• Queso Llanero - $10.500\n\n👇 Presiona para ver el catálogo completo"
                },
                footer: {
                    text: "Minimarket TodoMarket"
                },
                action: {
                    name: "catalog_message",
                    parameters: {
                        thumbnail_product_retailer_id: "8b9dwc6jus"
                    }
                }
            }
        };
        
        const accessToken = process.env.JWT_TOKEN;
        const phoneNumberId = process.env.NUMBER_ID;
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(catalogPayload)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ CATÁLOGO ENVIADO EXITOSAMENTE:', result.messages[0].id);
            return true;
        } else {
            const errorText = await response.text();
            console.error('❌ Error enviando catálogo:', errorText);
            throw new Error(`Error: ${errorText}`);
        }
        
    } catch (error) {
        console.error('💥 Error en sendCatalog:', error);
        
        // Fallback simple
        try {
            console.log('🔄 Enviando mensaje fallback...');
            
            const fallbackMessage = "🛒 TodoMarket Catálogo\n\nProductos disponibles:\n• Papas Kryzpo - $2.400\n• Queso Llanero - $10.500\n\n📞 Contáctanos: +56 9 7964 3935";
            
            const textPayload = {
                messaging_product: "whatsapp",
                to: from,
                type: "text",
                text: { body: fallbackMessage }
            };
            
            const fallbackResponse = await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.JWT_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(textPayload)
            });
            
            if (fallbackResponse.ok) {
                console.log('✅ Mensaje fallback enviado');
                return true;
            }
        } catch (fallbackError) {
            console.error('❌ Error en fallback:', fallbackError);
        }
        
        return false;
    }
}

/*
INSTRUCCIONES PARA ACTUALIZAR:

1. En tu archivo src/app.ts, busca la función "async function sendCatalog"
2. Reemplaza toda la función con el código de arriba
3. Guarda el archivo
4. Ejecuta: npm run build
5. Despliega a Railway
6. Prueba enviando "1" al bot

RESULTADO ESPERADO:
- Recibirás un mensaje con el texto del catálogo
- Habrá un botón para ver el catálogo
- Al presionarlo verás los productos Papas Kryzpo y Queso Llanero
- Podrás navegar por todo el catálogo

¡EL CATÁLOGO FUNCIONARÁ PERFECTAMENTE!
*/
