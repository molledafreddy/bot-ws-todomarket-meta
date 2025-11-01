import 'dotenv/config'
import moment  from "moment";
import { join } from 'path'
import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'
import { MongoAdapter as Database } from '@builderbot/database-mongo'
import { MetaProvider as Provider } from '@builderbot/provider-meta'
import { idleFlow, reset, start, stop, IDLETIME } from './idle-custom'

const PORT = process.env.PORT ?? 3008

// const discordFlow = addKeyword<Provider, Database>('doc').addAnswer(
//     ['You can see the documentation here', '📄 https://builderbot.app/docs \n', 'Do you want to continue? *yes*'].join(
//         '\n'
//     ),
//     { capture: true },
//     async (ctx, { gotoFlow, flowDynamic }) => {
//         if (ctx.body.toLocaleLowerCase().includes('yes')) {
//             return gotoFlow(registerFlow)
//         }
//         await flowDynamic('Thanks!')
//         return
//     }
// )

// const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola'])
//     .addAnswer(`🙌 Hello welcome to this *Chatbot*`)
//     .addAnswer(
//         [
//             'I share with you the following links of interest about the project',
//             '👉 *doc* to view the documentation',
//         ].join('\n'),
//         { delay: 800, capture: true },
//         async (ctx, { fallBack }) => {
//             if (!ctx.body.toLocaleLowerCase().includes('doc')) {
//                 return fallBack('You should type *doc*')
//             }
//             return
//         },
//         [discordFlow]
//     )

// const registerFlow = addKeyword<Provider, Database>(utils.setEvent('REGISTER_FLOW'))
//     .addAnswer(`What is your name?`, { capture: true }, async (ctx, { state }) => {
//         await state.update({ name: ctx.body })
//     })
//     .addAnswer('What is your age?', { capture: true }, async (ctx, { state }) => {
//         await state.update({ age: ctx.body })
//     })
//     .addAction(async (_, { flowDynamic, state }) => {
//         await flowDynamic(`${state.get('name')}, thanks for your information!: Your age: ${state.get('age')}`)
//     })

// const fullSamplesFlow = addKeyword<Provider, Database>(['samples', utils.setEvent('SAMPLES')])
//     .addAnswer(`💪 I'll send you a lot files...`)
//     .addAnswer(`Send image from Local`, { media: join(process.cwd(), 'assets', 'sample.png') })
//     .addAnswer(`Send video from URL`, {
//         media: 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJ0ZGdjd2syeXAwMjQ4aWdkcW04OWlqcXI3Ynh1ODkwZ25zZWZ1dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LCohAb657pSdHv0Q5h/giphy.mp4',
//     })
//     .addAnswer(`Send audio from URL`, { media: 'https://cdn.freesound.org/previews/728/728142_11861866-lq.mp3' })
//     .addAnswer(`Send file from URL`, {
//         media: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
//     })

const FlowAgente2 = addKeyword(['2', 'Agente', 'AGENTE'])
.addAnswer(["*Estamos desviando tu conversacion a nuestro Agente*"], null,
   async(ctx, {provider, endFlow}) => {
    const name = ctx?.pushName;
    const numAgente = ctx?.from;
    const message = `El cliente ${name} con el celular ${numAgente} solicita atencion personalizada`;

    const jid = ctx.key.remoteJid
    await provider.vendor.presenceSubscribe(jid)
    await provider.vendor.sendPresenceUpdate('composing', jid);
    await provider.vendor.readMessages([ctx.key])
    await provider.sendText('56936499908@s.whatsapp.net', message)
    return endFlow('*Gracias*');
   }
);

/**
* captura una variedad de eventos que no son permitidos por el bot para enviar un mensaje correspondiente al caso.
*/
 const flowValidMedia = addKeyword([EVENTS.MEDIA, EVENTS.VOICE_NOTE, EVENTS.LOCATION, EVENTS.DOCUMENT])
 .addAction(async(ctx,{gotoFlow, flowDynamic}) => {
    try {
            console.log('ctx dentro de flowValidMedia', ctx.message)
            if (
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'imageMessage') ||
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'audioMessage') ||
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'locationMessage') ||
                ctx.message && Object.prototype.hasOwnProperty.call(ctx.message, 'documentMessage')
            ) {
                // handle imageMessage case here if needed
                console.log('ctx INGRESO AL IF')
                await flowDynamic("❌  *Opcion no Valida*\n\n Por ahora solo es permitido enviar texto.")
                return gotoFlow(flowPrincipal); 
            } 
    } catch (error) {
        console.log('error Media', error)
    }
});

