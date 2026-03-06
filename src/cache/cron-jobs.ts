import fs from 'fs/promises';
import path from 'path';
import moment from 'moment';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { ENABLED_CATALOGS } from '../config/multi-catalog-config.js';

/**
 * 🔧 OBTENER RUTA BASE DEL PROYECTO (funciona en dev y producción)
 */
function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Subir desde: src/cache/cron-jobs.ts → src/ → raíz
  const projectRoot = path.resolve(__dirname, '../../..');
  
  return projectRoot;
}

/**
 * 🔧 DETERMINAR RUTA DE CACHÉ (funciona en dev y producción)
 */
function getCachePath(): string {
  const projectRoot = getProjectRoot();
  const isProduction = process.env.NODE_ENV === 'production';

  let cacheDir: string;

  if (isProduction) {
    // ✅ Producción: usar /tmp o variable de entorno
    cacheDir = process.env.CACHE_DIR || path.join('/tmp', 'bot-cache');
  } else {
    // ✅ Desarrollo: crear en raíz del proyecto
    cacheDir = path.join(projectRoot, 'cache-data');
  }

  return cacheDir;
}

/**
 * 🔍 VERIFICAR SI EL CACHÉ ES VÁLIDO Y NO HA EXPIRADO
 */
async function isCacheValid(catalogKey: string): Promise<boolean> {
  try {
    const cacheDir = getCachePath();
    const cacheFilePath = path.join(cacheDir, `catalogo-${catalogKey}.json`);

    console.log(`\n🔍 Verificando caché existente: ${cacheFilePath}`);

    // 1️⃣ Verificar si el archivo existe
    try {
      await fs.stat(cacheFilePath);
    } catch {
      console.log(`   ❌ Archivo no existe`);
      return false;
    }

    // 2️⃣ Leer el archivo
    const fileContent = await fs.readFile(cacheFilePath, 'utf-8');
    const cacheData = JSON.parse(fileContent);

    console.log(`   ✅ Archivo encontrado`);
    console.log(`   • Última actualización: ${cacheData.lastUpdated}`);
    console.log(`   • Vence el: ${cacheData.expiresAt}`);

    // 3️⃣ Verificar si ha expirado
    const expirationTime = moment(cacheData.expiresAt);
    const now = moment();

    if (now.isAfter(expirationTime)) {
      console.log(`   ⏰ Caché EXPIRADO (hace ${now.diff(expirationTime, 'hours')} horas)`);
      return false;
    }

    const hoursRemaining = expirationTime.diff(now, 'hours');
    console.log(`   ✅ Caché VÁLIDO (expira en ${hoursRemaining} horas)`);
    console.log(`   📦 Productos en caché: ${cacheData.totalProducts}`);
    console.log(`   📂 Categorías: ${Object.keys(cacheData.categories).length}`);

    return true;

  } catch (error: any) {
    console.error(`   ❌ Error verificando caché:`, error.message);
    return false;
  }
}

/**
 * 📖 CARGAR DATOS DEL CACHÉ
 */
async function loadFromCache(catalogKey: string): Promise<any | null> {
  try {
    const cacheDir = getCachePath();
    const cacheFilePath = path.join(cacheDir, `catalogo-${catalogKey}.json`);

    console.log(`\n📖 Cargando datos del caché...`);

    const fileContent = await fs.readFile(cacheFilePath, 'utf-8');
    const cacheData = JSON.parse(fileContent);

    console.log(`   ✅ Datos cargados desde: ${cacheFilePath}`);
    console.log(`   📊 Tamaño: ${(Buffer.byteLength(fileContent) / 1024).toFixed(2)} KB`);

    return cacheData;

  } catch (error: any) {
    console.error(`   ❌ Error cargando caché:`, error.message);
    return null;
  }
}

/**
 * 🚀 INICIALIZAR SISTEMA DE CACHÉ (Con verificación de datos existentes)
 */
