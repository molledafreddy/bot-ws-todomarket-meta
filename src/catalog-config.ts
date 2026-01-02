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
        // id: undefined, // Sin ID = catálogo por defecto del NUMBER_ID
        title: "Catálogo Principal",
        message: "Mira nuestro catálogo principal con todos los productos 👇🏼",
        fallbackUrl: "https://wa.me/c/56979643935" // URL por defecto
    },
    
    offers: {
        id: "tu_catalog_id_ofertas_aqui", // ← Reemplazar con ID real del catálogo de ofertas
        title: "Catálogo de Ofertas",
        message: "¡Mira nuestras ofertas especiales y promociones! 🎉\nProductos con descuentos únicos",
        fallbackUrl: "https://wa.me/c/56979643935" // ← Cambiar si tienes URL específica para ofertas
    },
    
    premium: {
        id: "tu_catalog_id_premium_aqui", // ← Reemplazar con ID real del catálogo premium
        title: "Catálogo Premium",
        message: "Descubre nuestros productos premium y exclusivos ⭐\nCalidad superior para clientes exigentes",
        fallbackUrl: "https://wa.me/c/56979643935" // ← Cambiar si tienes URL específica para premium
    },
    
    electronics: {
        id: "tu_catalog_id_electronics_aqui", // Ejemplo adicional
        title: "Catálogo Electrónicos",
        message: "Tecnología y electrónicos de última generación 📱💻",
        fallbackUrl: "https://wa.me/c/56979643935"
    },
    
    clothing: {
        id: "tu_catalog_id_clothing_aqui", // Ejemplo adicional
        title: "Catálogo Ropa",
        message: "Moda y vestimenta para toda la familia 👕👗",
        fallbackUrl: "https://wa.me/c/56979643935"
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
