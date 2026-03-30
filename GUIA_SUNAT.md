# GUÍA COMPLETA - INTEGRACIÓN SUNAT PERÚ

## 📋 TABLA DE CONTENIDOS
1. [Requisitos Previos](#requisitos-previos)
2. [Instalación de Dependencias](#instalación)
3. [Configuración Inicial](#configuración)
4. [Estructura del XML](#estructura-xml)
5. [Flujo de Comprobantes](#flujo)
6. [Endpoints Disponibles](#endpoints)
7. [Ejemplos de Uso](#ejemplos)
8. [Certificado Digital](#certificado)
9. [Solución de Problemas](#troubleshooting)

---

## 1. REQUISITOS PREVIOS {#requisitos-previos}

### Hardware y Software:
- Node.js 14+
- MySQL 5.7+
- OpenSSL (para certificados)

### En SUNAT:
- RUC activo
- Certificado digital (SOL)
- Datos de conexión usuario/password

### Tablas Requeridas:
Las tablas ya están creadas en tu `sistema_agua.sql`:
- `comprobante_sunat` - Almacena boletas y facturas generadas
- `sunat_configuracion` - Datos de la empresa

---

## 2. INSTALACIÓN {#instalación}

### a) Instalar dependencias:

```bash
npm install
```

Las siguientes librerías fueron añadidas:
- `xml-js` - Convertir JS a XML
- `crypto` - Firma digital
- `node-rsa` - Manejo de certificados RSA
- `axios` - Cliente HTTP para SOAP
- `xmldom` - Parser XML

### b) Crear carpeta de certificados:

```bash
mkdir -p ./certs
```

Coloca tu certificado SUNAT aquí (archivo .pfx o .p12)

---

## 3. CONFIGURACIÓN {#configuración}

### a) Variables de entorno (.env):

```env
SUNAT_AMBIENTE=pruebas
SUNAT_CERT_PATH=./certs/cert.pfx
SUNAT_CERT_PASSWORD=tu_password
SUNAT_RUC=20123456789
SUNAT_EMPRESA=Tu Empresa SAC
SUNAT_DIRECCION=Lima, Lima
SUNAT_SERIE_BOLETA=0001
SUNAT_SERIE_FACTURA=0001
SUNAT_USUARIO_SOL=usuario_sol
SUNAT_PASSWORD_SOL=password_sol
```

### b) Inicializar configuración en BD:

```sql
INSERT INTO sunat_configuracion (
  ruc, 
  nombre_empresa, 
  direccion, 
  serie_boleta, 
  serie_factura, 
  usuario_sunat, 
  usuario_sol
) VALUES (
  '20123456789',
  'Tu Empresa SAC',
  'Calle Principal 123, Lima',
  '0001',
  '0001',
  'usuario',
  'usuario'
);
```

---

## 4. ESTRUCTURA DEL XML {#estructura-xml}

### A) BOLETA (Cliente con DNI):

**Características:**
- Tipo de documento: 03
- No incluye IGV (impuesto)
- Serie: 0001-00000001
- Válida para montos menores (depende de tu caso)

**Estructura básica:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>0001-00000001</cbc:ID>
  <cbc:IssueDate>2024-12-04</cbc:IssueDate>
  <cbc:IssueTime>14:30:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>03</cbc:InvoiceTypeCode>
  
  <!-- Empresa (Emisor) -->
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>20123456789</cbc:CustomerAssignedAccountID>
    <!-- ... datos empresa ... -->
  </cac:AccountingSupplierParty>
  
  <!-- Cliente -->
  <cac:AccountingCustomerParty>
    <cbc:CustomerAssignedAccountID>12345678</cbc:CustomerAssignedAccountID>
    <!-- ... datos cliente ... -->
  </cac:AccountingCustomerParty>
  
  <!-- Líneas de detalle -->
  <cac:InvoiceLine>
    <!-- ... productos ... -->
  </cac:InvoiceLine>
</Invoice>
```

### B) FACTURA (Cliente con RUC):

**Características:**
- Tipo de documento: 01
- Incluye IGV (18%)
- Serie: F001-00000001
- Válida para cualquier monto

**Diferencia principal:**
- CustomizationID: 2.1 (en lugar de 1.1)
- InvoiceTypeCode: 01 (en lugar de 03)
- Incluye sección de impuestos (TaxTotal)

---

## 5. FLUJO DE COMPROBANTES {#flujo}

```
┌─────────────────┐
│  Crear Venta    │
│  (venta.routes) │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ POST /api/sunat/            │
│ generar-comprobante/:idVenta│
│ (sunatController)           │
└────────┬────────────────────┘
         │
         ├─► Obtener datos venta
         ├─► Obtener cliente (determinar DNI/RUC)
         ├─► Obtener detalles
         ├─► Generar XML según tipo
         ├─► Guardar en BD (estado: GENERADO)
         │
         ▼
┌─────────────────────────────┐
│ POST /api/sunat/enviar/     │
│ :idComprobante              │
│ (Enviar a SUNAT)            │
└────────┬────────────────────┘
         │
         ├─► Crear SOAP request
         ├─► Enviar a SUNAT
         ├─► Procesar respuesta
         ├─► Actualizar estado (ACEPTADO/RECHAZADO)
         │
         ▼
┌─────────────────┐
│ Comprobante     │
│ Aceptado/Fallo  │
└─────────────────┘
```

---

## 6. ENDPOINTS DISPONIBLES {#endpoints}

### A) GENERAR COMPROBANTE

**POST** `/api/sunat/generar-comprobante/:idVenta`

- **Headers:** `Authorization: Bearer <token>`
- **Params:** `idVenta` (ID de la venta)
- **Respuesta:**
```json
{
  "success": true,
  "message": "BOLETA generada correctamente",
  "idComprobante": 5,
  "tipo": "BOLETA",
  "serie": "0001",
  "numero": "00000001",
  "xml": "<?xml version=..."
}
```

**Lógica:**
- Si cliente tiene DNI → BOLETA (tipo 03)
- Si cliente tiene RUC → FACTURA (tipo 01)

---

### B) ENVIAR A SUNAT

**POST** `/api/sunat/enviar/:idComprobante`

- **Headers:** `Authorization: Bearer <token>`
- **Body:**
```json
{
  "usuario": "usuario_sunat",
  "password": "password_sunat"
}
```
- **Respuesta:**
```json
{
  "success": true,
  "message": "Comprobante enviado a SUNAT",
  "resultado": {
    "codigo": "0",
    "mensaje": "Comprobante aceptado",
    "respuestaCompleta": "..."
  }
}
```

---

### C) LISTAR COMPROBANTES

**GET** `/api/sunat/?estado=ACEPTADO&tipo=FACTURA&limite=50`

- **Query Params:**
  - `estado` - GENERADO, ACEPTADO, RECHAZADO, ERROR
  - `tipo` - BOLETA, FACTURA
  - `limite` - Cantidad máxima (default: 50)

- **Respuesta:**
```json
{
  "success": true,
  "total": 2,
  "comprobantes": [
    {
      "id": 5,
      "tipo": "BOLETA",
      "serie": "0001",
      "numero": "00000001",
      "cliente": "Juan Pérez",
      "total": 150.50,
      "estado": "ACEPTADO",
      "fechaGeneracion": "2024-12-04T14:30:00.000Z",
      "fechaEnvio": "2024-12-04T14:35:00.000Z",
      "intentosEnvio": 1
    }
  ]
}
```

---

### D) OBTENER UN COMPROBANTE

**GET** `/api/sunat/:idComprobante`

- **Respuesta:**
```json
{
  "success": true,
  "comprobante": {
    "id": 5,
    "tipo": "BOLETA",
    "serie": "0001",
    "numero": "00000001",
    "estado": "ACEPTADO",
    "fechaGeneracion": "2024-12-04T14:30:00.000Z",
    "fechaEnvio": "2024-12-04T14:35:00.000Z",
    "intentosEnvio": 1,
    "respuestaSunat": {
      "codigo": "0",
      "mensaje": "Aceptado"
    }
  }
}
```

---

### E) DESCARGAR XML

**GET** `/api/sunat/:idComprobante/descargar`

- Descarga el archivo XML generado
- Nombre: `BOLETA_0001_00000001.xml`

---

### F) REINTENTAR ENVÍO

**POST** `/api/sunat/:idComprobante/reintentar`

- **Body:**
```json
{
  "usuario": "usuario_sunat",
  "password": "password_sunat"
}
```
- Máximo 5 reintentos

---

### G) OBTENER CONFIGURACIÓN

**GET** `/api/sunat/configuracion/datos`

- Solo Admin (rol 1)
- **Respuesta:**
```json
{
  "success": true,
  "configuracion": {
    "ruc": "20123456789",
    "nombreEmpresa": "Tu Empresa SAC",
    "direccion": "Lima",
    "serieBoleta": "0001",
    "serieFactura": "0001",
    "usuarioSunat": "usuario",
    "usuarioSOL": "usuario_sol",
    "ambiente": "pruebas"
  }
}
```

---

### H) ACTUALIZAR CONFIGURACIÓN

**PATCH** `/api/sunat/configuracion/actualizar`

- Solo Admin (rol 1)
- **Body:**
```json
{
  "ruc": "20123456789",
  "nombreEmpresa": "Mi Empresa SAC",
  "direccion": "Nueva Dirección",
  "serieBoleta": "0001",
  "serieFactura": "0002",
  "usuarioSunat": "nuevo_usuario",
  "usuarioSOL": "nuevo_usuario_sol"
}
```

---

## 7. EJEMPLOS DE USO {#ejemplos}

### Ejemplo 1: Generar y enviar boleta

```bash
# 1. Obtener token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "nombre_usuario": "vendedor",
    "password": "password123"
  }'

# Respuesta:
# {
#   "token": "eyJhbGc...",
#   "user": { ... }
# }

# 2. Generar comprobante para venta ID 10
curl -X POST http://localhost:3000/api/sunat/generar-comprobante/10 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"

# Respuesta:
# {
#   "success": true,
#   "idComprobante": 5,
#   "tipo": "BOLETA",
#   "numero": "00000001"
# }

# 3. Enviar a SUNAT
curl -X POST http://localhost:3000/api/sunat/enviar/5 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "usuario_sunat",
    "password": "password_sunat"
  }'

# Respuesta:
# {
#   "success": true,
#   "resultado": {
#     "codigo": "0",
#     "mensaje": "Aceptado"
#   }
# }
```

### Ejemplo 2: Listar facturas aceptadas

```bash
curl -X GET 'http://localhost:3000/api/sunat/?estado=ACEPTADO&tipo=FACTURA' \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

---

## 8. CERTIFICADO DIGITAL {#certificado}

### Obtener certificado SUNAT:

1. Ir a https://www.sunat.gob.pe/
2. Solicitar certificado digital
3. Descargar archivo .pfx o .p12

### Convertir a formato compatible:

```bash
# Ver contenido
openssl pkcs12 -in cert.pfx -noout

# Convertir a PEM (si es necesario)
openssl pkcs12 -in cert.pfx -out cert.pem -nodes
```

### Guardar certificado:

```bash
# Copiar a la carpeta
cp cert.pfx ./certs/cert.pfx

# Permisos
chmod 600 ./certs/cert.pfx
```

---

## 9. SOLUCIÓN DE PROBLEMAS {#troubleshooting}

### Error: "No se pudo firmar el documento"

**Causa:** Ruta del certificado incorrecta o password incorrecto

**Solución:**
```env
SUNAT_CERT_PATH=./certs/cert.pfx
SUNAT_CERT_PASSWORD=password_correcto
```

---

### Error: "Configuración de SUNAT no encontrada"

**Causa:** No existe registro en tabla `sunat_configuracion`

**Solución:**
```sql
INSERT INTO sunat_configuracion (ruc, nombre_empresa, direccion, serie_boleta, serie_factura)
VALUES ('20123456789', 'Mi Empresa', 'Lima', '0001', '0001');
```

---

### Error: "Comprobante no encontrado"

**Causa:** El `idComprobante` o `idVenta` no existe

**Solución:**
- Verificar que la venta fue creada correctamente
- Usar GET `/api/ventas` para obtener ventas válidas

---

### SUNAT responde "Usuario inválido"

**Causa:** Credenciales de SUNAT incorrectas

**Solución:**
- Verificar usuario SOL en portal SUNAT
- Asegurarse que está en ambiente pruebas/producción correcto

---

### Error: "Se ha excedido el número máximo de reintentos"

**Causa:** Se intentó enviar 5 veces sin éxito

**Solución:**
- Revisar respuesta de SUNAT
- Validar XML generado
- Contactar a SUNAT

---

## NOTAS IMPORTANTES

✅ **Ambientes:**
- `pruebas` - Para testing (URL beta)
- `produccion` - Para envíos reales (URL oficial)

✅ **Series:**
- Boletas y Facturas tienen series independientes
- Serie se incrementa automáticamente
- Máximo 8 dígitos para número correlativo

✅ **Seguridad:**
- Nunca guardar passwords en código
- Usar variables de entorno
- Certificado debe tener permisos 600

✅ **Base de Datos:**
- Tabla `comprobante_sunat` almacena el XML completo
- Campo `respuesta_sunat` contiene JSON con respuesta SUNAT
- Estado posible: GENERADO, ACEPTADO, RECHAZADO, ERROR

✅ **Validaciones:**
- DNI: 8 dígitos (cliente DNI = BOLETA)
- RUC: 11 dígitos (cliente RUC = FACTURA)
- Total > 0
- Cliente debe existir en la BD

---

## REFERENCIAS SUNAT

- Portal: https://e-factura.sunat.gob.pe/
- Documentación: https://www.sunat.gob.pe/
- UBL 2.1 Standard: http://docs.oasis-open.org/ubl/cs-UBL-2.1/
- Web Services SOAP: https://www.sunat.gob.pe/documentos/

