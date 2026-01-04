/**
 * DIAGNÓSTICO AVANZADO - CATÁLOGO CONECTADO PERO NO FUNCIONA
 * 
 * El catálogo está conectado según Meta Business Manager, 
 * pero los mensajes fallan. Vamos a encontrar la causa exacta.
 */

import 'dotenv/config';

async function advancedCatalogDiagnosis() {
    console.log('🔬 DIAGNÓSTICO AVANZADO - CATÁLOGO CONECTADO\n');
    console.log('Sabemos que el catálogo está conectado en Meta Business Manager');
    console.log('Vamos a encontrar por qué los mensajes fallan...\n');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const accessToken = process.env.JWT_TOKEN;
    const phoneNumberId = '725315067342333';
    const catalogId = '817382327367357'; // Catalogo_todomarket
    
    try {
        // 1. Verificar productos específicos del catálogo conectado
        console.log('📦 PASO 1: Verificando productos del catálogo conectado...');
        
        const productsUrl = `https://graph.facebook.com/v18.0/${catalogId}/products`;
        const productsResponse = await fetch(`${productsUrl}?access_token=${accessToken}&fields=id,name,description,availability,condition,price,image_url,retailer_id&limit=10`);
        const productsData = await productsResponse.json();
        
        if (productsResponse.ok && productsData.data) {
            console.log(`✅ Productos encontrados: ${productsData.data.length}\n`);
            
            productsData.data.forEach((product: any, index: number) => {
                console.log(`${index + 1}. 📦 ${product.name}`);
                console.log(`   🆔 ID: ${product.id}`);
                console.log(`   🛒 Retailer ID: ${product.retailer_id || 'N/A'}`);
                console.log(`   💰 Precio: ${product.price || 'N/A'}`);
                console.log(`   📦 Disponibilidad: ${product.availability || 'N/A'}`);
                console.log(`   🖼️ Imagen: ${product.image_url ? 'Sí' : 'No'}`);
                console.log('');
            });
            
            // 2. Probar diferentes métodos de envío de catálogo
            console.log('📨 PASO 2: Probando diferentes métodos de envío...\n');
            
            // Método 1: Template sin componentes
            await testMethod1_TemplateNoComponents(phoneNumberId, accessToken!);
            
            // Método 2: Template con componentes vacíos
            await testMethod2_TemplateEmptyComponents(phoneNumberId, accessToken!);
            
            // Método 3: Mensaje interactivo con catálogo específico
            await testMethod3_InteractiveWithCatalog(phoneNumberId, accessToken!, catalogId);
            
            // Método 4: Mensaje interactivo con producto específico
            if (productsData.data.length > 0) {
                const firstProduct = productsData.data[0];
                await testMethod4_InteractiveWithProduct(phoneNumberId, accessToken!, firstProduct.retailer_id || firstProduct.id);
            }
            
        } else {
            console.log('❌ Error obteniendo productos del catálogo conectado:');
            console.log(JSON.stringify(productsData, null, 2));
        }
        
        // 3. Verificar configuración de WABA
        console.log('🏢 PASO 3: Verificando configuración avanzada de WABA...');
        
        const wabaId = '1600008590970837';
        const wabaUrl = `https://graph.facebook.com/v18.0/${wabaId}`;
        const wabaResponse = await fetch(`${wabaUrl}?access_token=${accessToken}&fields=id,name,currency,timezone_id,business_verification_status,account_review_status`);
        const wabaData = await wabaResponse.json();
        
        if (wabaResponse.ok) {
            console.log('✅ Configuración WABA:');
            console.log(`🆔 ID: ${wabaData.id}`);
            console.log(`📛 Nombre: ${wabaData.name}`);
            console.log(`💱 Moneda: ${wabaData.currency || 'No configurada'}`);
            console.log(`🌍 Zona horaria: ${wabaData.timezone_id || 'No configurada'}`);
            console.log(`✅ Verificación: ${wabaData.business_verification_status}`);
            console.log(`📊 Estado cuenta: ${wabaData.account_review_status}`);
        } else {
            console.log('❌ Error obteniendo configuración WABA:', wabaData);
        }
        
    } catch (error) {
        console.error('💥 Error en diagnóstico avanzado:', error);
    }
}

async function testMethod1_TemplateNoComponents(phoneNumberId: string, accessToken: string) {
    console.log('🧪 MÉTODO 1: Template sin componentes...');
    
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
            console.log('   ✅ MÉTODO 1 EXITOSO!');
            console.log(`   📩 Message ID: ${result.messages[0].id}\n`);
            return true;
        } else {
            console.log('   ❌ Método 1 falló:');
            console.log(`   Error: ${result.error?.message}\n`);
            return false;
        }
    } catch (error) {
        console.log('   💥 Error en método 1:', error);
        return false;
    }
}

async function testMethod2_TemplateEmptyComponents(phoneNumberId: string, accessToken: string) {
    console.log('🧪 MÉTODO 2: Template con componentes vacíos...');
    
    const payload = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "template",
        template: {
            name: "ccatalogo_todomarket",
            language: { code: "es_CL" },
            components: [
                { type: "body" },
                { type: "footer" }
            ]
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
            console.log('   ✅ MÉTODO 2 EXITOSO!');
            console.log(`   📩 Message ID: ${result.messages[0].id}\n`);
            return true;
        } else {
            console.log('   ❌ Método 2 falló:');
            console.log(`   Error: ${result.error?.message}\n`);
            return false;
        }
    } catch (error) {
        console.log('   💥 Error en método 2:', error);
        return false;
    }
}

async function testMethod3_InteractiveWithCatalog(phoneNumberId: string, accessToken: string, catalogId: string) {
    console.log('🧪 MÉTODO 3: Mensaje interactivo con catálogo específico...');
    
    const payload = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "interactive",
        interactive: {
            type: "catalog_message",
            body: {
                text: "Explora nuestro catálogo TodoMarket"
            },
            footer: {
                text: "Minimarket TodoMarket"
            },
            action: {
                name: "catalog_message",
                parameters: {
                    catalog_id: catalogId
                }
            }
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
            console.log('   ✅ MÉTODO 3 EXITOSO!');
            console.log(`   📩 Message ID: ${result.messages[0].id}\n`);
            return true;
        } else {
            console.log('   ❌ Método 3 falló:');
            console.log(`   Error: ${result.error?.message}\n`);
            return false;
        }
    } catch (error) {
        console.log('   💥 Error en método 3:', error);
        return false;
    }
}

async function testMethod4_InteractiveWithProduct(phoneNumberId: string, accessToken: string, productId: string) {
    console.log(`🧪 MÉTODO 4: Mensaje interactivo con producto específico (${productId})...`);
    
    const payload = {
        messaging_product: "whatsapp",
        to: "56936499908",
        type: "interactive",
        interactive: {
            type: "catalog_message",
            body: {
                text: "Mira este producto de TodoMarket"
            },
            footer: {
                text: "Minimarket TodoMarket"
            },
            action: {
                name: "catalog_message",
                parameters: {
                    thumbnail_product_retailer_id: productId
                }
            }
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
            console.log('   ✅ MÉTODO 4 EXITOSO!');
            console.log(`   📩 Message ID: ${result.messages[0].id}\n`);
            return true;
        } else {
            console.log('   ❌ Método 4 falló:');
            console.log(`   Error: ${result.error?.message}\n`);
            return false;
        }
    } catch (error) {
        console.log('   💥 Error en método 4:', error);
        return false;
    }
}

advancedCatalogDiagnosis().catch(console.error);
