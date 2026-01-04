# 🔧 GUÍA PASO A PASO: RECONECTAR CATÁLOGO A WHATSAPP BUSINESS

## 📋 INFORMACIÓN DE TU CONFIGURACIÓN:
- **Business ID:** 1349962220108819
- **Catálogo recomendado:** "Catálogo_productos" (216 productos)
- **WhatsApp Business:** Minimarket Todomarket (+56 9 7964 3935)

---

## 🚀 PASO 1: ACCEDER A META BUSINESS MANAGER

1. **Abrir navegador** → https://business.facebook.com
2. **Iniciar sesión** con tu cuenta de Facebook asociada al negocio
3. **Seleccionar el Business:** "TodoMarket" o el nombre de tu negocio

---

## 🛍️ PASO 2: ACCEDER A COMMERCE MANAGER

1. En el **menú lateral izquierdo**, buscar **"Commerce Manager"**
   - Si no lo ves, buscar **"Todas las herramientas"** → **"Commerce Manager"**
   
2. **Clic en "Commerce Manager"**

3. Deberías ver una pantalla con:
   - **Catálogos** (lado izquierdo)
   - **Pedidos**
   - **Configuración**

---

## 📦 PASO 3: SELECCIONAR EL CATÁLOGO CORRECTO

1. En **"Catálogos"** del lado izquierdo, verás:
   ```
   📋 Catálogo_todomarket (2 productos)
   📋 Catálogo_productos (216 productos) ← ESTE ES EL QUE NECESITAMOS
   📋 Catálogo_pro (0 productos)
   ```

2. **Clic en "Catálogo_productos"** (el que tiene 216 productos)

---

## 🔗 PASO 4: VERIFICAR/CONECTAR SALES CHANNELS

1. Una vez en el catálogo, buscar en el **menú superior**:
   - **Configuración** o **Settings**
   - **Sales Channels** o **Canales de venta**

2. **Clic en "Sales Channels"**

3. Deberías ver una lista de canales disponibles:
   ```
   📱 WhatsApp Business [ESTADO]
   🌐 Website
   📧 Instagram Shop
   💻 Facebook Shop
   ```

---

## 🎯 PASO 5: CONECTAR WHATSAPP BUSINESS

### Si WhatsApp aparece como "Desconectado" o "Not Connected":

1. **Clic en "WhatsApp Business"**
2. **Botón "Conectar"** o **"Connect"**
3. Aparecerá un modal/popup con:
   - Lista de WhatsApp Business Accounts disponibles
   - Seleccionar: **"Minimarket Todomarket"**

4. **Confirmar la conexión**
5. **Aceptar términos** si aparecen

### Si WhatsApp NO aparece en la lista:

1. **Clic en "+ Agregar canal"** o **"+ Add Sales Channel"**
2. **Seleccionar "WhatsApp Business"**
3. **Seguir los pasos de conexión**

---

## ✅ PASO 6: VERIFICAR LA CONEXIÓN

Una vez conectado, deberías ver:

```
📱 WhatsApp Business ✅ Conectado
   └─ Minimarket Todomarket
   └─ +56 9 7964 3935
   └─ 216 productos sincronizados
```

---

## 🧪 PASO 7: PROBAR LA CONEXIÓN

1. **Guardar cambios** si aparece algún botón
2. **Volver al código** y ejecutar:

```bash
cd /Users/freddymolleda/Desktop/proyectos/bot-builderbot-todomarket/base-ts-meta-mongo
npx tsx test-catalog-reconnection.ts
```

3. **Revisar WhatsApp** para confirmar que el catálogo funciona

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES:

### Problema 1: No veo "Commerce Manager"
**Solución:** 
- Buscar **"Todas las herramientas"**
- O ir directamente a: https://business.facebook.com/commerce/

### Problema 2: No veo WhatsApp Business en Sales Channels
**Solución:**
- Verificar que tu WhatsApp Business esté verificado
- Ir a **"WhatsApp Manager"** primero y verificar estado

### Problema 3: WhatsApp Business aparece pero no se puede conectar
**Solución:**
- Verificar que tengas permisos de administrador
- Contactar al administrador del Business Manager

### Problema 4: No veo el catálogo con 216 productos
**Solución:**
- Verificar que estás en el Business correcto
- Algunos catálogos pueden estar en "Archivados"

---

## 📱 VERIFICACIÓN VISUAL EN WHATSAPP:

Después de conectar, cuando envíes el catálogo:

**ANTES (problema):**
```
🛒 TodoMarket
[Ver catálogo] → Error al cargar productos
```

**DESPUÉS (funcionando):**
```
🛒 TodoMarket
[Ver catálogo] → ✅ Lista completa de 216 productos
                 ✅ Imágenes cargando
                 ✅ Precios visibles
                 ✅ Botón "Agregar al carrito"
```

---

## 🆘 SI NECESITAS AYUDA ADICIONAL:

1. **Toma screenshots** de cada paso donde tengas dudas
2. **Dime exactamente qué ves** en cada pantalla
3. **Copia cualquier mensaje de error** que aparezca

¡Estoy aquí para ayudarte con cada paso! 🚀
