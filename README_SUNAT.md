# INTEGRACIÓN SUNAT PERÚ - README

## 🚀 ¿QUÉ SE IMPLEMENTÓ?

Se ha implementado un **sistema completo de facturación electrónica** que integra tu aplicación Express + MySQL con los servicios de SUNAT (Administración Tributaria del Perú).

### Características principales:

✅ **Generación automática de comprobantes**
- Detecta automáticamente si es BOLETA (DNI) o FACTURA (RUC)
- Genera XML en formato UBL 2.1 (estándar SUNAT)

✅ **Firma digital**
- Soporta certificados .pfx y .p12
- Firma con RSA 2048

✅ **Envío a SUNAT**
- Integración SOAP
- Modo pruebas (beta) y producción
- Reintentos automáticos

✅ **Gestión de comprobantes**
- Almacenamiento en BD
- Consulta de estado
- Descarga de XML
- Auditoría completa

---

## 📁 ARCHIVOS CREADOS

```
backend_dsi6/
├── services/
│   └── sunatService.js          ⭐ Servicio principal SUNAT
├── controllers/
│   └── sunatController.js       ⭐ Controladores de endpoints
├── routes/
│   └── sunat.routes.js          ⭐ Rutas SUNAT
├── GUIA_SUNAT.md                📖 Documentación completa
├── sunat_setup.sql              🔧 Scripts SQL
├── .env.sunat                   ⚙️ Configuración de ejemplo
└── certs/                       🔐 Carpeta para certificados
    └── cert.pfx                 (tu certificado SUNAT)
```

---

## 🔧 INSTALACIÓN RÁPIDA

### 1. Instalar dependencias nuevas:

```bash
npm install
```

### 2. Ejecutar script SQL:

```bash
# En MySQL
mysql -u root -p sistema_agua < sunat_setup.sql
```

### 3. Configurar variables de entorno:

Copia el contenido de `.env.sunat` a tu `.env`:

```env
SUNAT_AMBIENTE=pruebas
SUNAT_CERT_PATH=./certs/cert.pfx
SUNAT_RUC=20123456789
SUNAT_EMPRESA=Tu Empresa SAC
# ... más variables
```

### 4. Colocar certificado:

```bash
# Copiar tu cert.pfx a la carpeta
cp /ruta/al/cert.pfx ./certs/cert.pfx
```

### 5. Inicializar configuración en BD:

```sql
UPDATE sunat_configuracion SET 
  ruc = '20123456789',
  nombre_empresa = 'Tu Empresa SAC',
  usuario_sunat = 'tu_usuario',
  usuario_sol = 'tu_usuario_sol'
WHERE id_config = 1;
```

### 6. Probar en desarrollo:

```bash
npm run dev
```

---

## 📊 FLUJO PRINCIPAL

```
1. Usuario crea VENTA
   ↓
2. POST /api/sunat/generar-comprobante/:idVenta
   → Valida cliente (DNI o RUC)
   → Genera XML (UBL 2.1)
   → Firma digitalmente
   → Guarda en comprobante_sunat
   ↓
3. POST /api/sunat/enviar/:idComprobante
   → Prepara SOAP request
   → Envía a SUNAT (pruebas o prod)
   → Procesa respuesta
   → Actualiza estado
   ↓
4. GET /api/sunat/:idComprobante
   → Consulta estado y respuesta SUNAT
```

---

## 🔑 ENDPOINTS PRINCIPALES

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/sunat/generar-comprobante/:idVenta` | Generar boleta/factura |
| POST | `/api/sunat/enviar/:idComprobante` | Enviar a SUNAT |
| GET | `/api/sunat/:idComprobante` | Obtener estado |
| GET | `/api/sunat/` | Listar comprobantes |
| GET | `/api/sunat/:idComprobante/descargar` | Descargar XML |
| POST | `/api/sunat/:idComprobante/reintentar` | Reintentar envío |
| GET | `/api/sunat/configuracion/datos` | Obtener config (admin) |
| PATCH | `/api/sunat/configuracion/actualizar` | Actualizar config (admin) |

---

## 💾 TABLAS RELACIONADAS

### comprobante_sunat
Almacena boletas y facturas generadas:

```sql
- id_comprobante    (PK)
- id_venta          (FK a venta)
- tipo              BOLETA | FACTURA
- serie             0001, 0002, etc
- numero_secuencial 1, 2, 3...
- xml_generado      XML completo
- estado            GENERADO, ACEPTADO, RECHAZADO, ERROR
- respuesta_sunat   Respuesta JSON de SUNAT
- fecha_generacion
- fecha_envio
- intentos_envio    Contador de reintentos
```

### sunat_configuracion
Datos de tu empresa para SUNAT:

```sql
- id_config
- ruc               Tu RUC empresarial
- nombre_empresa    Nombre registrado en SUNAT
- direccion         Domicilio fiscal
- serie_boleta      Serie para boletas (ej: 0001)
- serie_factura     Serie para facturas (ej: F001)
- usuario_sunat     Usuario SUNAT para envíos
- usuario_sol       Usuario SOL certificado
- ambiente          pruebas | produccion
```

---

## 🎯 EJEMPLO DE USO

### Paso 1: Generar comprobante

```bash
curl -X POST http://localhost:3000/api/sunat/generar-comprobante/10 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

