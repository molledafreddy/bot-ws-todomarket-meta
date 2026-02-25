/**
 * 🔧 SCRIPT DE DIAGNÓSTICO COMPLETO PARA CATÁLOGOS DE META
 * Ejecutar: npx ts-node src/diagnostico-catalogo.ts
 * 
 * ✅ Verifica:
 * - Conexión a Meta API
 * - Obtención de productos
 * - Categorización correcta
 * - Creación de lotes
 * - Simulación de envío
 */

import 'dotenv/config';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

// ═════════════════════════════════════════════════════════════════
// 🎯 CONFIGURACIÓN
// ═════════════════════════════════════════════════════════════════

const CONFIG = {
  JWT_TOKEN: process.env.JWT_TOKEN || '',
  NUMBER_ID: process.env.NUMBER_ID || '',
  CATALOG_ID: '1057244946408276', // Tu catalog ID
  API_VERSION: 'v23.0',
  MAX_ITEMS_PER_MESSAGE: 30,
  MAX_SECTIONS_PER_MESSAGE: 10,
  MAX_ITEMS_PER_SECTION: 10,
};

// ═════════════════════════════════════════════════════════════════
// 📊 TIPOS Y INTERFACES
// ═════════════════════════════════════════════════════════════════

interface ProductFromMeta {
  id: string;
  retailer_id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  availability: string;
}

interface CategorizedProduct {
  name: string;
  category: string;
  items: ProductFromMeta[];
}

interface MessageLote {
  loteNumber: number;
  sections: any[];
  itemsCount: number;
  categoriesInLote: Set<string>;
}

interface DiagnosticReport {
  timestamp: string;
  status: 'success' | 'error';
  steps: {
    name: string;
    status: 'success' | 'error' | 'warning';
    details: string;
    data?: any;
  }[];
}

// ═════════════════════════════════════════════════════════════════
// 🛠️ UTILIDADES
// ═════════════════════════════════════════════════════════════════

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color: string, ...args: any[]) {
  console.log(`${color}${args.join(' ')}${COLORS.reset}`);
}

function logStep(title: string, status: 'start' | 'success' | 'error' | 'warning') {
  const icons = { start: '⏳', success: '✅', error: '❌', warning: '⚠️' };
  const colors = { start: COLORS.cyan, success: COLORS.green, error: COLORS.red, warning: COLORS.yellow };
  log(colors[status], `${icons[status]} ${title}`);
}

function logData(label: string, data: any) {
  log(COLORS.dim, `📋 ${label}:`);
  console.log(JSON.stringify(data, null, 2));
}

// ═════════════════════════════════════════════════════════════════
// 🔐 VALIDACIÓN INICIAL
// ═════════════════════════════════════════════════════════════════

function validateConfig(): boolean {
  logStep('VALIDANDO CONFIGURACIÓN', 'start');
  
  const errors: string[] = [];

  if (!CONFIG.JWT_TOKEN) errors.push('JWT_TOKEN no configurado');
  if (!CONFIG.NUMBER_ID) errors.push('NUMBER_ID no configurado');
  if (!CONFIG.CATALOG_ID) errors.push('CATALOG_ID no configurado');

  if (errors.length > 0) {
    logStep('VALIDACIÓN FALLIDA', 'error');
    errors.forEach(err => log(COLORS.red, `  ❌ ${err}`));
    return false;
  }

  logStep('VALIDACIÓN EXITOSA', 'success');
  log(COLORS.cyan, `  📋 JWT_TOKEN: ${CONFIG.JWT_TOKEN.substring(0, 20)}...`);
  log(COLORS.cyan, `  📋 NUMBER_ID: ${CONFIG.NUMBER_ID}`);
  log(COLORS.cyan, `  📋 CATALOG_ID: ${CONFIG.CATALOG_ID}`);
  
  return true;
}

// ═════════════════════════════════════════════════════════════════
// 📥 PASO 1: CONSULTAR PRODUCTOS DE META
// ═════════════════════════════════════════════════════════════════

