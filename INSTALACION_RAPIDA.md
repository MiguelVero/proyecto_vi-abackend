# 📦 GUÍA RÁPIDA DE INSTALACIÓN - SUNAT

## ⚡ 5 PASOS PARA EMPEZAR

### PASO 1: Instalar dependencias

```bash
npm install
```

**Dependencias nuevas añadidas:**
- `xml-js` - Convertir JavaScript a XML
- `node-rsa` - Manejo de certificados RSA
- `axios` - Cliente HTTP SOAP
- `crypto` - Firma digital (nativa de Node.js)
- `xmldom` - Parser XML

---

### PASO 2: Configurar variables de entorno

Abre tu archivo `.env` y añade:

```env
# SUNAT Configuration
SUNAT_AMBIENTE=pruebas
SUNAT_CERT_PATH=./certs/cert.pfx
SUNAT_CERT_PASSWORD=tu_password_del_certificado
SUNAT_RUC=20123456789
SUNAT_EMPRESA=Tu Empresa SAC
SUNAT_DIRECCION=Lima, Perú
SUNAT_SERIE_BOLETA=0001
SUNAT_SERIE_FACTURA=0001
SUNAT_USUARIO_SOL=tu_usuario_sol
SUNAT_USUARIO_SUNAT=tu_usuario_sunat
SUNAT_PASSWORD_SUNAT=tu_password_sunat
```

> 💡 **Tip:** Usa el archivo `.env.sunat` como referencia

---

### PASO 3: Ejecutar script SQL

En tu gestor de MySQL (Workbench, phpMyAdmin, o línea de comandos):

```bash
# Línea de comandos
mysql -u root -p sistema_agua < sunat_setup.sql
```

**O manualmente en MySQL:**

```sql
-- Copiar y ejecutar el contenido de sunat_setup.sql
-- Creará tablas: comprobante_sunat, sunat_configuracion
```

Verifica que las tablas existan:

```sql
DESCRIBE comprobante_sunat;
DESCRIBE sunat_configuracion;
SELECT * FROM sunat_configuracion;
```

---

### PASO 4: Preparar certificado digital

1. **Obtener certificado de SUNAT:**
   - Solicitar en https://www.sunat.gob.pe/
   - Descargar archivo `.pfx` o `.p12`

2. **Crear carpeta y copiar certificado:**

```bash
# Crear carpeta
mkdir -p ./certs

# Copiar certificado
cp /ruta/a/tu/cert.pfx ./certs/cert.pfx

# Permisos (en Linux/Mac)
chmod 600 ./certs/cert.pfx
```

3. **Guardar en .gitignore:**

```bash
echo "certs/" >> .gitignore
git add .gitignore
git commit -m "Actualizar gitignore para certificados"
```

---

### PASO 5: Probar la integración

#### a) Iniciar el servidor

```bash
npm run dev
```

Deberías ver en consola:
```
✅ Servidor corriendo en puerto 3000
✅ Conexión a BD establecida: SELECT 1+1 AS result
```

#### b) Obtener token de autenticación

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_usuario": "admin",
    "password": "password123"
  }'
```

**Respuesta esperada:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": 1,
    "modulos": ["usuarios", "ventas", ...]
  }
}
```

Copia el `token` para los siguientes requests.

#### c) Generar comprobante

```bash
curl -X POST http://localhost:3000/api/sunat/generar-comprobante/1 \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json"
```

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "BOLETA generada correctamente",
  "idComprobante": 1,
  "tipo": "BOLETA",
  "serie": "0001",
  "numero": "00000001"
}
```

#### d) Enviar a SUNAT

```bash
curl -X POST http://localhost:3000/api/sunat/enviar/1 \
  -H "Authorization: Bearer TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "usuario_sunat",
    "password": "password_sunat"
  }'
