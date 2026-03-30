# 📋 EJEMPLOS DE PAYLOADS Y RESPUESTAS

## 🔐 AUTENTICACIÓN

### Request: Login

```json
{
  "nombre_usuario": "vendedor",
  "password": "password123"
}
```

### Response: Login exitoso

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInJvbGUiOjIsInVzZXJuYW1lIjoidmVuZGVkb3IiLCJpYXQiOjE3MzMzMDEyMDAsImV4cCI6MTczMzMzMjAwMH0.xyz...",
  "user": {
    "id": 2,
    "username": "vendedor",
    "nombre": "Juan Pérez García",
    "role": 2,
    "roleName": "Vendedor",
    "modulos": ["clientes", "productos", "ventas", "ventas_asignacion_rutas"]
  }
}
```

---

## 📦 CREAR VENTA

### Request: POST `/api/ventas`

```json
{
  "id_cliente": 1,
  "id_metodo_pago": 1,
  "detalles": [
    {
      "id_producto": 5,
      "cantidad": 2,
      "precio": 150.00
    },
    {
      "id_producto": 6,
      "cantidad": 1,
      "precio": 75.50
    }
  ],
  "notas": "Entrega a domicilio"
}
```

### Response: Venta creada

```json
{
  "success": true,
  "message": "Venta creada correctamente",
  "ventaId": 45,
  "total": 375.50,
  "estado": "Pendiente"
}
```

---

## 📄 GENERAR COMPROBANTE

### Request: POST `/api/sunat/generar-comprobante/45`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Sin body (usa el ID de venta en la URL)**

### Response: BOLETA generada (Cliente con DNI)

```json
{
  "success": true,
  "message": "BOLETA generada correctamente",
  "idComprobante": 23,
  "tipo": "BOLETA",
  "serie": "0001",
  "numero": "00000023",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\" xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\" xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">...</Invoice>"
}
```

### Response: FACTURA generada (Cliente con RUC)

```json
{
  "success": true,
  "message": "FACTURA generada correctamente",
  "idComprobante": 24,
  "tipo": "FACTURA",
  "serie": "F001",
  "numero": "00000024",
  "xml": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"... CustomizationID=\"2.1\"...></Invoice>"
}
```

---

## 📤 ENVIAR A SUNAT

### Request: POST `/api/sunat/enviar/23`

```json
{
  "usuario": "usuario_sunat",
  "password": "password_sunat"
}
```

### Response: Aceptado por SUNAT

```json
{
  "success": true,
  "message": "Comprobante enviado a SUNAT",
  "resultado": {
    "codigo": "0",
    "mensaje": "Comprobante aceptado",
    "respuestaCompleta": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><ns0:sendBillResponse xmlns:ns0=\"http://service.sunat.gob.pe\"><statusCode>0</statusCode><statusMessage>La Factura número F001-00000023 ha sido aceptada.</statusMessage></ns0:sendBillResponse></soap:Body></soap:Envelope>"
  }
}
```

### Response: Rechazado por SUNAT

```json
{
  "success": true,
  "message": "Comprobante enviado a SUNAT",
  "resultado": {
    "codigo": "2001",
    "mensaje": "RUC debe tener 11 dígitos",
    "respuestaCompleta": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><ns0:sendBillResponse xmlns:ns0=\"http://service.sunat.gob.pe\"><statusCode>2001</statusCode><statusMessage>RUC debe tener 11 dígitos</statusMessage></ns0:sendBillResponse></soap:Body></soap:Envelope>"
  }
}
```

### Response: Error de conexión

```json
{
  "error": "Error: connect ECONNREFUSED 192.168.1.1:443"
}
```

---

## 🔍 OBTENER COMPROBANTE

### Request: GET `/api/sunat/23`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Response: Estado de comprobante

```json
{
  "success": true,
  "comprobante": {
    "id": 23,
    "tipo": "BOLETA",
    "serie": "0001",
    "numero": "00000023",
    "estado": "ACEPTADO",
    "fechaGeneracion": "2024-12-04T14:30:00.000Z",
    "fechaEnvio": "2024-12-04T14:35:12.000Z",
    "intentosEnvio": 1,
    "respuestaSunat": {
      "codigo": "0",
      "mensaje": "Comprobante aceptado"
    }
  }
}
```

---

## 📋 LISTAR COMPROBANTES

### Request: GET `/api/sunat/?estado=ACEPTADO&tipo=BOLETA&limite=10`

**Query Parameters:**
- `estado` (opcional): GENERADO, ACEPTADO, RECHAZADO, ERROR
- `tipo` (opcional): BOLETA, FACTURA
- `limite` (opcional): default 50

### Response: Lista de comprobantes

```json
{
  "success": true,
  "total": 3,
  "comprobantes": [
    {
      "id": 23,
      "tipo": "BOLETA",
      "serie": "0001",
      "numero": "00000023",
      "cliente": "Juan Pérez García",
      "total": 375.50,
      "estado": "ACEPTADO",
      "fechaGeneracion": "2024-12-04T14:30:00.000Z",
      "fechaEnvio": "2024-12-04T14:35:12.000Z",
      "intentosEnvio": 1
    },
    {
      "id": 22,
      "tipo": "BOLETA",
      "serie": "0001",
      "numero": "00000022",
      "cliente": "María López",
      "total": 250.00,
      "estado": "ACEPTADO",
      "fechaGeneracion": "2024-12-04T13:45:00.000Z",
      "fechaEnvio": "2024-12-04T13:50:30.000Z",
      "intentosEnvio": 1
    },
    {
      "id": 21,
      "tipo": "FACTURA",
      "serie": "F001",
      "numero": "00000021",
      "cliente": "Empresa ABC SAC",
      "total": 1500.00,
      "estado": "ACEPTADO",
      "fechaGeneracion": "2024-12-04T12:00:00.000Z",
      "fechaEnvio": "2024-12-04T12:05:45.000Z",
      "intentosEnvio": 1
    }
  ]
}
```

---

## 💾 DESCARGAR XML

### Request: GET `/api/sunat/23/descargar`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response: Archivo XML

```
Content-Type: application/xml
Content-Disposition: attachment; filename="BOLETA_0001_00000023.xml"

