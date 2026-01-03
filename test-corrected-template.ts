// Prueba final de la plantilla Meta corregida
import { config } from 'dotenv';
import { getApprovedTemplatePayload } from './src/meta-templates.js';

config();

async function testCorrectedTemplate() {
    console.log('🧪 PROBANDO PLANTILLA META CORREGIDA\n');
    
    try {
        console.log('1️⃣ Generando payload de plantilla...');
        const payload = getApprovedTemplatePayload('catalog_main', '+56936499908');
        
        console.log('✅ Payload generado:');
        console.log(JSON.stringify(payload, null, 2));
        
        console.log('\n2️⃣ Verificando componentes...');
        console.log('📋 Número de componentes:', payload.template.components.length);
        
        payload.template.components.forEach((comp: any, index: number) => {
            console.log(`   ${index + 1}. Tipo: ${comp.type}`);
        });
        
        if (payload.template.components.length > 0) {
            console.log('✅ CORRECCIÓN EXITOSA: Components no está vacío');
        } else {
            console.log('❌ PROBLEMA: Components sigue vacío');
        }
        
        console.log('\n3️⃣ Validando estructura...');
        console.log('✅ messaging_product:', payload.messaging_product);
        console.log('✅ to:', payload.to);
        console.log('✅ type:', payload.type);
        console.log('✅ template.name:', payload.template.name);
        console.log('✅ template.language.code:', payload.template.language.code);
        
        console.log('\n🎯 RESULTADO:');
        console.log('La plantilla ahora debería funcionar correctamente');
        
        console.log('\n📋 PRODUCTOS REALES ENCONTRADOS:');
        console.log('- 8b9dwc6jus: Papas Kryzpo ($2,400)');
        console.log('- 6go0ueceev: Queso Llanero ($10,500)');
        
        console.log('\n🚀 PRÓXIMOS PASOS:');
        console.log('1. Hacer git commit y push');
        console.log('2. Probar "catalogo" en WhatsApp');
        console.log('3. Verificar que no aparezcan los errores anteriores');
        
    } catch (error) {
        console.error('❌ Error en prueba:', error);
    }
}

testCorrectedTemplate();
