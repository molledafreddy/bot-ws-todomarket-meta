/**
 * 🎯 FLOWPRINCIPAL CON CARRITO INTERACTIVO INTEGRADO
 * Solución directa sin dependencias externas para garantizar que funcione
 */

import { addKeyword, utils } from '@builderbot/bot'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { MongoAdapter as Database } from '@builderbot/database-mongo'
import { start, stop, reset, IDLETIME } from './idle-custom'
import { 
    syncAndGetProducts,
    generateCategoriesList
} from './carrito-simple'

// ===== FUNCIÓN PARA ENVIAR LISTAS INTERACTIVAS =====
async function sendInteractiveMessage(phoneNumber: string, payload: any): Promise<void> {
    const ACCESS_TOKEN = process.env.JWT_TOKEN!;
    try {
        const response = await fetch(`https://graph.facebook.com/v18.0/${process.env.NUMBER_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...payload,
                to: phoneNumber
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Error enviando mensaje interactivo:', errorData);
            throw new Error('Error API Meta');
        }
        
        console.log('✅ Lista interactiva enviada exitosamente');
    } catch (error) {
        console.error('❌ Error en sendInteractiveMessage:', error);
        throw error;
    }
}

// ===== FLOW PRINCIPAL CON CARRITO INTEGRADO =====
export const flowPrincipalInteractivo = addKeyword<Provider, Database>(utils.setEvent('welcome'))
    .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
    .addAnswer([
        '🚚 Hola, Bienvenido a *Minimarket TodoMarket* 🛵', 
        '⌛ Horario disponible desde las 2:00 PM hasta las 10:00 PM. ⌛',
        '📝 a través de este canal te ofrecemos los siguientes servicios de compra:'
    ], { delay: 1000 })
    .addAnswer(
        [
            '*Indica el Número de la opción que desees:*', 
            '👉 #1 Carrito de compra interactivo 🛒', 
            '👉 #2 Conversar con un Agente 👥', 
        ].join('\n'),
        { capture: true, delay: 2000, idle: 900000 },
        async (ctx, { provider, fallBack, gotoFlow, state, endFlow }) => {
            console.log('🎯 Input recibido en flowPrincipalInteractivo:', ctx.body)
            const userInput = ctx.body.toLowerCase().trim();
            
            // Opción 1: Carrito interactivo
            if (userInput === '1') {
                stop(ctx)
                console.log('🛒 === INICIANDO CARRITO INTERACTIVO INTEGRADO ===');
                console.log('👤 Usuario:', ctx.from, ctx.pushName);

                try {
                    // Configuración del carrito
                    const CATALOG_ID = '1057244946408276';
                    const ACCESS_TOKEN = process.env.JWT_TOKEN!;
                    
                    console.log('📡 Sincronizando productos desde Meta API...');
                    
                    // Sincronizar productos desde Meta API
                    const productsByCategory = await syncAndGetProducts(CATALOG_ID, ACCESS_TOKEN);
                    
                    if (Object.keys(productsByCategory).length === 0) {
                        console.error('❌ No se pudieron cargar productos del catálogo');
                        return endFlow([
                            '❌ *Error temporal*',
                            '',
                            'No pudimos cargar el catálogo en este momento.',
                            'Intenta en unos minutos o contacta al +56 9 7964 3935'
                        ].join('\n'));
                    }

                    // Guardar productos en el state
                    await state.update({ 
                        productsByCategory,
                        lastSync: new Date().toISOString(),
                        cart: [] // Inicializar carrito vacío
                    });

                    console.log(`✅ ${Object.keys(productsByCategory).length} categorías cargadas exitosamente`);

                    // Generar lista interactiva de categorías
                    const categoriesList = generateCategoriesList(productsByCategory);
                    
                    if (!categoriesList) {
                        console.error('❌ No se pudo generar lista de categorías');
                        return endFlow([
                            '⚠️ *Catálogo temporalmente vacío*',
                            '',
                            'Estamos actualizando nuestro inventario.',
                            'Contacta directamente al +56 9 7964 3935'
                        ].join('\n'));
                    }

                    console.log('📋 Lista de categorías generada correctamente');
                    
                    // Enviar mensaje de bienvenida
                    await provider.sendText(ctx.from, [
                        '🛒 *¡Carrito Interactivo Activado!*',
                        '',
                        '🎯 *Cómo usar:*',
                        '👆 Toca una categoría en la lista que aparecerá',
                        '🛍️ Toca productos para agregarlos automáticamente',
                        '📱 Todo es visual - sin escribir comandos',
                        '',
                        '⏳ *Cargando lista interactiva...*'
                    ].join('\n'));
                    
                    // Pequeña pausa para procesar
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    console.log('🚀 Enviando lista interactiva de categorías...');
                    
                    // Enviar lista interactiva
                    await sendInteractiveMessage(ctx.from, categoriesList);
                    
                    console.log('✅ Lista interactiva de categorías enviada exitosamente');
                    
                    return endFlow([
                        '✅ *¡Lista interactiva enviada!*',
                        '',
                        '👆 *Selecciona una categoría de la lista superior*',
                        '🛒 Los productos se agregarán automáticamente',
                        '📱 Usa las listas para navegar fácilmente',
                        '',
                        '💡 *¡Es súper fácil!* Solo toca las opciones'
                    ].join('\n'));

                } catch (error) {
                    console.error('❌ Error crítico en carrito interactivo:', error);
                    return endFlow([
                        '❌ *Error técnico*',
                        '',
                        'Hubo un problema activando el carrito interactivo.',
                        '',
                        '📞 Contacta directamente al:',
                        '*+56 9 7964 3935*',
                        '',
                        'Para hacer tu pedido manualmente.'
                    ].join('\n'));
                }
            }

            // Opción 2: Agente
            if (userInput === '2' || userInput.includes('agente')) {
                stop(ctx)
                console.log('👥 Usuario seleccionó opción 2 - Agente');
                return endFlow([
                    '👥 *Conectando con agente*',
                    '',
                    '📞 Contacta directamente al:',
                    '*+56 9 7964 3935*',
                    '',
                    '🕐 *Horario de atención:*',
                    '2:00 PM - 10:00 PM',
                    '',
                    '¡Te atenderemos lo antes posible!'
                ].join('\n'));
            }
            
            // Opción inválida
            console.log('❌ Opción inválida recibida:', ctx.body);
            reset(ctx, gotoFlow, IDLETIME)
            return fallBack([
                '*Opción no válida*',
                '',
                'Por favor selecciona una opción válida:',
                '👉 #1 Carrito de compra interactivo',
                '👉 #2 Conversar con un Agente'
            ].join('\n'));
        }
    );