/**
* captura El evento que se genera cuando se recibe un pedido proveniente del carrito de compra.
*/
 const flowOrder = addKeyword([EVENTS.ORDER])
 .addAction(async(ctx,{gotoFlow, fallBack, provider, globalState}) => {
    try {
        console.log('ctx dentro de flowOrder', ctx)
        const jid = ctx.key.remoteJid
        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])
    console.log(ctx.nfm_reply)
         if (ctx?.message?.orderMessage) {
                 
            const orderId = ctx?.message?.orderMessage?.orderId;
            const ordertoken= ctx?.message?.orderMessage?.token;
            // console.log('orderId', orderId)
            const detailsP= await provider.verdor.getCart(orderId, ordertoken);
            console.log('detailsP', detailsP)
            const details= await provider.vendor.getOrderDetails(orderId, ordertoken);
            const resultProcess = await processOrder(details)

                if (resultProcess.length > 0) { 
                    // await globalState.update({ order: resultProcess })
                console.log(' Concretar Compra  Concretar Compra')
                return gotoFlow(flowEndShoppingCart);
            }
        } else {
            return fallBack("❌  *No se recibió información válida*\n\n Para Concretar la compra debe seleccionar los productos desde el carrito de compra.");
        }
    } catch (error) {
        console.log('error Media', error)
    }
});

const flowEndShoppingCart = addKeyword('direccion')
.addAnswer([
    'Su Pedido esta siendo procesado 🛒', 
    'Para seguir avanzado ingrese los siguientes datos:',
    
])
 .addAnswer(
    [
        'Direccion con la siguiente estructura:\n',
        '*Nombre Calle Numeracion, Comuna, Dto/Bloque/Lote Referencia*\n',
    ],
    { capture: true,  delay: 3000, idle: 960000 },
    async(ctx, {endFlow, provider, globalState}) => {
        const name = ctx.pushName;
        const phone = ctx.from;
        const jid = ctx.key.remoteJid

        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])
        

        if (ctx.body.length > 0) {
            await globalState.update({address: ctx.body})
            const dataOrder = globalState.get('order')
            const dataAddress = globalState.get('address')
            console.log('globalState dentro de flowEndShoppingCart', dataOrder)
            console.log('globalState dentro de flowEndShoppingCart', dataAddress)
            await notificationDelivery(dataOrder, dataAddress, name, phone, provider)
            return endFlow('Gracias por su Pedido, En breve nos comunicaremos con usted para coordinar la entrega.')
        } else {
            return endFlow('❌  *No se recibió información válida*\n\n Para Concretar la compra debe indicar su direccion con la estructura indicada');
        }
    }
 );

 // const flowPrincipal = addKeyword("welcome")
const flowPrincipal = addKeyword<Provider, Database>(utils.setEvent('welcome'))
 .addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