async function fetchProductsFromMeta(): Promise<ProductFromMeta[]> {
  logStep('CONSULTANDO PRODUCTOS DE META API', 'start');

  try {
    const url = `https://graph.facebook.com/${CONFIG.API_VERSION}/${CONFIG.CATALOG_ID}/products`;
    const params = new URLSearchParams({
      fields: 'id,name,description,price,currency,retailer_id,availability',
      access_token: CONFIG.JWT_TOKEN,
      limit: '100'
    });

    const fullUrl = `${url}?${params.toString()}`;
    log(COLORS.cyan, `  🌐 URL: ${url}?[...params...]`);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data: any = await response.json();
    const products = data.data || [];

    logStep('PRODUCTOS OBTENIDOS', 'success');
    log(COLORS.green, `  📦 Total de productos: ${products.length}`);

    return products;

  } catch (error: any) {
    logStep('ERROR CONSULTANDO META API', 'error');
    log(COLORS.red, `  ${error.message}`);
    throw error;
  }
}

// ═════════════════════════════════════════════════════════════════
// 📂 PASO 2: CATEGORIZAR PRODUCTOS
// ═════════════════════════════════════════════════════════════════

function categorizeProducts(products: ProductFromMeta[]): Record<string, ProductFromMeta[]> {
  logStep('CATEGORIZANDO PRODUCTOS', 'start');

  const categoryKeywords: Record<string, string[]> = {
    '🥤 Bebidas': [
      'bebida', 'refresco', 'gaseosa', 'agua', 'jugo', 'soda',
      'cerveza', 'vino', 'pisco', 'café', 'espresso', 'capuchino',
      'té', 'energética', 'monster', 'red bull', 'coca', 'pepsi',
      'sprite', 'fanta', 'nestea', 'watts', 'néctar', 'lipton', 'postobon'
    ],
    '🍿 Snacks': [
      'snack', 'papas fritas', 'chocolate', 'galleta', 'takis', 'kryzpo', 'chips', 'chocolate', 'dulce', 'caramelo',
      'golosina', 'chicle', 'maní', 'cacahuate', 'nueces', 'almendras',
      'galleta dulce', 'frutos secos', 'turrón', 'malva', 'alfajor', 'galletita'
    ],
    
    '🍞 Panadería': [
      'pan', 'cereal', 'avena', 'hallulla', 'bimbo', 'molde',
      'pan integral', 'pan blanco', 'pan francés', 'panadería', 'biscocho',
      'bizcocho', 'tostadas', 'catalinas'
    ],

    '🥛 Lácteos': [
      'leche', 'yogurt', 'queso', 'huevo', 'mantequilla', 'crema', 'lácteo',
      'soprole', 'colún', 'dairy', 'yogur', 'requesón', 'quesillo',
      'leche descremada', 'leche entera', 'manteca'
    ],

    '🌾 Abarrotes': [
      'arroz', 'fideos', 'pasta', 'zucaritas', 'aceite', 'azúcar', 'sal', 'harina',
      'lentejas', 'porotos', 'atún', 'enlatados', 'conserva', 'vinagre',
      'mayonesa', 'condimento', 'abarrote', 'legumbres', 'garbanzos',
      'espagueti', 'espirales', 'azucar'
    ],

    '🍎 Frutas y Verduras': [
      'fruta', 'verdura', 'manzana', 'plátano', 'banana', 'naranja',
      'limón', 'fresa', 'piña', 'durazno', 'uva', 'pera', 'kiwi',
      'tomate', 'cebolla', 'ajo', 'zanahoria', 'lechuga', 'brócoli',
      'espinaca', 'acelga', 'repollo', 'papa a granel', 'patata'
    ],

    '🥩 Carnes y Cecinas': [
      'carne', 'pollo', 'pechuga', 'acaramelado', 'vianesa', 'muslo', 'ala', 'jamón', 'tocino',
      'panceta', 'paté', 'embutido', 'chorizo', 'salchicha', 'mortadela',
      'longaniza', 'ternera', 'cerdo', 'carne molida', 'filete',
      'costilla', 'pescado', 'salmón', 'trucha', 'merluza'
    ],

    '🧼 Limpieza': [
      'detergente', 'jabón', 'nova', 'champú', 'pasta dental', 'papel higiénico',
      'aseo', 'higiene', 'cloro', 'limpieza', 'desinfectante', 'limpiador',
      'escoba', 'recogedor', 'trapo', 'paño', 'esponja', 'cepillo',
      'toallita', 'toalla', 'pañal', 'servilleta', 'kleenex', 'pañuelos',
      'poet'
    ],

    '❄️ Congelados': [
      'congelado', 'helado', 'frozen', 'pizza', 'papas pre fritas',
      'papas congeladas', 'comida congelada', 'alimento congelado',
      'nuggets', 'empanadas'
    ]
  };

  const categorized: Record<string, ProductFromMeta[]> = {};
  const processedIds = new Set<string>();

  // Inicializar categorías
  Object.keys(categoryKeywords).forEach(cat => {
    categorized[cat] = [];
  });
  categorized['📦 Otros'] = [];

  // Procesar productos
  products.forEach((product, index) => {
    const productId = product.retailer_id || product.id;

    if (processedIds.has(productId)) {
      log(COLORS.yellow, `  ⏭️  Producto #${index + 1} duplicado (${productId})`);
      return;
    }

    processedIds.add(productId);

    const productName = (product.name || '').toLowerCase();
    const productDesc = (product.description || '').toLowerCase();
    const fullText = `${productName} ${productDesc}`;

    let assigned = false;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      const foundKeywords = keywords.filter(kw => fullText.includes(kw.toLowerCase()));

      if (foundKeywords.length > 0) {
        categorized[category].push(product);
        assigned = true;
        log(COLORS.cyan, `  📦 #${index + 1} "${product.name}" → ${category}`);
        break;
      }
    }

    if (!assigned) {
      categorized['📦 Otros'].push(product);
      log(COLORS.yellow, `  📦 #${index + 1} "${product.name}" → 📦 Otros`);
    }
  });

  logStep('CATEGORIZACIÓN COMPLETADA', 'success');
  
  console.log('\n📊 Resumen de categorización:');
  Object.entries(categorized).forEach(([cat, items]) => {
    if (items.length > 0) {
      log(COLORS.cyan, `   ${cat}: ${items.length} productos`);
    }
  });

  return categorized;
}

