/**
 * 🛒 SOLUCIÓN ALTERNATIVA: LISTA DE PRODUCTOS INTERACTIVA
 * 
 * Mientras se soluciona el problema de visibilidad del catálogo,
 * esta implementación muestra los productos como una lista interactiva.
 */

// Función para crear mensaje de lista de productos
function createProductList(from: string) {
    return {
        messaging_product: "whatsapp",
        to: from,
        type: "interactive", 
        interactive: {
            type: "list",
            header: {
                type: "text",
                text: "🛒 TodoMarket - Catálogo"
            },
            body: {
                text: "¡Bienvenido a nuestro minimarket! 🏪\n\nSelecciona una categoría para ver nuestros productos disponibles:"
            },
            footer: {
                text: "TodoMarket - Tu minimarket de confianza"
            },
            action: {
                button: "Ver Categorías",
                sections: [
                    {
                        title: "🥤 Bebidas y Refrescos",
                        rows: [
                            {
                                id: "categoria_bebidas",
                                title: "Bebidas",
                                description: "Gaseosas, jugos, agua, cerveza"
                            }
                        ]
                    },
                    {
                        title: "🍞 Panadería y Cereales", 
                        rows: [
                            {
                                id: "categoria_panaderia",
                                title: "Panadería",
                                description: "Pan, hallullas, cereales"
                            }
                        ]
                    },
                    {
                        title: "🥛 Lácteos y Huevos",
                        rows: [
                            {
                                id: "categoria_lacteos",
                                title: "Lácteos",
                                description: "Leche, yogurt, queso, mantequilla"
                            }
                        ]
                    },
                    {
                        title: "🌾 Abarrotes",
                        rows: [
                            {
                                id: "categoria_abarrotes", 
                                title: "Abarrotes",
                                description: "Arroz, fideos, aceite, azúcar"
                            }
                        ]
                    },
                    {
                        title: "🍎 Frutas y Verduras",
                        rows: [
                            {
                                id: "categoria_frutas",
                                title: "Frutas y Verduras",
                                description: "Productos frescos de temporada"
                            }
                        ]
                    },
                    {
                        title: "🧼 Limpieza y Aseo",
                        rows: [
                            {
                                id: "categoria_limpieza",
                                title: "Limpieza y Aseo",
                                description: "Detergente, papel higiénico, champú"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

// Función para mostrar productos de una categoría específica
function createCategoryProductList(from: string, category: string) {
    const categories = {
        categoria_bebidas: {
            title: "🥤 Bebidas y Refrescos",
            products: [
                { id: "coca_cola", name: "Coca Cola Lata 350ml", price: "1.900", description: "Bebida gaseosa cola" },
                { id: "pepsi", name: "Pepsi Lata 350ml", price: "1.800", description: "Bebida gaseosa cola" },
                { id: "sprite", name: "Sprite Lata 350ml", price: "1.800", description: "Bebida gaseosa lima-limón" },
                { id: "agua", name: "Agua Mineral Cachantun 1.5L", price: "1.200", description: "Agua mineral natural" },
                { id: "jugo", name: "Jugo Watts Durazno 1L", price: "2.500", description: "Néctar de durazno" }
            ]
        },
        categoria_panaderia: {
            title: "🍞 Panadería y Cereales",
            products: [
                { id: "pan_molde", name: "Pan de Molde Ideal 500g", price: "1.600", description: "Pan de molde blanco" },
                { id: "hallulla", name: "Hallulla Tradicional x6", price: "2.200", description: "Hallullas frescas" },
                { id: "cereal", name: "Cereal Corn Flakes 500g", price: "4.500", description: "Cereal de maíz crujiente" },
                { id: "avena", name: "Avena Quaker 500g", price: "3.200", description: "Avena tradicional" }
            ]
        },
        categoria_lacteos: {
            title: "🥛 Lácteos y Huevos",
            products: [
                { id: "leche", name: "Leche Entera Soprole 1L", price: "1.400", description: "Leche entera pasteurizada" },
                { id: "yogurt", name: "Yogurt Natural Soprole 150g", price: "800", description: "Yogurt natural sin azúcar" },
                { id: "queso", name: "Queso Gouda Colún 200g", price: "4.200", description: "Queso gouda maduro" },
                { id: "huevos", name: "Huevos Blancos Docena", price: "3.500", description: "Huevos frescos de gallina" }
            ]
        },
        categoria_abarrotes: {
            title: "🌾 Abarrotes",
            products: [
                { id: "arroz", name: "Arroz Grado 1 Tucapel 1kg", price: "2.800", description: "Arroz blanco grano largo" },
                { id: "fideos", name: "Fideos Espagueti Carozzi 500g", price: "1.900", description: "Pasta de sémola de trigo" },
                { id: "aceite", name: "Aceite Vegetal Chef 1L", price: "3.200", description: "Aceite vegetal mezcla" },
                { id: "azucar", name: "Azúcar Granulada Iansa 1kg", price: "2.200", description: "Azúcar blanca refinada" }
            ]
        },
        categoria_frutas: {
            title: "🍎 Frutas y Verduras",
            products: [
                { id: "platanos", name: "Plátanos de Seda x6", price: "2.500", description: "Plátanos maduros dulces" },
                { id: "manzanas", name: "Manzanas Rojas x4", price: "2.800", description: "Manzanas Royal Gala" },
                { id: "tomates", name: "Tomates Redondos 1kg", price: "2.200", description: "Tomates frescos de temporada" },
                { id: "papas", name: "Papas Blancas 2kg", price: "3.500", description: "Papas para preparación" }
            ]
        },
        categoria_limpieza: {
            title: "🧼 Limpieza y Aseo", 
            products: [
                { id: "detergente", name: "Detergente Líquido Popeye 1L", price: "3.800", description: "Detergente concentrado" },
                { id: "papel", name: "Papel Higiénico Noble x4", price: "4.200", description: "Papel higiénico doble hoja" },
                { id: "champu", name: "Champú Pantene 400ml", price: "4.500", description: "Champú reparación total" },
                { id: "pasta", name: "Pasta Dental Colgate 100ml", price: "2.800", description: "Pasta dental triple acción" }
            ]
        }
    };
    
    const categoryData = categories[category as keyof typeof categories];
    
    if (!categoryData) {
        return null;
    }
    
    return {
        messaging_product: "whatsapp",
        to: from,
        type: "interactive",
        interactive: {
            type: "list", 
            header: {
                type: "text",
                text: categoryData.title
            },
            body: {
                text: "Selecciona los productos que deseas agregar a tu carrito:\n\n💡 Podrás confirmar cantidades en el siguiente paso."
            },
            footer: {
                text: "TodoMarket - Delivery 2:00 PM - 10:00 PM"
            },
            action: {
                button: "Seleccionar Productos",
                sections: [
                    {
                        title: "Productos Disponibles",
                        rows: categoryData.products.map(product => ({
                            id: product.id,
                            title: product.name,
                            description: `$${product.price} - ${product.description}`
                        }))
                    },
                    {
                        title: "Navegación",
                        rows: [
                            {
                                id: "volver_categorias",
                                title: "← Volver a Categorías",
                                description: "Ver todas las categorías"
                            },
                            {
                                id: "finalizar_pedido",
                                title: "✅ Finalizar Pedido",
                                description: "Ir al carrito de compra"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

export { createProductList, createCategoryProductList };
