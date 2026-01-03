// Script para encontrar los productos reales en tu catálogo de Meta
import { config } from 'dotenv';

config();

async function findRealProducts() {
    console.log('🔍 BUSCANDO PRODUCTOS REALES EN TU CATÁLOGO META\n');
    
    const accessToken = process.env.JWT_TOKEN;
    const numberId = process.env.NUMBER_ID;
    
    if (!accessToken || !numberId) {
        console.error('❌ Faltan variables de entorno JWT_TOKEN o NUMBER_ID');
        return;
    }
    
    try {
        console.log('📡 Consultando tu catálogo desde NUMBER_ID:', numberId);
        
        // Obtener información del número de WhatsApp Business
        const phoneInfoUrl = `https://graph.facebook.com/v18.0/${numberId}`;
        const phoneParams = new URLSearchParams({
            fields: 'id,verified_name,display_phone_number',
            access_token: accessToken
        });
        
        console.log('📞 Obteniendo info del número...');
        const phoneResponse = await fetch(`${phoneInfoUrl}?${phoneParams}`);
        
        if (phoneResponse.ok) {
            const phoneData = await phoneResponse.json();
            console.log('✅ Info del número:', JSON.stringify(phoneData, null, 2));
        }
        
        // Intentar obtener catálogos asociados al business
        const businessId = '1349962220108819'; // Tu business ID
        console.log('\n📋 Obteniendo catálogos del business...');
        
        const catalogsUrl = `https://graph.facebook.com/v18.0/${businessId}/owned_product_catalogs`;
        const catalogsParams = new URLSearchParams({
            fields: 'id,name,product_count',
            access_token: accessToken
        });
        
        const catalogsResponse = await fetch(`${catalogsUrl}?${catalogsParams}`);
        
        if (catalogsResponse.ok) {
            const catalogsData = await catalogsResponse.json();
            console.log('📦 Catálogos encontrados:', JSON.stringify(catalogsData, null, 2));
            
            // Si hay catálogos, obtener productos del primero
            if (catalogsData.data && catalogsData.data.length > 0) {
                const catalogId = catalogsData.data[0].id;
                console.log(`\n🛍️ Obteniendo productos del catálogo: ${catalogId}`);
                
                const productsUrl = `https://graph.facebook.com/v18.0/${catalogId}/products`;
                const productsParams = new URLSearchParams({
                    fields: 'id,name,description,price,currency,retailer_id,availability',
                    access_token: accessToken,
                    limit: '20'
                });
                
                const productsResponse = await fetch(`${productsUrl}?${productsParams}`);
                
                if (productsResponse.ok) {
                    const productsData = await productsResponse.json();
                    console.log('\n✅ PRODUCTOS ENCONTRADOS:');
                    console.log('=========================');
                    
                    if (productsData.data && productsData.data.length > 0) {
                        productsData.data.forEach((product: any, index: number) => {
                            console.log(`${index + 1}. ID: ${product.id}`);
                            console.log(`   Retailer ID: ${product.retailer_id || 'N/A'}`);
                            console.log(`   Nombre: ${product.name || 'N/A'}`);
                            console.log(`   Precio: ${product.price || 'N/A'} ${product.currency || ''}`);
                            console.log(`   Disponible: ${product.availability || 'N/A'}`);
                            console.log('   ---');
                        });
                        
                        // Sugerir el primer producto para usar como thumbnail
                        const firstProduct = productsData.data[0];
                        if (firstProduct.retailer_id) {
                            console.log(`\n💡 SUGERENCIA: Usar este retailer_id en app.ts:`);
                            console.log(`thumbnail_product_retailer_id: "${firstProduct.retailer_id}"`);
                        }
                        
                    } else {
                        console.log('❌ No se encontraron productos en el catálogo');
                    }
                } else {
                    const productsError = await productsResponse.text();
                    console.error('❌ Error obteniendo productos:', productsError);
                }
            }
        } else {
            const catalogsError = await catalogsResponse.text();
            console.error('❌ Error obteniendo catálogos:', catalogsError);
        }
        
    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

findRealProducts();
