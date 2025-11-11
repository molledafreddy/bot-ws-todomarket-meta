// 🔍 DEBUG: Herramienta para encontrar catálogos disponibles
// Ejecutar con: node find-catalogs.cjs

require('dotenv/config');

// Importar fetch para Node.js si no está disponible globalmente
const fetch = globalThis.fetch || require('node-fetch');

// Función para obtener todos los catálogos disponibles
async function findAvailableCatalogs(accessToken) {
    try {
        console.log('\n🔍 === BUSCANDO CATÁLOGOS DISPONIBLES ===');
        console.log('🔑 Token disponible:', !!accessToken);
        
        if (!accessToken) {
            console.log('❌ No se encontró token de acceso');
            return;
        }
        
        // Método 1: Obtener información del usuario/negocio actual
        console.log('\n📡 Método 1: Obteniendo información del token actual...');
        
        const meUrl = 'https://graph.facebook.com/v22.0/me';
        const meParams = {
            fields: 'id,name,business',
            access_token: accessToken
        };
        
        const meQueryString = new URLSearchParams(meParams).toString();
        const meFullUrl = `${meUrl}?${meQueryString}`;
        
        console.log('🔗 URL me:', meFullUrl.replace(accessToken, '***TOKEN***'));
        
        const meResponse = await fetch(meFullUrl);
        console.log('📊 Status me:', meResponse.status, meResponse.statusText);
        
        if (meResponse.ok) {
            const meData = await meResponse.json();
            console.log('✅ Información del token:');
            console.log('📋 Datos:', JSON.stringify(meData, null, 2));
            
            // Si tenemos un business ID, intentar obtener sus catálogos
            if (meData.business && meData.business.id) {
                console.log('\n📡 Método 2: Obteniendo catálogos del negocio...');
                await findBusinessCatalogs(meData.business.id, accessToken);
            }
            
        } else {
            const errorText = await meResponse.text();
            console.log('❌ Error obteniendo info del token:', errorText);
        }
        
        // Método 3: Intentar obtener catálogos directamente
        console.log('\n📡 Método 3: Intentando obtener catálogos directamente...');
        
        const catalogsUrl = 'https://graph.facebook.com/v22.0/me/owned_product_catalogs';
        const catalogsParams = {
            fields: 'id,name,business,product_count',
            access_token: accessToken
        };
        
        const catalogsQueryString = new URLSearchParams(catalogsParams).toString();
        const catalogsFullUrl = `${catalogsUrl}?${catalogsQueryString}`;
        
        console.log('🔗 URL catálogos:', catalogsFullUrl.replace(accessToken, '***TOKEN***'));
        
        const catalogsResponse = await fetch(catalogsFullUrl);
        console.log('📊 Status catálogos:', catalogsResponse.status, catalogsResponse.statusText);
        
        if (catalogsResponse.ok) {
            const catalogsData = await catalogsResponse.json();
            console.log('✅ Catálogos encontrados:');
            console.log('📋 Datos:', JSON.stringify(catalogsData, null, 2));
            
            if (catalogsData.data && catalogsData.data.length > 0) {
                console.log('\n📦 CATÁLOGOS DISPONIBLES:');
                console.log('==========================');
                
                catalogsData.data.forEach((catalog, index) => {
                    console.log(`${index + 1}. ID: ${catalog.id}`);
                    console.log(`   Nombre: ${catalog.name || 'N/A'}`);
                    console.log(`   Productos: ${catalog.product_count || 'N/A'}`);
                    console.log(`   Negocio: ${catalog.business ? catalog.business.name : 'N/A'}`);
                    console.log('   ---');
                });
            }
        } else {
            const errorText = await catalogsResponse.text();
            console.log('❌ Error obteniendo catálogos:', errorText);
        }
        
        console.log('\n=== FIN BÚSQUEDA CATÁLOGOS ===\n');
        
    } catch (error) {
        console.error('❌ Error buscando catálogos:', error);
    }
}