**Respuesta:**
```json
{
  "success": true,
  "message": "BOLETA generada correctamente",
  "idComprobante": 5,
  "tipo": "BOLETA",
  "serie": "0001",
  "numero": "00000001",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Invoice>..."
}
```

### Paso 2: Enviar a SUNAT

```bash
curl -X POST http://localhost:3000/api/sunat/enviar/5 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "tu_usuario_sunat",
    "password": "tu_password_sunat"
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Comprobante enviado a SUNAT",
  "resultado": {
    "codigo": "0",
    "mensaje": "Comprobante aceptado"
  }
}
```

### Paso 3: Verificar estado

```bash
curl -X GET http://localhost:3000/api/sunat/5 \
  -H "Authorization: Bearer TOKEN"
```

---

## 🔒 SEGURIDAD

### Autenticación y Autorización:

- ✅ Todos los endpoints requieren JWT token
- ✅ Solo roles 1 (Admin) y 2 (Vendedor) pueden generar comprobantes
- ✅ Solo Admin puede cambiar configuración
- ✅ Módulo 'ventas' requerido para acceso

### Certificado digital:

- 🔐 Almacenar en carpeta `.gitignore` (./certs/)
- 🔐 Permisos 600 en Linux/Mac
- 🔐 Contraseña en variables de entorno

### Credenciales SUNAT:

- 🔐 NUNCA guardar en código
- 🔐 Usar variables de entorno
- 🔐 Cambiar contraseña regularmente

---

## ⚙️ CONFIGURACIÓN AVANZADA

### Cambiar ambiente de pruebas a producción:

```env
# .env
SUNAT_AMBIENTE=produccion
```

**URLs SUNAT:**
- Pruebas: `https://e-beta.sunat.gob.pe:443/ol-ti-itcpfegem-beta/billService`
- Producción: `https://e-factura.sunat.gob.pe:443/ol-ti-itcpfegem/billService`

### Usar múltiples series:

```sql
UPDATE sunat_configuracion SET 
  serie_boleta = '0002',
  serie_factura = 'F002'
WHERE id_config = 1;
```

Cada serie tendrá su propio contador correlativo (0001-99999999).

---

## 🐛 TROUBLESHOOTING

### Error: "Configuración de SUNAT no encontrada"

```sql
INSERT INTO sunat_configuracion (ruc, nombre_empresa) 
VALUES ('20123456789', 'Mi Empresa');
```

### Error: "No se pudo firmar el documento"

- Verificar ruta del certificado
- Verificar contraseña del certificado
- Intentar convertir a PEM si es necesario

### Error: "Usuario inválido" desde SUNAT

- Verificar credenciales SUNAT
- Verificar ambiente (pruebas vs producción)
- Revisar si usuario SOL está habilitado

### SUNAT rechaza comprobante

- Validar cliente existe con tipo_documento correcto
- Verificar total > 0
- Revisar detalles de venta (productos, precios, cantidades)

---

## 📚 DOCUMENTACIÓN COMPLETA

Lee **`GUIA_SUNAT.md`** para:
- Estructura detallada del XML
- Todos los endpoints con ejemplos
- FAQ y solución de problemas
- Referencias de SUNAT

---

## 🔄 PRÓXIMOS PASOS

### Ya funcionando:
✅ Generar comprobantes
✅ Enviar a SUNAT
✅ Almacenar en BD
✅ Consultar estado

### Opcional (mejoras futuras):
- [ ] Consultar CDR (Comprobante de Recepción) a SUNAT
- [ ] Actualización de estado automática
- [ ] Envío de comprobantes por email
- [ ] Plantillas de impresión
- [ ] Descargo de RX (Razón Social)
- [ ] Anulación de comprobantes

---

## 📞 SOPORTE SUNAT

- **Portal:** https://e-factura.sunat.gob.pe/
- **Documentación:** https://www.sunat.gob.pe/
- **Correo soporte:** <mailto:facturacion@sunat.gob.pe>
- **Horario:** L-V 08:00 - 17:00 (Perú)

---

## 📝 NOTAS FINALES

⚠️ **Importante:**
- Hacer pruebas en ambiente `pruebas` antes de pasar a producción
- Mantener backups de certificados digitales
- Verificar series correlativas regularmente
- Auditar comprobantes emitidos mensualmente

📊 **Monitoreo:**
- Ver tabla `comprobante_sunat` para auditoría
- Usar vista `vw_comprobantes_resumen` para reportes
- Ejecutar `sp_estadisticas_sunat` para análisis

✅ **Validaciones automáticas:**
- Detección de DNI vs RUC
- Generación correlativa de números
- Límite de reintentos
- Estado de comprobantes

---

**¡Integración SUNAT completamente funcional! 🎉**
