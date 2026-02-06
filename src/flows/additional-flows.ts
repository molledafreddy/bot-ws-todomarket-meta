import { addKeyword } from '@builderbot/bot';

export const flowWelcome = addKeyword(['welcome'])
    .addAnswer(['¡Bienvenido a TodoMarket!', 'Escribe "hola" para comenzar.']);

export const flowThanks = addKeyword(['gracias', 'thanks'])
    .addAnswer(['¡De nada!', 'Estamos aquí para ayudarte.']);

export const flowContactSupport = addKeyword(['soporte', 'contacto', '3'])
    .addAnswer([
        '📞 **CONTACTO Y SOPORTE**',
        '',
        '📱 WhatsApp: +56 9 3649 9908',
        '⏰ Horario: 2:00 PM - 10:00 PM',
        '',
        '💬 También puedes escribir aquí tu consulta',
        '',
        '🔄 Escribe "menu" para volver al inicio'
    ]);

export const flowHelp = addKeyword(['help', 'ayuda', '4'])
    .addAnswer([
        '❓ **AYUDA - TODOMARKET**',
        '',
        '📋 **Comandos disponibles:**',
        '• "hola" - Menú principal',
        '• "carrito" - Ver tu carrito',
        '• "soporte" - Contactar soporte',
        '',
        '🛍️ **Para comprar:**',
        '1. Explora catálogos',
        '2. Selecciona productos',
        '3. Confirma tu pedido',
        '',
        '📞 Soporte: +56 9 3649 9908',
        '',
        '🔄 Escribe "menu" para volver al inicio'
    ]);