<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" 
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" 
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>1.1</cbc:CustomizationID>
  <cbc:ID>0001-00000023</cbc:ID>
  <cbc:IssueDate>2024-12-04</cbc:IssueDate>
  <cbc:IssueTime>14:30:00</cbc:IssueTime>
  <!-- ... resto del XML ... -->
</Invoice>
```

---

## 🔄 REINTENTAR ENVÍO

### Request: POST `/api/sunat/23/reintentar`

```json
{
  "usuario": "usuario_sunat",
  "password": "password_sunat"
}
```

### Response: Reintento exitoso

```json
{
  "success": true,
  "message": "Comprobante reenviado",
  "resultado": {
    "codigo": "0",
    "mensaje": "Comprobante aceptado"
  }
}
```

### Response: Error - Máximo de reintentos

```json
{
  "error": "Se ha excedido el número máximo de reintentos (5)"
}
```

---

## ⚙️ CONFIGURACIÓN

### Request: GET `/api/sunat/configuracion/datos` (Admin only)

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response: Configuración actual

```json
{
  "success": true,
  "configuracion": {
    "ruc": "20123456789",
    "nombreEmpresa": "Sistema Agua Perú SAC",
    "direccion": "Av. Principal 123, Lima 15001",
    "serieBoleta": "0001",
    "serieFactura": "F001",
    "usuarioSunat": "usuario_sunat",
    "usuarioSOL": "usuario_sol",
    "ambiente": "pruebas"
  }
}
```

---

### Request: PATCH `/api/sunat/configuracion/actualizar` (Admin only)

```json
{
  "ruc": "20123456789",
  "nombreEmpresa": "Sistema Agua Perú SAC",
  "direccion": "Nueva dirección",
  "serieBoleta": "0001",
  "serieFactura": "F001",
  "usuarioSunat": "nuevo_usuario",
  "usuarioSOL": "nuevo_usuario_sol"
}
```

### Response: Actualización exitosa

```json
{
  "success": true,
  "message": "Configuración actualizada correctamente"
}
```

---

## ❌ RESPUESTAS DE ERROR

### Error: Cliente no encontrado

```json
{
  "error": "Cliente no encontrado"
}
```

### Error: Venta no encontrada

```json
{
  "error": "Venta no encontrada"
}
```

### Error: Comprobante no encontrado

```json
{
  "error": "Comprobante no encontrado"
}
```

### Error: Token requerido

```json
{
  "error": "Acceso denegado. Token requerido."
}
```

### Error: Token inválido

```json
{
  "error": "Token inválido."
}
```

### Error: No tienes permisos

```json
{
  "error": "No tienes permisos para esta acción."
}
```

### Error: Acceso denegado a módulo

```json
{
  "error": "No tienes acceso al módulo ventas.",
  "modulo": "ventas",
  "modulosPermitidos": ["clientes", "productos"]
}
```

### Error: Validación fallida

```json
{
  "error": "Usuario y contraseña son requeridos"
}
```

---

## 📊 EJEMPLO COMPLETO: Flujo de Venta a Comprobante

### 1️⃣ Login y obtener token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"nombre_usuario": "vendedor", "password": "pass123"}'
```

**Token obtenido:** `eyJhbGc...` (guardar para requests siguientes)

---

### 2️⃣ Crear venta

```bash
curl -X POST http://localhost:3000/api/ventas \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "id_cliente": 1,
    "id_metodo_pago": 1,
    "detalles": [
      {"id_producto": 5, "cantidad": 2, "precio": 150.00}
    ]
  }'
```

**Venta creada:** `id_venta: 45`

---

### 3️⃣ Generar comprobante

```bash
curl -X POST http://localhost:3000/api/sunat/generar-comprobante/45 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

**Comprobante generado:** `id_comprobante: 23` (tipo BOLETA)

---

### 4️⃣ Enviar a SUNAT

```bash
curl -X POST http://localhost:3000/api/sunat/enviar/23 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "usuario": "usuario_sunat",
    "password": "password_sunat"
  }'
```

**Resultado:** `codigo: "0"` (Aceptado)

---

### 5️⃣ Verificar estado

```bash
curl -X GET http://localhost:3000/api/sunat/23 \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

**Estado:** `ACEPTADO` ✅

---

## 🎯 CASOS DE USO

### Caso 1: Venta a cliente DNI

- Cliente: Juan Pérez (DNI: 12345678)
- Resultado: BOLETA serie 0001
- Número: 00000001
- No incluye IGV

### Caso 2: Venta a empresa RUC

- Cliente: Empresa ABC SAC (RUC: 20123456789)
- Resultado: FACTURA serie F001
- Número: 00000001
- Incluye IGV 18%

### Caso 3: Reintentar envío fallido

1. Generar comprobante ✅
2. Enviar a SUNAT ❌ (falla)
3. Reintentar (max 5 veces)
4. Hasta que se acepte o se descarte

### Caso 4: Listar reportes

- Filtrar por estado (ACEPTADO)
- Filtrar por tipo (FACTURA)
- Exportar para auditoría