// ═════════════════════════════════════════════════════════════════
// 📦 PASO 3: CREAR LOTES
// ═════════════════════════════════════════════════════════════════

function createMessageLotes(categorized: Record<string, ProductFromMeta[]>): MessageLote[] {
  logStep('CREANDO LOTES DE MENSAJES', 'start');

  const categoryArray = Object.entries(categorized)
    .filter(([_, items]) => items.length > 0)
    .map(([name, items]) => ({
      name,
      items,
      itemCount: items.length
    }));

  // Ordenar (mayor cantidad primero, "Otros" al final)
  categoryArray.sort((a, b) => {
    const aIsOtros = a.name.includes('📦');
    const bIsOtros = b.name.includes('📦');
    
    if (aIsOtros && !bIsOtros) return 1;
    if (!aIsOtros && bIsOtros) return -1;
    return b.itemCount - a.itemCount;
  });

  const messageLotes: MessageLote[] = [];
  let currentLote: MessageLote = {
    loteNumber: 1,
    sections: [],
    itemsCount: 0,
    categoriesInLote: new Set<string>()
  };

  log(COLORS.cyan, `  📂 Categorías a procesar: ${categoryArray.length}`);

  categoryArray.forEach((category, catIndex) => {
    log(COLORS.cyan, `\n  📦 Procesando categoría ${catIndex + 1}/${categoryArray.length}: "${category.name}" (${category.itemCount} items)`);

    // Validar si ya está en el lote
    if (currentLote.categoriesInLote.has(category.name)) {
      log(COLORS.yellow, `    ⚠️  Categoría ya existe en Lote ${currentLote.loteNumber}, saltando`);
      return;
    }

    // Validar espacio
    const spaceAvailable = CONFIG.MAX_ITEMS_PER_MESSAGE - currentLote.itemsCount;

    if (category.itemCount > spaceAvailable && currentLote.sections.length > 0) {
      messageLotes.push(currentLote);
      log(COLORS.cyan, `    💾 Lote ${currentLote.loteNumber} guardado (${currentLote.itemsCount} items)`);

      currentLote = {
        loteNumber: messageLotes.length + 1,
        sections: [],
        itemsCount: 0,
        categoriesInLote: new Set<string>()
      };
    }

    // Procesar items de la categoría
    let itemsProcessed = 0;

    while (itemsProcessed < category.itemCount) {
      const spaceInLote = CONFIG.MAX_ITEMS_PER_MESSAGE - currentLote.itemsCount;
      const itemsToTake = Math.min(
        CONFIG.MAX_ITEMS_PER_SECTION,
        category.itemCount - itemsProcessed,
        spaceInLote
      );

      if (itemsToTake <= 0) {
        messageLotes.push(currentLote);
        log(COLORS.cyan, `    💾 Lote ${currentLote.loteNumber} guardado (${currentLote.itemsCount} items)`);

        currentLote = {
          loteNumber: messageLotes.length + 1,
          sections: [],
          itemsCount: 0,
          categoriesInLote: new Set<string>()
        };
        continue;
      }

      const section = {
        title: category.name.substring(0, 30),
        product_items: category.items
          .slice(itemsProcessed, itemsProcessed + itemsToTake)
          .map(item => ({
            product_retailer_id: item.retailer_id || item.id
          }))
      };

      currentLote.sections.push(section);
      currentLote.itemsCount += itemsToTake;
      currentLote.categoriesInLote.add(category.name);

      log(COLORS.cyan, `    ✅ Sección agregada: ${itemsToTake} items → Lote ${currentLote.loteNumber}`);

      itemsProcessed += itemsToTake;
    }
  });

  if (currentLote.sections.length > 0) {
    messageLotes.push(currentLote);
    log(COLORS.cyan, `  💾 Lote ${currentLote.loteNumber} guardado (${currentLote.itemsCount} items)`);
  }

  logStep('LOTES CREADOS', 'success');
  log(COLORS.green, `  📤 Total de lotes: ${messageLotes.length}`);

  return messageLotes;
}

