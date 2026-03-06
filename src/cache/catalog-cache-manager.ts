/**
 * 📦 CATALOG CACHE MANAGER
 * Gestiona la caché de catálogos en JSON
 * ✅ Lee/escribe archivos JSON
 * ✅ Valida expiración de caché
 * ✅ Actualiza desde Meta API cuando es necesario
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment';

// Obtener __dirname en módulos ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, 'cache-data');
const CACHE_DURATION_HOURS = 24;

interface CatalogCache {
  catalogId: string;
  catalogName: string;
  catalogKey: string;
  emoji: string;
  lastUpdated: string;
  expiresAt: string;
  totalProducts: number;
  categories: Record<string, any[]>;
  metadata: {
    pagesQueried: number;
    totalItemsProcessed: number;
    generatedBy: string;
    version: string;
  };
}

interface CacheStatus {
  exists: boolean;
  isValid: boolean;
  isExpired: boolean;
  expiresIn: string;
  lastUpdated: string;
}

/**
 * ✅ FUNCIÓN 1: Obtener ruta del archivo de caché
 */
function getCacheFilePath(catalogKey: string): string {
  const filename = `catalogo-${catalogKey}.json`;
  return path.join(CACHE_DIR, filename);
}

/**
 * ✅ FUNCIÓN 2: Crear directorio de caché si no existe
 */
async function ensureCacheDirectoryExists(): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log(`✅ Directorio de caché verificado: ${CACHE_DIR}`);
  } catch (error) {
    console.error(`❌ Error creando directorio de caché:`, error);
    throw error;
  }
}

/**
 * ✅ FUNCIÓN 3: Guardar caché en JSON
 */
async function saveCatalogToCache(
  catalogKey: string,
  catalogData: CatalogCache
): Promise<boolean> {
  try {
    await ensureCacheDirectoryExists();

    const filePath = getCacheFilePath(catalogKey);

    // Añadir timestamps
    catalogData.lastUpdated = new Date().toISOString();
    catalogData.expiresAt = moment()
      .add(CACHE_DURATION_HOURS, 'hours')
      .toISOString();

    // Escribir archivo con indentación
    await fs.writeFile(
      filePath,
      JSON.stringify(catalogData, null, 2),
      'utf-8'
    );

    console.log(`✅ Caché guardado: ${filePath}`);
    console.log(`   📦 Productos: ${catalogData.totalProducts}`);
    console.log(`   📂 Categorías: ${Object.keys(catalogData.categories).length}`);
    console.log(`   ⏰ Expira: ${catalogData.expiresAt}`);

    return true;
  } catch (error) {
    console.error(`❌ Error guardando caché:`, error);
    return false;
  }
}

/**
 * ✅ FUNCIÓN 4: Leer caché desde JSON
 */
async function readCatalogFromCache(
  catalogKey: string
): Promise<CatalogCache | null> {
  try {
    const filePath = getCacheFilePath(catalogKey);

    // Verificar si el archivo existe
    try {
      await fs.access(filePath);
    } catch {
      console.log(`⚠️  Archivo de caché no existe: ${filePath}`);
      return null;
    }

    // Leer archivo
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const catalogData: CatalogCache = JSON.parse(fileContent);

    console.log(`✅ Caché leído: ${filePath}`);
    console.log(`   📦 Productos: ${catalogData.totalProducts}`);
    console.log(`   ⏰ Actualizado: ${catalogData.lastUpdated}`);

    return catalogData;
  } catch (error) {
    console.error(`❌ Error leyendo caché:`, error);
    return null;
  }
}

/**
 * ✅ FUNCIÓN 5: Validar si caché es válido y no ha expirado
 */