// Función para obtener catálogos de un negocio específico
async function findBusinessCatalogs(businessId, accessToken) {
    try {
        console.log('📋 Business ID:', businessId);
        
        const businessCatalogsUrl = `https://graph.facebook.com/v22.0/${businessId}/owned_product_catalogs`;
        const businessCatalogsParams = {
            fields: 'id,name,business,product_count',
            access_token: accessToken
        };
        
        const businessCatalogsQueryString = new URLSearchParams(businessCatalogsParams).toString();
        const businessCatalogsFullUrl = `${businessCatalogsUrl}?${businessCatalogsQueryString}`;
        
        console.log('🔗 URL catálogos del negocio:', businessCatalogsFullUrl.replace(accessToken, '***TOKEN***'));
        
        const businessCatalogsResponse = await fetch(businessCatalogsFullUrl);
        console.log('📊 Status catálogos del negocio:', businessCatalogsResponse.status, businessCatalogsResponse.statusText);
        
        if (businessCatalogsResponse.ok) {
            const businessCatalogsData = await businessCatalogsResponse.json();
            console.log('✅ Catálogos del negocio:');
            console.log('📋 Datos:', JSON.stringify(businessCatalogsData, null, 2));
        } else {
            const errorText = await businessCatalogsResponse.text();
            console.log('❌ Error obteniendo catálogos del negocio:', errorText);
        }
        
    } catch (error) {
        console.error('❌ Error obteniendo catálogos del negocio:', error);
    }
}

// Función para verificar permisos del token
async function checkTokenPermissions(accessToken) {
    try {
        console.log('\n🔍 === VERIFICANDO PERMISOS DEL TOKEN ===');
        
        const permissionsUrl = 'https://graph.facebook.com/v22.0/me/permissions';
        const permissionsParams = {
            access_token: accessToken
        };
        
        const permissionsQueryString = new URLSearchParams(permissionsParams).toString();
        const permissionsFullUrl = `${permissionsUrl}?${permissionsQueryString}`;
        
        console.log('🔗 URL permisos:', permissionsFullUrl.replace(accessToken, '***TOKEN***'));
        
        const permissionsResponse = await fetch(permissionsFullUrl);
        console.log('📊 Status permisos:', permissionsResponse.status, permissionsResponse.statusText);
        
        if (permissionsResponse.ok) {
            const permissionsData = await permissionsResponse.json();
            console.log('✅ Permisos del token:');
            
            if (permissionsData.data && permissionsData.data.length > 0) {
                console.log('\n🔑 PERMISOS OTORGADOS:');
                console.log('=====================');
                
                const grantedPermissions = permissionsData.data.filter(p => p.status === 'granted');
                const declinedPermissions = permissionsData.data.filter(p => p.status === 'declined');
                
                console.log('✅ Concedidos:');
                grantedPermissions.forEach(permission => {
                    console.log(`   - ${permission.permission}`);
                });
                
                if (declinedPermissions.length > 0) {
                    console.log('\n❌ Rechazados:');
                    declinedPermissions.forEach(permission => {
                        console.log(`   - ${permission.permission}`);
                    });
                }
                
                // Verificar permisos específicos para catálogos
                const catalogPermissions = [
                    'catalog_management',
                    'business_management',
                    'whatsapp_business_messaging',
                    'whatsapp_business_management'
                ];
                
                console.log('\n🎯 PERMISOS PARA CATÁLOGOS:');
                console.log('===========================');
                
                catalogPermissions.forEach(requiredPerm => {
                    const hasPermission = grantedPermissions.some(p => p.permission === requiredPerm);
                    console.log(`${hasPermission ? '✅' : '❌'} ${requiredPerm}`);
                });
            }
        } else {
            const errorText = await permissionsResponse.text();
            console.log('❌ Error obteniendo permisos:', errorText);
        }
        
        console.log('\n=== FIN VERIFICACIÓN PERMISOS ===\n');
        
    } catch (error) {
        console.error('❌ Error verificando permisos:', error);
    }
}

// Ejecutar la búsqueda
async function main() {
    console.log('🚀 INICIANDO BÚSQUEDA DE CATÁLOGOS');
    console.log('==================================');
    
    const accessToken = process.env.JWT_TOKEN;
    
    if (!accessToken) {
        console.log('❌ No se encontró JWT_TOKEN en las variables de entorno');
        return;
    }
    
    // 1. Verificar permisos del token
    await checkTokenPermissions(accessToken);
    
    // 2. Buscar catálogos disponibles
    await findAvailableCatalogs(accessToken);
    
    console.log('✅ Búsqueda completada');
    console.log('\n💡 RECOMENDACIONES:');
    console.log('===================');
    console.log('1. Usa uno de los catalog IDs encontrados arriba');
    console.log('2. Verifica que tengas los permisos necesarios');
    console.log('3. Si no aparecen catálogos, crea uno en Meta Business Manager');
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    findAvailableCatalogs,
    checkTokenPermissions
};