export async function initializeCacheSystem(): Promise<void> {
  try {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🚀 === INICIALIZANDO SISTEMA DE CACHÉ ===`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`⏰ Timestamp: ${new Date().toLocaleString('es-CL')}`);
    console.log(`📍 Modo: ${process.env.NODE_ENV || 'development'}`);

    // 1️⃣ Crear directorio de caché
    const cacheDir = getCachePath();
    await fs.mkdir(cacheDir, { recursive: true });
    console.log(`✅ Directorio de caché verificado: ${cacheDir}`);

    // 2️⃣ Verificar catálogos habilitados
    if (!ENABLED_CATALOGS) {
      throw new Error('ENABLED_CATALOGS no inicializado');
    }

    const enabledCatalogs = Object.entries(ENABLED_CATALOGS)
      .filter(([_, config]) => config.enabled)
      .map(([key, _]) => key);

    console.log(`\n📦 Catálogos a procesar: ${enabledCatalogs.length}`);

    // 3️⃣ Procesar cada catálogo
    let loaded = 0;
    let updated = 0;
    let failed = 0;

    for (const catalogKey of enabledCatalogs) {
      console.log(`\n▶️  Procesando catálogo: ${catalogKey}`);

      // ✅ Verificar si caché es válido
      const cacheIsValid = await isCacheValid(catalogKey);

      if (cacheIsValid) {
        // ✅ USAR CACHÉ EXISTENTE
        console.log(`   🎯 Usando datos del caché existente`);
        const cachedData = await loadFromCache(catalogKey);
        
        if (cachedData) {
          loaded++;
          console.log(`   ✅ Datos cargados exitosamente del caché`);
          continue; // Ir al siguiente catálogo
        }
      }

      // ❌ CACHÉ NO VÁLIDO - Descargar de Meta API
      console.log(`   🔄 Caché no disponible o expirado - Descargando de Meta API...`);
      const success = await updateCatalogCache(catalogKey);

      if (success) {
        updated++;
        console.log(`   ✅ Actualizado desde Meta API`);
      } else {
        failed++;
        console.log(`   ❌ Error actualizando desde Meta API`);
      }

      // Pausa entre descargas
      if (catalogKey !== enabledCatalogs[enabledCatalogs.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 4️⃣ Resumen final
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ SISTEMA DE CACHÉ INICIALIZADO EXITOSAMENTE`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`📊 Resumen de inicialización:`);
    console.log(`   • Cargados desde caché: ${loaded}`);
    console.log(`   • Actualizados desde API: ${updated}`);
    console.log(`   • Errores: ${failed}`);
    console.log(`   • Total procesados: ${loaded + updated + failed}`);
    console.log(`${'═'.repeat(70)}\n`);

  } catch (error: any) {
    console.error(`\n${'═'.repeat(70)}`);
    console.error(`❌ Error inicializando sistema de caché:`);
    console.error(`   Message: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.error(`${'═'.repeat(70)}\n`);
  }
}

/**
 * 🔄 ACTUALIZAR UN CATÁLOGO ESPECÍFICO (Desde Meta API)
 */
export async function updateCatalogCache(catalogKey: string): Promise<boolean> {
  try {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 ACTUALIZANDO CACHÉ: ${catalogKey}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`⏰ Timestamp: ${new Date().toLocaleString('es-CL')}`);

    // 1️⃣ VERIFICAR QUE EL CATÁLOGO EXISTE
    console.log(`\n1️⃣  Validando catálogo...`);
    if (!ENABLED_CATALOGS || !ENABLED_CATALOGS[catalogKey]) {
      console.error(`❌ Catálogo no encontrado: ${catalogKey}`);
      console.error(`   Catálogos disponibles:`, Object.keys(ENABLED_CATALOGS || {}));
      return false;
    }

    const catalog = ENABLED_CATALOGS[catalogKey];
    console.log(`✅ Catálogo encontrado: ${catalog.name}`);
    console.log(`   • ID: ${catalog.catalogId}`);
    console.log(`   • Habilitado: ${catalog.enabled}`);

    if (!catalog.enabled) {
      console.error(`❌ Catálogo deshabilitado`);
      return false;
    }

    // 2️⃣ OBTENER TOKEN JWT
    console.log(`\n2️⃣  Validando credenciales...`);
    const jwtToken = process.env.JWT_TOKEN;
    
    if (!jwtToken) {
      console.error(`❌ JWT_TOKEN no configurado en .env`);
      return false;
    }

    console.log(`✅ JWT_TOKEN configurado`);

    // 3️⃣ DESCARGAR PRODUCTOS DE META API
    console.log(`\n3️⃣  Descargando productos desde Meta API...`);
    let allProducts: any[] = [];
    let nextCursor: string | null = null;
    let pageCount = 0;

    do {
      const productUrl = `https://graph.facebook.com/v23.0/${catalog.catalogId}/products?fields=id,name,description,price,currency,retailer_id,category,availability,condition,brand&limit=100${nextCursor ? `&after=${nextCursor}` : ''}`;

      console.log(`   📄 Página ${pageCount + 1}: Consultando Meta API...`);

      const response = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        }
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`❌ Error Meta API (HTTP ${response.status}):`, (data as any).error?.message);
        return false;
      }

      const pageProducts = (data as any).data || [];
      allProducts = allProducts.concat(pageProducts);
      pageCount++;

      console.log(`   ✅ Página ${pageCount}: ${pageProducts.length} productos (Total: ${allProducts.length})`);

      nextCursor = (data as any).paging?.cursors?.after || null;

      if (nextCursor) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } while (nextCursor);

    console.log(`\n✅ Total de productos descargados: ${allProducts.length}`);

    if (allProducts.length === 0) {
      console.error(`❌ No se descargaron productos`);
      return false;
    }

    // 4️⃣ PROCESAR Y CATEGORIZAR PRODUCTOS
    console.log(`\n4️⃣  Categorizando productos...`);
    const categorizedProducts: Record<string, any[]> = {};

    allProducts.forEach((product: any) => {
      const category = product.category || 'Sin categoría';
      if (!categorizedProducts[category]) {
        categorizedProducts[category] = [];
      }
      categorizedProducts[category].push(product);
    });

    console.log(`✅ Productos categorizados:`);
    Object.entries(categorizedProducts).forEach(([cat, products]) => {
      console.log(`   • ${cat}: ${products.length} productos`);
    });

    // 5️⃣ PREPARAR DATOS DE CACHÉ
    console.log(`\n5️⃣  Preparando datos de caché...`);
    const cacheData = {
      catalogId: catalog.catalogId,
      catalogName: catalog.name,
      catalogKey,
      emoji: catalog.emoji,
      lastUpdated: new Date().toISOString(),
      expiresAt: moment().add(24, 'hours').toISOString(),
      totalProducts: allProducts.length,
      categories: categorizedProducts,
      metadata: {
        pagesQueried: pageCount,
        totalItemsProcessed: allProducts.length,
        generatedBy: 'cron-jobs.ts - updateCatalogCache()',
        version: '1.0'
      }
    };

    // 6️⃣ CREAR DIRECTORIO DE CACHÉ
    console.log(`\n6️⃣  Creando directorio de caché...`);
    const cacheDir = getCachePath();

    try {
      await fs.mkdir(cacheDir, { recursive: true });
      console.log(`✅ Directorio verificado: ${cacheDir}`);
    } catch (err) {
      console.error(`❌ Error creando directorio:`, err);
      return false;
    }

    // 7️⃣ GUARDAR ARCHIVO JSON
    console.log(`\n7️⃣  Guardando archivo JSON...`);
    const cacheFilePath = path.join(cacheDir, `catalogo-${catalogKey}.json`);

    try {
      await fs.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2), 'utf-8');
      console.log(`✅ Archivo guardado: ${cacheFilePath}`);
      console.log(`   📊 Tamaño: ${(Buffer.byteLength(JSON.stringify(cacheData)) / 1024).toFixed(2)} KB`);
    } catch (writeErr) {
      console.error(`❌ Error escribiendo archivo:`, writeErr);
      return false;
    }

    // 8️⃣ VERIFICAR QUE EL ARCHIVO SE CREÓ
    console.log(`\n8️⃣  Verificando archivo creado...`);
    try {
      const stats = await fs.stat(cacheFilePath);
      console.log(`✅ Archivo verificado:`);
      console.log(`   • Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   • Creado: ${stats.birthtime.toLocaleString('es-CL')}`);
      console.log(`   • Modificado: ${stats.mtime.toLocaleString('es-CL')}`);
    } catch (statErr) {
      console.error(`❌ Error verificando archivo:`, statErr);
      return false;
    }

    // ✅ ÉXITO
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`✅ CACHÉ ACTUALIZADO EXITOSAMENTE`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`📊 Resumen:`);
    console.log(`   • Catálogo: ${catalog.name}`);
    console.log(`   • Productos: ${allProducts.length}`);
    console.log(`   • Categorías: ${Object.keys(categorizedProducts).length}`);
    console.log(`   • Vencimiento: ${new Date(cacheData.expiresAt).toLocaleString('es-CL')}`);
    console.log(`   • Archivo: ${cacheFilePath}`);
    console.log(`${'═'.repeat(70)}\n`);

    return true;

  } catch (error: any) {
    console.error(`\n${'═'.repeat(70)}`);
    console.error(`❌ ERROR ACTUALIZANDO CATÁLOGO: ${catalogKey}`);
    console.error(`${'═'.repeat(70)}`);
    console.error(`Message: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error(`${'═'.repeat(70)}\n`);
    return false;
  }
}

/**
 * ✅ Actualizar TODOS los catálogos habilitados
 */
export async function updateAllCatalogs(): Promise<{updated: number, failed: number}> {
  try {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🔄 === ACTUALIZACIÓN MASIVA DE TODOS LOS CATÁLOGOS ===`);
    console.log(`${'═'.repeat(70)}`);

    if (!ENABLED_CATALOGS) {
      throw new Error('ENABLED_CATALOGS no inicializado');
    }

    let updated = 0;
    let failed = 0;

    const enabledCatalogs = Object.entries(ENABLED_CATALOGS)
      .filter(([_, config]) => config.enabled)
      .map(([key, _]) => key);

    console.log(`📦 Catálogos a actualizar: ${enabledCatalogs.length}`);
    enabledCatalogs.forEach((cat, idx) => {
      console.log(`   ${idx + 1}. ${cat}`);
    });

    for (const catalogKey of enabledCatalogs) {
      console.log(`\n▶️  Procesando: ${catalogKey}...`);
      
      const success = await updateCatalogCache(catalogKey);
      
      if (success) {
        updated++;
        console.log(`✅ Éxito: ${catalogKey}`);
      } else {
        failed++;
        console.log(`❌ Falló: ${catalogKey}`);
      }

      if (catalogKey !== enabledCatalogs[enabledCatalogs.length - 1]) {
        console.log(`⏳ Esperando antes del siguiente catálogo (2s)...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📊 === RESUMEN FINAL ===`);
    console.log(`✅ Actualizados exitosamente: ${updated}`);
    console.log(`❌ Fallos: ${failed}`);
    console.log(`📦 Total procesados: ${updated + failed}`);
    console.log(`📅 Completado: ${new Date().toLocaleString('es-CL')}`);
    console.log(`${'═'.repeat(70)}\n`);

    return { updated, failed };

  } catch (error: any) {
    console.error(`❌ Error en actualización masiva:`, error.message);
    return { updated: 0, failed: 0 };
  }
}

/**
 * 🔄 CONFIGURAR CRON JOB PARA ACTUALIZAR CACHÉ AUTOMÁTICAMENTE
 */
export function setupCronJobs(): void {
  try {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`⏰ CONFIGURANDO CRON JOBS`);
    console.log(`${'═'.repeat(70)}`);

    // Obtener configuración desde .env
    const cronTime = process.env.CATALOG_CRON_TIME || '0 2 * * *'; // Por defecto: 2 AM diarios

    console.log(`📅 Cron Schedule: ${cronTime}`);
    console.log(`   (Formato: segundo minuto hora día-del-mes mes día-de-la-semana)`);

    // Configurar cron job
    cron.schedule(cronTime, async () => {
      console.log(`\n${'═'.repeat(70)}`);
      console.log(`⏰ === EJECUTANDO CRON JOB AUTOMÁTICO ===`);
      console.log(`📅 Hora: ${new Date().toLocaleString('es-CL')}`);
      console.log(`${'═'.repeat(70)}`);

      await updateAllCatalogs();

      console.log(`✅ Cron job completado`);
    });

    console.log(`✅ Cron job configurado exitosamente`);
    console.log(`${'═'.repeat(70)}\n`);

  } catch (error: any) {
    console.error(`❌ Error configurando cron jobs:`, error.message);
  }
}