// ═════════════════════════════════════════════════════════════════
// 📊 PASO 4: GENERAR REPORTE
// ═════════════════════════════════════════════════════════════════

async function generateReport(
  products: ProductFromMeta[],
  categorized: Record<string, ProductFromMeta[]>,
  lotes: MessageLote[]
): Promise<DiagnosticReport> {
  logStep('GENERANDO REPORTE', 'start');

  const report: DiagnosticReport = {
    timestamp: new Date().toISOString(),
    status: 'success',
    steps: [
      {
        name: '1️⃣ Validación de Configuración',
        status: 'success',
        details: 'Todas las variables de entorno están configuradas',
        data: {
          JWT_TOKEN: `${CONFIG.JWT_TOKEN.substring(0, 20)}...`,
          NUMBER_ID: CONFIG.NUMBER_ID,
          CATALOG_ID: CONFIG.CATALOG_ID,
          API_VERSION: CONFIG.API_VERSION
        }
      },
      {
        name: '2️⃣ Consulta a Meta API',
        status: 'success',
        details: `Se obtuvieron ${products.length} productos del catálogo`,
        data: {
          totalProducts: products.length,
          sampleProducts: products.slice(0, 3).map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            currency: p.currency
          }))
        }
      },
      {
        name: '3️⃣ Categorización de Productos',
        status: 'success',
        details: `Se categorizaron ${products.length} productos en ${Object.keys(categorized).length} categorías`,
        data: Object.entries(categorized)
          .filter(([_, items]) => items.length > 0)
          .map(([category, items]) => ({
            category,
            count: items.length,
            samples: items.slice(0, 2).map(p => p.name)
          }))
      },
      {
        name: '4️⃣ Creación de Lotes',
        status: 'success',
        details: `Se crearon ${lotes.length} lotes para envío (máx ${CONFIG.MAX_ITEMS_PER_MESSAGE} items/lote)`,
        data: lotes.map((lote, idx) => ({
          loteNumber: idx + 1,
          itemsCount: lote.itemsCount,
          sectionsCount: lote.sections.length,
          categories: Array.from(lote.categoriesInLote)
        }))
      }
    ]
  };

  // Guardar reporte en archivo
  const reportPath = path.join(process.cwd(), 'diagnostico-catalogo.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  logStep('REPORTE GENERADO', 'success');
  log(COLORS.green, `  💾 Archivo: ${reportPath}`);

  return report;
}

