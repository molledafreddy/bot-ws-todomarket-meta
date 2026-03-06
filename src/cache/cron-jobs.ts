import fs from 'fs/promises';
import path from 'path';
import moment from 'moment';
import cron from 'node-cron';
import { ENABLED_CATALOGS } from '../config/multi-catalog-config.js';

/**
 * 🔄 ACTUALIZAR UN CATÁLOGO ESPECÍFICO
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
      console.error(`   Variables disponibles:`, Object.keys(process.env).filter(k => k.includes('JWT') || k.includes('TOKEN')));
      return false;
    }

    console.log(`✅ JWT_TOKEN configurado: ${jwtToken.substring(0, 30)}...`);

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
        console.error(`   URL: ${productUrl}`);
        console.error(`   Response:`, JSON.stringify(data, null, 2));
        return false;
      }

      const pageProducts = (data as any).data || [];
      allProducts = allProducts.concat(pageProducts);
      pageCount++;

      console.log(`   ✅ Página ${pageCount}: ${pageProducts.length} productos (Total: ${allProducts.length})`);

      nextCursor = (data as any).paging?.cursors?.after || null;

      if (nextCursor) {
        console.log(`   ⏳ Pausa antes de siguiente página...`);
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
    const cacheDir = path.join(process.cwd(), 'src', 'cache', 'cache-data');

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