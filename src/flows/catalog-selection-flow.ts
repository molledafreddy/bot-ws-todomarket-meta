import { addKeyword } from '@builderbot/bot';
import { ENABLED_CATALOGS, sendSpecificCatalog } from '../config/multi-catalog-config';

export const flowCatalogSelection = addKeyword(['catalogos', 'explorar'])
    .addAnswer([
        '🛍️ **EXPLORA NUESTROS CATÁLOGOS**',
        '',
        'Selecciona el catálogo que quieres explorar:',
        '',
        ...Object.entries(ENABLED_CATALOGS).map(([key, config], index) => 
            `${index + 1}️⃣ ${config.emoji} ${config.name}`
        ),
        '',
        '0️⃣ ↩️ Volver al menú principal',
        '',
        '💡 Escribe el número de tu opción'
    ])
    .addAction(async (ctx, { flowDynamic, gotoFlow, provider, globalState }) => {
        const userInput = ctx.body?.trim();
        const catalogKeys = Object.keys(ENABLED_CATALOGS);
        
        // Volver al menú principal
        if (userInput === '0') {
            return gotoFlow(require('../app').flowPrincipal);
        }
        
        // Seleccionar catálogo por número
        const selectedIndex = parseInt(userInput) - 1;
        
        if (selectedIndex >= 0 && selectedIndex < catalogKeys.length) {
            const catalogKey = catalogKeys[selectedIndex];
            const catalog = ENABLED_CATALOGS[catalogKey];
            
            try {
                // Guardar contexto de navegación
                await globalState.update({
                    currentCatalog: catalogKey,
                    catalogNavigation: {
                        lastCatalog: catalogKey,
                        timestamp: new Date().toISOString()
                    }
                });
                
                await flowDynamic([
                    `${catalog.emoji} **${catalog.name.toUpperCase()}**`,
                    '',
                    `📋 ${catalog.description}`,
                    '',
                    '⏳ Abriendo catálogo...'
                ]);
                
                // Enviar catálogo específico
                await sendSpecificCatalog(ctx.from, catalogKey, provider);
                
                await flowDynamic([
                    '',
                    '✅ **Catálogo enviado**',
                    '',
                    '👆 Explora productos y selecciona los que necesites',
                    '🛒 Después podrás continuar con otros catálogos',
                    '',
                    '💬 Escribe "menu" para volver al inicio'
                ]);
                
            } catch (error: any) {
                console.error('Error enviando catálogo:', error);
                await flowDynamic([
                    '❌ Error enviando el catálogo',
                    '🔧 Intenta nuevamente en unos momentos',
                    '',
                    '💬 Escribe "menu" para volver al inicio'
                ]);
            }
            
        } else {
            await flowDynamic([
                '🤔 Opción no válida',
                `👆 Selecciona un número del 1 al ${catalogKeys.length} o 0 para volver`
            ]);
        }
    });