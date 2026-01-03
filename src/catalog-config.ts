// Configuración de catálogos múltiples
export interface CatalogConfig {
    id?: string; // ID del catálogo en Meta Business Manager
    title: string;
    message: string;
    fallbackUrl?: string; // URL específica para este catálogo
}

// Configuración de todos los catálogos disponibles
export const CATALOGS: Record<string, CatalogConfig> = {
    main: {
        // id: undefined, // Sin ID = catálogo por defecto del NUMBER_ID: 725315067342333
        title: "Catálogo Principal",
        message: "Mira nuestro catálogo principal con todos los productos 👇🏼",
        fallbackUrl: "https://wa.me/c/725315067342333" // ✅ URL CORREGIDA
    },
    
    offers: {
        id: "1057244946408276", // ✅ Catalog ID detectado anteriormente
        title: "Catálogo de Ofertas",
        message: "¡Mira nuestras ofertas especiales y promociones! 🎉\nProductos con descuentos únicos",
        fallbackUrl: "https://wa.me/c/725315067342333" // ✅ URL CORREGIDA
    },
    
    premium: {
        id: "catalog_id_premium_si_existe", // ← Cambiar por ID real si tienes catálogo premium
        title: "Catálogo Premium",
        message: "Descubre nuestros productos premium y exclusivos ⭐\nCalidad superior para clientes exigentes",
        fallbackUrl: "https://wa.me/c/725315067342333" // ✅ URL CORREGIDA
    },
    
    electronics: {
        id: "catalog_id_electronics_si_existe", // Ejemplo adicional
        title: "Catálogo Electrónicos",
        message: "Tecnología y electrónicos de última generación 📱💻",
        fallbackUrl: "https://wa.me/c/725315067342333" // ✅ URL CORREGIDA
    },
    
    clothing: {
        id: "catalog_id_clothing_si_existe", // Ejemplo adicional
        title: "Catálogo Ropa",
        message: "Moda y vestimenta para toda la familia 👕👗",
        fallbackUrl: "https://wa.me/c/725315067342333" // ✅ URL CORREGIDA
    }
};

// Función helper para obtener configuración de catálogo
export function getCatalogConfig(catalogType: string): CatalogConfig | null {
    return CATALOGS[catalogType] || null;
}

// Función helper para listar todos los catálogos disponibles
export function listAvailableCatalogs(): string[] {
    return Object.keys(CATALOGS);
}

// Función helper para validar si un catálogo tiene ID específico válido
export function catalogHasValidId(catalogType: string): boolean {
    const config = getCatalogConfig(catalogType);
    return !!(config && config.id && 
        config.id !== "catalog_id_premium_si_existe" && 
        config.id !== "catalog_id_electronics_si_existe" && 
        config.id !== "catalog_id_clothing_si_existe");
}
