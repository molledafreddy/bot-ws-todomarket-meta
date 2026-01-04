// Asistente interactivo para configuración de catálogo Meta
import { config } from 'dotenv';
import * as readline from 'readline';

config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function interactiveGuide() {
    console.log('🎯 ASISTENTE INTERACTIVO PARA CONFIGURACIÓN DE CATÁLOGO META');
    console.log('=' .repeat(70));
    console.log('Responde con números o sí/no según corresponda\n');

    // PASO 1: Verificar acceso a Business Manager
    console.log('📍 PASO 1: Acceso a Meta Business Manager');
    console.log('-'.repeat(50));
    
    const hasAccess = await askQuestion('¿Puedes acceder a https://business.facebook.com? (si/no): ');
    
    if (hasAccess !== 'si' && hasAccess !== 'sí') {
        console.log('\n❌ Necesitas acceso a Business Manager primero.');
        console.log('📋 Solución: Pide acceso al administrador del negocio.');
        rl.close();
        return;
    }

    // PASO 2: Ubicar Commerce/Catálogos
    console.log('\n📦 PASO 2: Encontrar los catálogos');
    console.log('-'.repeat(50));
    console.log('En tu pantalla de Business Manager, ¿ves alguna de estas opciones?');
    console.log('1. Commerce Manager');
    console.log('2. Catálogos');
    console.log('3. Productos');
    console.log('4. Data Sources');
    console.log('5. No veo ninguna de estas');
    
    const commerceOption = await askQuestion('Escribe el número de la opción que ves: ');
    
    let guidance = '';
    switch(commerceOption) {
        case '1':
            guidance = '✅ Perfecto! Haz clic en "Commerce Manager"';
            break;
        case '2':
            guidance = '✅ Excelente! Haz clic en "Catálogos"';
            break;
        case '3':
            guidance = '✅ Bien! Haz clic en "Productos"';
            break;
        case '4':
            guidance = '✅ Genial! Haz clic en "Data Sources" y busca "Catalogs"';
            break;
        case '5':
            guidance = '🔍 Busca en "Todas las herramientas" o "Ver todas las herramientas"';
            break;
        default:
            guidance = '❓ Intenta buscar con Ctrl+F: "Commerce" o ve a todas las herramientas';
    }
    
    console.log(`\n${guidance}\n`);

    // PASO 3: Verificar catálogos
    console.log('📋 PASO 3: Identificar el catálogo correcto');
    console.log('-'.repeat(50));
    
    const canSeeCatalogs = await askQuestion('¿Puedes ver una lista de catálogos ahora? (si/no): ');
    
    if (canSeeCatalogs !== 'si' && canSeeCatalogs !== 'sí') {
        console.log('\n❌ No puedes ver los catálogos.');
        console.log('📋 Posibles soluciones:');
        console.log('1. Ve a: https://business.facebook.com/commerce/');
        console.log('2. Busca "Commerce Manager" en el buscador de la página');
        console.log('3. Verifica que tengas permisos de administrador');
        rl.close();
        return;
    }

    console.log('\n¿Ves un catálogo llamado "Catálogo_productos" con aproximadamente 216 productos?');
    const hasTargetCatalog = await askQuestion('(si/no): ');
    
    if (hasTargetCatalog !== 'si' && hasTargetCatalog !== 'sí') {
        console.log('\n❌ No encuentras el catálogo correcto.');
        console.log('📋 Busca cualquier catálogo que tenga la mayor cantidad de productos.');
        console.log('🎯 El objetivo es usar el catálogo con más productos (idealmente 200+).');
    } else {
        console.log('\n✅ ¡Perfecto! Haz clic en "Catálogo_productos"');
    }

    // PASO 4: Buscar opciones de WhatsApp
    console.log('\n📱 PASO 4: Configurar WhatsApp Business');
    console.log('-'.repeat(50));
    console.log('Una vez dentro del catálogo, ¿ves alguna de estas opciones?');
    console.log('1. WhatsApp o WhatsApp Business');
    console.log('2. Sales Channels (Canales de venta)');
    console.log('3. Settings o Configuración');
    console.log('4. Integration o Integración');
    console.log('5. No veo ninguna de estas');
    
    const whatsappOption = await askQuestion('Escribe el número: ');
    
    let whatsappGuidance = '';
    switch(whatsappOption) {
        case '1':
            whatsappGuidance = '🎯 ¡Excelente! Haz clic en la opción de WhatsApp';
            break;
        case '2':
            whatsappGuidance = '✅ Perfecto! Entra a "Sales Channels" y busca WhatsApp';
            break;
        case '3':
            whatsappGuidance = '⚙️ Ve a "Settings" y busca opciones de WhatsApp o channels';
            break;
        case '4':
            whatsappGuidance = '🔗 Entra a "Integration" y busca WhatsApp Business';
            break;
        case '5':
            whatsappGuidance = '🔍 Presiona Ctrl+F y busca "WhatsApp" en la página';
            break;
        default:
            whatsappGuidance = '❓ Busca cualquier botón que diga "Conectar" o "Connect"';
    }
    
    console.log(`\n${whatsappGuidance}\n`);

    // PASO 5: Estado de conexión
    console.log('🔗 PASO 5: Estado de la conexión');
    console.log('-'.repeat(50));
    
    const connectionStatus = await askQuestion('¿Qué estado ves para WhatsApp? (conectado/desconectado/no_aparece): ');
    
    switch(connectionStatus) {
        case 'conectado':
            console.log('\n🤔 Si ya está conectado pero no funciona...');
            console.log('📋 Soluciones:');
            console.log('1. Desconectar y volver a conectar');
            console.log('2. Verificar que esté seleccionado "Minimarket Todomarket"');
            console.log('3. Revisar que todos los productos estén "Published"');
            break;
            
        case 'desconectado':
            console.log('\n🎯 ¡Exacto! Ese es el problema.');
            console.log('✅ Haz clic en "Conectar" o "Connect"');
            console.log('📱 Selecciona "Minimarket Todomarket (+56 9 7964 3935)"');
            console.log('✅ Confirma la conexión');
            break;
            
        case 'no_aparece':
            console.log('\n❓ WhatsApp no aparece como opción...');
            console.log('📋 Intenta:');
            console.log('1. Ve a WhatsApp Manager primero');
            console.log('2. Verifica que WA Business esté activo');
            console.log('3. Regresa al Commerce Manager');
            break;
    }

    // PASO 6: Prueba final
    console.log('\n🧪 PASO 6: Prueba de funcionamiento');
    console.log('-'.repeat(50));
    console.log('¿Quieres que ejecute una prueba para verificar si funcionó?');
    
    const runTest = await askQuestion('(si/no): ');
    
    if (runTest === 'si' || runTest === 'sí') {
        console.log('\n🚀 Ejecutando prueba...');
        await runConnectionTest();
    }

    console.log('\n🎉 ¡Asistencia completada!');
    console.log('📱 Ahora prueba enviar un catálogo desde WhatsApp y verifica que puedas ver los productos.');
    
    rl.close();
}

async function runConnectionTest() {
    try {
        const accessToken = process.env.JWT_TOKEN;
        const numberId = process.env.NUMBER_ID;
        
        const testPayload = {
            messaging_product: "whatsapp",
            to: "56936499908",
            type: "interactive",
            interactive: {
                type: "catalog_message",
                body: {
                    text: "🧪 Test post-configuración\n¿Los productos se ven ahora?"
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
            console.log('✅ Catálogo enviado exitosamente!');
            console.log(`📱 Mensaje ID: ${result.messages?.[0]?.id}`);
            console.log('🔍 Abre WhatsApp y verifica que puedas ver los productos.');
        } else {
            const errorText = await response.text();
            console.log('❌ Aún hay problemas:', errorText.substring(0, 200));
            console.log('🔄 Repite los pasos de configuración.');
        }
        
    } catch (error) {
        console.log('❌ Error en la prueba:', error.message);
    }
}

console.log('🎯 ¡Bienvenido al Asistente de Configuración de Catálogo Meta!');
console.log('📋 Te guiaré paso a paso según lo que veas en tu pantalla.\n');

interactiveGuide();