//  .addAnswer(`You have ${IDLETIME / 1000} seconds to respond\n*Multiplication:*\n6 * 6 ?`)
 .addAnswer([
    '🏜️ Hola, Bienvenido a *Minimarket TodoMarket* 🌵', 
    '⌛ Horario disponible desde las 2:00 PM hasta las 10:00 PM. ⌛',
    '📝 a través de este canal te ofrecemos los siguientes servicios de compra:'
    
])
 .addAnswer(
     [
        '*Indica el Número de la opción que desees:*', 
        '👉 #1 Carrito de compra whatsApp', 
        '👉 #2 Conversar con un Agente', 
        // '👉 #3 Link Carrito de compra Web'
    ].join('\n'),
    { capture: true,  delay: 4000, idle: 960000 },
    async (ctx,{ provider, fallBack, gotoFlow, state}) => {
        const jid = ctx.key.remoteJid
        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])

        if (ctx.body.toLocaleLowerCase().includes('1')) {
            stop(ctx)
            const numAgente = ctx.key?.remoteJid;
            console.log('getCart', numAgente)
        
            await sendCatalog(provider, numAgente,{
                title: "Catalogo",
                message: "Mira todos nuestros productos aqui 👇🏼",
            });

            return
        }
   
        if (![1, 2, 3].includes(parseInt(ctx.body.toLowerCase().trim()))) {
            reset(ctx, gotoFlow, IDLETIME)
            return fallBack("*Opcion no valida*, \nPor favor seleccione una opcion valida.");
        }
     },
    [FlowAgente2]
 );

 async function sendCatalog( provider: any, from: any, catalog: any) {
  const { title, body, message, image } = catalog || {};
//   let catalogPath = jid.split(":")[0];
// https://wa.me/c/56949079809
  return await provider.vendor.sendMessage(from, {
    text: message || "Mira todos nuestros productos aquí :point_down_tone2:",
    contextInfo: {
      externalAdReply: {
        title: title || "Catálogo",
        body: body || "Mira nuestros productos",
        mediaType: "VIDEO", // VIDEO - IMAGE - NONE
        // mediaUrl: `https://wa.me/c/${catalogPath}`,
        mediaUrl: `https://wa.me/c/56979643935`,
        thumbnailUrl: image || "https://github.com/Ameth1208/PortalQR/blob/main/resources/logo.png?raw=true",
        // sourceUrl: `https://wa.me/c/${catalogPath}`,
        sourceUrl: `https://wa.me/c/56979643943`,
      },
    },
  });
}

async function processOrder(details: any) {
    const containerProducts: any[] = [];
     containerProducts.push("*Productos Seleccionados*\n\n");
    const TotalAmount = details?.price?.total / 1000;
    const Products = details?.products || [];

    let counterGlobal = 1

    Products.forEach(element => {
        const valueG =`👉 #:${counterGlobal} Nombre: ${element.name} Cantidad:${element.quantity}  Precio:${(element.price / 1000)}\n`
        containerProducts.push(valueG)
        counterGlobal++;
    });
    containerProducts.push(`\nTotal a Pagar: ${TotalAmount}`)

    console.log('containerProducts dentro de  processOrder', containerProducts)
    return containerProducts;
}

async function notificationDelivery(order: any, address: any, name: any, phone: any, provider: any) {
    const  dataMessageGlobal: any[] = [];
    dataMessageGlobal.push(`* 🛒 Se registr nuevo pedido con Detalle: 🛒* \n`);
    dataMessageGlobal.push(`*Nombre Cliente:* ${name} \n *Telefono:* +${phone} \n`);
    dataMessageGlobal.push(`* Direccion:* ${address} \n`);
    dataMessageGlobal.push(order);

    await provider.sendText('56936499908@s.whatsapp.net', dataMessageGlobal.toString());
    
}

  /**
* Declarando flujo principal
*/
const flowDisable = addKeyword("disable")
.addAction(async (ctx, { gotoFlow }) => start(ctx, gotoFlow, IDLETIME))
.addAnswer([
   '🏜️ Hola, Bienvenido a *Minimarket TodoMarket* 🌵', 
   '⌛ Nuestra disponibilidad para atenderte esta desde las 12:00 PM hasta las 10:00 PM. ⌛'
])
.addAnswer(
    [
       '*Pero puedes ver nuestras redes sociales y recuerda que en el horario habilitado Empieza tu pedido escribiendo la palabra Hola*', 
       '👉 #1 Facebook', 
       '👉 #2 Instagram', 
       '👉 #3 TicTok'
    ],
    { capture: true,  delay: 2000, idle: 960000 },
    async (ctx,{ endFlow, fallBack, gotoFlow}) => {
        
        if (ctx.body === "1") {
             stop(ctx)
           return endFlow('En el siguiente Link tendras la opcion de ver Nuestra Pagina de Facebook\n 🔗 https://www.facebook.com/profile.php?id=61550250449208 \n*Gracias*');
        }
        
        if (ctx.body === "2") {
             stop(ctx)
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestra Pagina de Instagram\n 🔗 https://instagram.com/minimarketlosmedanos?igshid=YTQwZjQ0NmI0OA== \n*Gracias*');
        }
        if (ctx.body === "3") {
             stop(ctx)
            return endFlow('En el siguiente Link tendras la opcion de ver Nuestro TikTok\n 🔗 https://vm.tiktok.com/ZMjkbTYBg/ \n*Gracias*');
        } 

        if (![1, 2, 3].includes(parseInt(ctx.body.toLowerCase().trim()))) {
            reset(ctx, gotoFlow, IDLETIME)
            return fallBack("*Opcion no valida*, \nPor favor seleccione una opcion valida.");
        }
    }
)