// ═════════════════════════════════════════════════════════════════
// 🎯 FUNCIÓN PRINCIPAL
// ═════════════════════════════════════════════════════════════════

async function main() {
  console.log('\n');
  log(COLORS.bright + COLORS.blue, '═════════════════════════════════════════════════════════════════');
  log(COLORS.bright + COLORS.blue, '🔧 DIAGNÓSTICO COMPLETO DE CATÁLOGOS DE META - TodoMarket');
  log(COLORS.bright + COLORS.blue, '═════════════════════════════════════════════════════════════════');
  console.log('\n');

  try {
    // ✅ PASO 0: Validar configuración
    if (!validateConfig()) {
      process.exit(1);
    }

    console.log('\n');

    // ✅ PASO 1: Consultar productos
    const products = await fetchProductsFromMeta();

    console.log('\n');

    // ✅ PASO 2: Categorizar
    const categorized = categorizeProducts(products);

    console.log('\n');

    // ✅ PASO 3: Crear lotes
    const lotes = createMessageLotes(categorized);

    console.log('\n');

    // ✅ PASO 4: Generar reporte
    const report = await generateReport(products, categorized, lotes);

    // ═════════════════════════════════════════════════════════════════
    // 📋 RESUMEN FINAL
    // ═════════════════════════════════════════════════════════════════

    console.log('\n');
    log(COLORS.bright + COLORS.green, '═════════════════════════════════════════════════════════════════');
    log(COLORS.bright + COLORS.green, '✅ DIAGNÓSTICO COMPLETADO EXITOSAMENTE');
    log(COLORS.bright + COLORS.green, '═════════════════════════════════════════════════════════════════');
    console.log('\n');

    log(COLORS.cyan, '📊 RESULTADOS FINALES:');
    log(COLORS.cyan, `  • Productos totales: ${products.length}`);
    log(COLORS.cyan, `  • Categorías con productos: ${Object.values(categorized).filter(c => c.length > 0).length}`);
    log(COLORS.cyan, `  • Lotes de envío: ${lotes.length}`);
    log(COLORS.cyan, `  • Items totales en lotes: ${lotes.reduce((sum, l) => sum + l.itemsCount, 0)}`);

    console.log('\n');
    log(COLORS.green, '✨ Próximos pasos:');
    log(COLORS.green, '  1. Revisar diagnostico-catalogo.json');
    log(COLORS.green, '  2. Validar que cada producto está en la categoría correcta');
    log(COLORS.green, '  3. Ajustar keywords si es necesario');
    log(COLORS.green, '  4. Ejecutar el bot con: npm run start');

    console.log('\n');

  } catch (error: any) {
    log(COLORS.red, '\n❌ ERROR EN DIAGNÓSTICO:');
    log(COLORS.red, error.message);
    console.error(error);
    process.exit(1);
  }
}

// ═════════════════════════════════════════════════════════════════
// 🚀 EJECUTAR
// ═════════════════════════════════════════════════════════════════

main();