```

---

## ✅ CHECKLIST DE VALIDACIÓN

```
□ npm install completado
□ Variables .env configuradas
□ Script SQL ejecutado
□ Tablas SUNAT creadas en BD
□ Certificado copiado a ./certs/
□ Carpeta certs/ en .gitignore
□ Servidor iniciado (npm run dev)
□ Token obtenido exitosamente
□ Endpoint /api/sunat/ accesible
□ XML se genera sin errores
□ Respuesta de SUNAT recibida
```

---

## 🆘 ERRORES COMUNES Y SOLUCIONES

### ❌ Error: "Cannot find module 'xml-js'"

```bash
# Solución:
npm install xml-js node-rsa axios xmldom
npm start
```

---

### ❌ Error: "Configuración de SUNAT no encontrada"

```sql
-- Solución: Ejecutar SQL
INSERT INTO sunat_configuracion (ruc, nombre_empresa) 
VALUES ('20123456789', 'Mi Empresa');
```

---

### ❌ Error: "No se pudo firmar el documento"

**Causas posibles:**
1. Ruta del certificado incorrecta
2. Contraseña del certificado incorrecta
3. Formato de certificado no compatible

**Soluciones:**
```env
# Verificar ruta
SUNAT_CERT_PATH=./certs/cert.pfx

# Verificar contraseña
SUNAT_CERT_PASSWORD=password_correcto

# Convertir certificado si es necesario
openssl pkcs12 -in cert.pfx -out cert.pem -nodes
```

---

### ❌ Error: "Usuario inválido" desde SUNAT

**Causas:**
- Usuario SUNAT no existe
- Credenciales incorrectas
- Usuario no habilitado en SUNAT
- Ambiente incorrecto (pruebas vs producción)

**Solución:**
- Contactar a SUNAT: facturacion@sunat.gob.pe
- Verificar usuario en portal SUNAT
- Confirmar ambiente en .env

---

### ❌ Error: "Acceso denegado. Token requerido"

```bash
# Asegúrate de incluir el token
curl -X GET http://localhost:3000/api/sunat/ \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

---

## 📱 TESTING CON POSTMAN/INSOMNIA

1. Descargar `SUNAT_Postman_Collection.json`
2. Importar en Postman o Insomnia
3. Cambiar `{{token}}` por token real
4. Ejecutar requests

---

## 🎓 PRÓXIMOS PASOS

### Inmediato:
✅ Probar en ambiente **pruebas** (URL beta)
✅ Verificar que comprobantes se generan
✅ Confirmar envío a SUNAT

### Antes de ir a producción:
- [ ] Cambiar `SUNAT_AMBIENTE=produccion`
- [ ] Usar certificado de producción
- [ ] Validar series correlativas
- [ ] Pruebas exhaustivas
- [ ] Validar IGV 18%
- [ ] Auditar primeros comprobantes

### Mejoras futuras:
- [ ] Consultar CDR (Comprobante de Recepción)
- [ ] Anulación de comprobantes
- [ ] Envío por email
- [ ] Dashboard de reportes
- [ ] Integración con sistema de pagos

---

## 📚 DOCUMENTACIÓN COMPLETA

Lee estos archivos para más detalles:

| Archivo | Contenido |
|---------|-----------|
| `GUIA_SUNAT.md` | Documentación completa y detallada |
| `README_SUNAT.md` | Resumen e instalación |
| `sunat_setup.sql` | Scripts SQL y vistas |
| `.env.sunat` | Variables de ejemplo |
| `SUNAT_Postman_Collection.json` | Endpoints para testing |

---

## 🆘 SOPORTE

Si necesitas ayuda:

1. **Revisar GUIA_SUNAT.md** - Sección Troubleshooting
2. **Revisar logs** del servidor: `console.error` mostrará detalles
3. **Contactar SUNAT:**
   - Email: facturacion@sunat.gob.pe
   - Portal: https://e-factura.sunat.gob.pe/
   - Horario: L-V 08:00 - 17:00 (Perú)

---

## 🎉 ¡LISTA!

**Ya tienes integración SUNAT funcional.**

Ahora puedes:
- ✅ Generar boletas (DNI)
- ✅ Generar facturas (RUC)
- ✅ Enviar a SUNAT
- ✅ Consultar estado
- ✅ Descargar XML
- ✅ Reintentar envíos

**Siguiente: Probar un ciclo completo venta → comprobante → SUNAT**

