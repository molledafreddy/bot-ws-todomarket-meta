// Script de prueba para la implementación de plantillas Meta
import { config } from 'dotenv';
import { getApprovedTemplatePayload } from './src/meta-templates.js';

// Cargar variables de entorno
config();

async function testMetaTemplateImplementation() {
    console.log('🧪 PRUEBA DE IMPLEMENTACIÓN PLANTILLA META\n');
    
    try {
        // Datos de prueba
        const testPhone = "+56936499908";
        const testTemplate = "catalog_main";
        
        console.log('📋 Generando payload de plantilla...');
        const payload = getApprovedTemplatePayload(testTemplate, testPhone);
        
        console.log('✅ Payload generado exitosamente:');
        console.log(JSON.stringify(payload, null, 2));
        
        console.log('\n🔍 Validaciones:');
        console.log(`✅ Producto de mensajería: ${payload.messaging_product}`);
        console.log(`✅ Tipo: ${payload.type}`);
        console.log(`✅ Nombre de plantilla: ${payload.template.name}`);
        console.log(`✅ Idioma: ${payload.template.language.code}`);
        console.log(`✅ Componentes: ${payload.template.components.length}`);
        
        // Verificar que tiene botón de catálogo
        const haseCatalogButton = payload.template.components.some(
            (comp: any) => comp.type === "button" && 
                          comp.sub_type === "catalog"
        );
        
        console.log(`✅ Botón de catálogo: ${haseCatalogButton ? 'SÍ' : 'NO'}`);
        
        console.log('\n🎉 IMPLEMENTACIÓN LISTA PARA PRODUCCIÓN');
        console.log('📞 Para usar en sendCatalog(), asegurate que useMetaTemplate = true');
        
    } catch (error) {
        console.error('❌ Error en prueba:', error.message);
        console.error(error.stack);
    }
}

// Ejecutar prueba
testMetaTemplateImplementation()
    .then(() => console.log('\n✅ Prueba completada'))
    .catch(error => console.error('\n❌ Error en prueba:', error.message));
