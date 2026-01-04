# 🚨 PROBLEMA IDENTIFICADO: TOKEN EXPIRADO

## 📋 **Diagnóstico Confirmado**

```
Error validating access token: Session has expired on Monday, 10-Nov-25 19:00:00 PST
```

**🎯 CAUSA RAÍZ:** El token de acceso (JWT_TOKEN) expiró el 10 de noviembre de 2025.

**💡 SOLUCIÓN:** Generar un nuevo token de acceso de WhatsApp Business API.

---

## 🔧 **PASOS PARA SOLUCIONAR**

### **PASO 1: Ir a Meta Business Manager**
1. Ve a: https://business.facebook.com/
2. Inicia sesión con tu cuenta
3. Selecciona tu negocio **"TodoMarket"**

### **PASO 2: Acceder a WhatsApp Business Platform**
1. En el menú izquierdo, busca **"WhatsApp"**
2. Clic en **"WhatsApp Business Platform"**
3. Selecciona **"Manage Phone Numbers"**

### **PASO 3: Generar Nuevo Token**
1. Busca tu número: **+56 9 7964 3935**
2. Clic en **"Generate Token"** o **"Regenerate Token"**
3. Selecciona permisos necesarios:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
   - ✅ `catalog_management` (importante para catálogos)
4. Copia el **nuevo token**

### **PASO 4: Actualizar Variables de Entorno**

**En Railway:**
1. Ve a tu proyecto en Railway
2. **Variables** → **Environment Variables**
3. Actualiza `JWT_TOKEN` con el nuevo token
4. **Deploy** automáticamente

**En Local (.env):**
```env
JWT_TOKEN=NUEVO_TOKEN_AQUI
NUMBER_ID=725315067342333
VERIFY_TOKEN=mi_bot_secreto_2025_xyz789
BUSINESS_ID=1349962220108819
```

### **PASO 5: Verificar Conexión del Catálogo**
1. En Meta Business Manager
2. **Commerce Manager** → **Catalogs**
3. Selecciona **"Catalogo_todomarket"**
4. **Settings** → **Sales Channels**
5. Asegúrate de que **WhatsApp** esté ✅ **Connected**

---

## 🛒 **VERIFICACIÓN DE CATÁLOGOS**

Tienes **2 catálogos** mencionados. Asegúrate de que ambos estén configurados:

### **Catálogo 1: "Catalogo_todomarket"**
- ID: 817382327367357 (desde logs anteriores)
- Productos: Papas Kryzpo, Queso Llanero

### **Catálogo 2: [Tu segundo catálogo]**
- Verifica que también esté conectado a WhatsApp
- Ambos deben estar en "Sales Channels" → WhatsApp

---

## ⚡ **SCRIPT DE VERIFICACIÓN RÁPIDA**

Una vez que tengas el **nuevo token**, ejecuta:

```bash
# Actualizar variables de entorno
export JWT_TOKEN="NUEVO_TOKEN_AQUI"

# Verificar que funciona
node fix-catalog-direct.js
```

**Resultado esperado:**
- ✅ Configuración actual mostrada
- ✅ Catálogos listados  
- ✅ Catálogo conectado automáticamente
- ✅ Mensaje de prueba enviado
- ✅ Catálogo visible en WhatsApp

---

## 🎯 **RESULTADO FINAL ESPERADO**

Una vez actualizado el token:

1. **Los catálogos funcionarán inmediatamente** 🛒
2. **Usuarios podrán seleccionar productos** ✅
3. **Se generarán pedidos automáticamente** 📦
4. **Error WebBridgeInput desaparecerá** ✅

---

## 📞 **Si Necesitas Ayuda**

**Si no puedes generar el token:**
- Verifica que tienes permisos de **Admin** en Meta Business
- Contacta al administrador principal del negocio
- Asegúrate de que el número esté verificado

**Si el catálogo sigue sin funcionar:**
- Desconecta y reconecta el catálogo en Commerce Manager
- Espera 10-15 minutos para sincronización
- Verifica que los productos estén "in stock"

---

## ✅ **CHECKLIST DE SOLUCIÓN**

- [ ] Generar nuevo token en Meta Business Manager
- [ ] Actualizar JWT_TOKEN en Railway/local
- [ ] Verificar conexión de catálogo(s) en Commerce Manager  
- [ ] Ejecutar script de verificación
- [ ] Probar envío de catálogo desde WhatsApp
- [ ] Confirmar que usuarios pueden hacer pedidos

**🎉 Una vez completado, tu catálogo estará 100% funcional!**