async function validateCacheStatus(catalogKey: string): Promise<CacheStatus> {
  try {
    const filePath = getCacheFilePath(catalogKey);

    // Verificar existencia del archivo
    let exists = true;
    try {
      await fs.access(filePath);
    } catch {
      exists = false;
    }

    if (!exists) {
      return {
        exists: false,
        isValid: false,
        isExpired: true,
        expiresIn: 'N/A',
        lastUpdated: 'N/A'
      };
    }

    // Leer datos de caché
    const catalogData = await readCatalogFromCache(catalogKey);

    if (!catalogData) {
      return {
        exists: true,
        isValid: false,
        isExpired: true,
        expiresIn: 'Error leyendo archivo',
        lastUpdated: 'Error leyendo archivo'
      };
    }

    // Validar expiración
    const expiresAt = moment(catalogData.expiresAt);
    const now = moment();
    const isExpired = now.isAfter(expiresAt);
    const expiresIn = expiresAt.fromNow();

    return {
      exists: true,
      isValid: !isExpired,
      isExpired,
      expiresIn,
      lastUpdated: catalogData.lastUpdated
    };
  } catch (error) {
    console.error(`❌ Error validando caché:`, error);
    return {
      exists: false,
      isValid: false,
      isExpired: true,
      expiresIn: 'Error',
      lastUpdated: 'Error'
    };
  }
}

/**
 * ✅ FUNCIÓN 6: Obtener caché si es válido
 */
async function getCatalogIfValid(
  catalogKey: string
): Promise<CatalogCache | null> {
  console.log(`\n🔍 === VERIFICANDO CACHÉ: ${catalogKey} ===`);

  const status = await validateCacheStatus(catalogKey);

  console.log(`📊 Estado:`);
  console.log(`   ✅ Existe: ${status.exists}`);
  console.log(`   ✅ Válido: ${status.isValid}`);
  console.log(`   ✅ Expirado: ${status.isExpired}`);
  console.log(`   ⏰ Expira en: ${status.expiresIn}`);

  if (!status.isValid) {
    console.log(`⚠️  Caché inválido/expirado\n`);
    return null;
  }

  console.log(`✅ Usando caché\n`);
  return await readCatalogFromCache(catalogKey);
}

/**
 * ✅ FUNCIÓN 7: Limpiar cachés expirados
 */
async function cleanExpiredCaches(): Promise<{ cleaned: number; remaining: number }> {
  try {
    await ensureCacheDirectoryExists();

    const files = await fs.readdir(CACHE_DIR);
    let cleaned = 0;
    let remaining = 0;

    console.log(`\n🧹 === LIMPIANDO CACHÉS EXPIRADOS ===`);

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const catalogKey = file.replace('catalogo-', '').replace('.json', '');
      const status = await validateCacheStatus(catalogKey);

      if (status.isExpired) {
        const filePath = path.join(CACHE_DIR, file);
        await fs.unlink(filePath);
        console.log(`🗑️  Eliminado: ${file}`);
        cleaned++;
      } else {
        remaining++;
      }
    }

    console.log(`\n✅ Limpieza: ${cleaned} eliminados, ${remaining} restantes\n`);
    return { cleaned, remaining };
  } catch (error) {
    console.error(`❌ Error limpiando:`, error);
    return { cleaned: 0, remaining: 0 };
  }
}

/**
 * ✅ FUNCIÓN 8: Listar cachés disponibles
 */
async function listAvailableCaches(): Promise<Array<{ catalogKey: string; status: CacheStatus }>> {
  try {
    await ensureCacheDirectoryExists();

    const files = await fs.readdir(CACHE_DIR);
    const caches = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const catalogKey = file.replace('catalogo-', '').replace('.json', '');
      const status = await validateCacheStatus(catalogKey);

      caches.push({ catalogKey, status });
    }

    return caches;
  } catch (error) {
    console.error(`❌ Error listando:`, error);
    return [];
  }
}

export {
  CatalogCache,
  CacheStatus,
  saveCatalogToCache,
  readCatalogFromCache,
  validateCacheStatus,
  getCatalogIfValid,
  cleanExpiredCaches,
  listAvailableCaches,
  ensureCacheDirectoryExists,
  CACHE_DURATION_HOURS
};