const flowValidTime = addKeyword<Provider, Database>(EVENTS.WELCOME)
 .addAction(async(ctx,{gotoFlow, provider, state}) => {
     try {
        const refProvider = provider.getInstance();
        const jid = ctx.key.remoteJid
        await provider.vendor.presenceSubscribe(jid)
        await provider.vendor.sendPresenceUpdate('composing', jid);
        await provider.vendor.readMessages([ctx.key])

         await state.update({ name: ctx.body})

        const dataState = state.getMyState()
        const horaActual = moment();
        const horario = "09:00-24:00"
        const rangoHorario = horario.split("-");
        const horaInicio = moment(rangoHorario[0], "HH:mm");
        const horaFin = moment(rangoHorario[1], "HH:mm");
        //  console.log('Validando hora de Atencion',horaInicio)
        // if (horaActual.isBetween(horaInicio, horaFin)) {
            return gotoFlow(flowPrincipal); 
        // } else {
           
        //     return gotoFlow(flowPrincipal);
        // }

    } catch (error) {
        console.log('error flowValidTime', error)
    }
    
});



const main = async () => {
    // const adapterFlow = createFlow([welcomeFlow, registerFlow, fullSamplesFlow])
    const adapterFlow = createFlow([flowValidTime, flowPrincipal,  flowOrder, flowEndShoppingCart, flowValidMedia, idleFlow])
    
    // const adapterProvider = createProvider(Provider, {
    //     jwtToken: process.env.JWT_TOKEN!,
    //     numberId: process.env.NUMBER_ID!,
    //     verifyToken: process.env.VERIFY_TOKEN!,
    //     version: 'v18.0'
    // })

    const adapterProvider = createProvider(Provider, {
        jwtToken: 'EAAV7DZBhkJqsBP0w37DQODKs6dGwZAvILqWYC6l8gFZCfHyYXjCYbZBzZCcOTNUpB2pKvIUZB4HhjnZANake5CZCHuvMZCKJbzs4eWSbDCWWmJgbi5hHnSgZBJZAINfX2dLulzPQZBlZCoSmqrEyTFEekpWuM9gg3WSAePjTK6ZCMQ7xiBggxIfGoCJHgD4wpC6WQBWkncbSagZBrZABYcXRX5L4GMUspiDEAU2NpPMkrVJ8ICQKqKGRMUjd9juYKnFzZCQcxP3lgdJ7otjdpOFZCIr6giL3M1bMZADpgZDZD',
        numberId: '768634939670452',
        verifyToken: 'mi_bot_secreto_2025_xyz789',
        version: 'v22.0'
    })

    // const adapterDB = new Database({
    //     dbUri: process.env.MONGO_DB_URI!,
    //     dbName: process.env.MONGO_DB_NAME!,
    // })
     const adapterDB = new Database({
        dbUri: 'mongodb+srv://molledafreddy:magallanes2721.@cluster0.1e16p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
        dbName: 'db_bot',
    })

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    // Ruta GET para la raíz - necesaria para verificación del webhook
    adapterProvider.server.get('/', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        return res.end('Bot TodoMarket is running! 🤖')
    })

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body
            await bot.sendMessage(number, message, { media: urlMedia ?? null })
            return res.end('sended')
        })
    )

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('REGISTER_FLOW', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body
            await bot.dispatch('SAMPLES', { from: number, name })
            return res.end('trigger')
        })
    )

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body
            if (intent === 'remove') bot.blacklist.remove(number)
            if (intent === 'add') bot.blacklist.add(number)

            res.writeHead(200, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ status: 'ok', number, intent }))
        })
    )

    httpServer(+PORT)
}

main()
