## Instrucciones rápidas para agentes AI (proyecto backend-dsi6)

Objetivo corto: ayudar a un agente a ser productivo rápidamente al editar, añadir o corregir features en este backend Express + MySQL.

- Arquitectura general
  - Código en Node.js (ES Modules, ver `package.json` -> "type": "module").
  - Servidor: `app.js` expone rutas bajo el prefijo `/api` (importa `routes/index.js`).
  - Base de datos: MySQL usando `mysql2/promise` con pool en `config/db.js`.
  - Organización: `routes/` declara endpoints y agrupa middlewares; `controllers/` contiene la lógica por entidad.

- Flujo y contratos comunes
  - Rutas públicas de lectura suelen estar antes de `router.use(verifyToken)` y las operaciones de modificación se protegen después.
    Ejemplo: `routes/producto.routes.js` expone GET públicas y protege POST/PUT/DELETE con `verifyToken` + `requireRole([1])`.
  - `middleware/auth.js` expone `verifyToken` (añade `req.user` normalizado) y `requireRole(roles)`.
  - Los controladores devuelven JSON con claves mapeadas desde columnas SQL a objetos JS (p. ej. `id_producto` -> `id`). Vea `controllers/producto.controller.js`.

- Convenciones detectadas
  - Autenticación: JWT con `process.env.JWT_SECRET` (hay valores de fallback en varios ficheros). Token en header `Authorization: Bearer <token>`.
  - Respuestas de error: JSON con `message` o `error`; 400/401/403/404 según el caso.
  - Acceso a DB: usar `db.query` o `db.execute` importando `config/db.js`.
  - Cuando se crea un `usuario`, si no se pasa `id_persona` se crea una entrada en `persona` (varios controladores siguen esta práctica).

- Detalles operativos (cómo ejecutar y depurar)
  - Scripts NPM: `npm start` (producción) y `npm run dev` (usa `nodemon`).
  - Variables de entorno importantes: `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
  - Archivo SQL con esquema inicial: `sistema_agua.sql` (útil para poblar la DB local antes de probar endpoints).
  - Al iniciar, `app.js` intenta una consulta simple (`SELECT 1+1 AS result`) para validar la conexión DB.

- Patrones a respetar al editar/añadir código
  - Mantener separación routes/controllers; las rutas importan controladores y aplican middlewares (`verifyToken`, `requireRole`).
  - Normalizar `req.user` si añades middleware relacionado con auth (seguir `middleware/auth.js`).
  - Evitar cambiar forma de JSON devuelta por controladores sin actualizar el frontend — muchos controladores mapean columnas SQL a nombres distintos.

- Integraciones y dependencias externas
  - Dependencias principales: `express`, `mysql2`, `bcryptjs`, `jsonwebtoken`, `cors`, `dotenv`.
  - No hay pruebas automatizadas en el repo actualmente — los cambios deben probarse contra una BD local (usar `sistema_agua.sql`).

Si alguna parte queda poco clara o quieres que incluya ejemplos adicionales (p. ej. cómo emitir tokens, migraciones SQL, o patrones de manejo de transacciones), dime qué sección ampliar y la extiendo.

## Estructura de la base de datos y módulos sugeridos
Abajo tienes un resumen condensado de las tablas principales, sus relaciones y una propuesta de cómo convertirlas en módulos (controllers/routes) para nuevas features.

- Tablas centrales y propósito (mapear a módulos):
  - `persona` — datos personales (módulo: persona). PK `id_persona`, UNIQUE `numero_documento`.
  - `usuario` — autenticación y autorización (módulo: auth / usuario). FK `id_persona`, `id_rol`. Campos sensibles: `password` (almacenar hash).
  - `rol` — roles de usuario (módulo: usuario/roles). PK `id_rol`.
  - `producto`, `categorias`, `marcas`, `proveedor`, `lote_producto` — catálogo y stock (módulo: producto/inventario).
  - `venta`, `venta_detalle`, `metodo_pago`, `estado_venta` — proceso de venta (módulo: ventas). `venta_detalle.subtotal` es GENERATED.
  - `cliente` — vincula `persona` a clientes; `proveedor` vincula `persona` a proveedores (módulo: clientes/proveedores).
  - `repartidor`, `pedido_proveedor`, `estado_pedido_proveedor` — logística y pedidos (módulo: logística/reparto).

- Relaciones importantes (efecto en diseño de módulos):
  - `usuario.id_persona` → `persona.id_persona`: la UI/backend suelen crear/leer `persona` cuando se crea `usuario`.
  - `producto` referencia `categorias`, `marcas`, `proveedor`, `pais` — al exponer endpoints de producto, devolver objetos embebidos o ids coherentes.
  - `venta` → `venta_detalle` (ON DELETE CASCADE): eliminar venta elimina sus líneas; al implementar borrados ten en cuenta side-effects.

- Reglas y restricciones prácticas a respetar en código:
  - No insertar duplicados en `persona.numero_documento`, `usuario.nombre_usuario` o `usuario.email` (hay UNIQUE constraints).
  - Usar transacciones para operaciones compuestas (crear persona + usuario, crear venta + detalles + actualizar stock/lotes).
  - Al actualizar stock, preferir lógica que consuma `lote_producto.cantidad_actual` y registre movimientos para auditoría.

- Cómo usar esto para crear módulos:
  - Módulo `auth/usuario`: login/verify/register + endpoints admin para listar/activar/rol. Reusar `middleware/auth.js`.
  - Módulo `producto/inventario`: endpoints públicos para listados; rutas protegidas (Admin/Almacenero) para creación/stock/lotes.
  - Módulo `ventas`: endpoint para crear venta (transaction: insertar `venta`, insertar `venta_detalle`, decrementar stock en `lote_producto`/`producto`).

Si quieres, puedo añadir ejemplos de payloads (login, register, crear venta) o generar un diagrama ER simplificado en Markdown para incluir en esta guía.

  ### Cambios recientes (últimas actualizaciones)

  - Se añadió el script `generar-hash-real.js` en la raíz del proyecto. Úsalo como referencia para generación/validación de hashes si necesitas scripts auxiliares fuera del servidor.
  - Revisa `app.js` y las rutas bajo `routes/` para ver las últimas integraciones; muchas rutas públicas de lectura permanecen sin `verifyToken`, y las operaciones de modificación están protegidas como convención.
  - Si estás trabajando en la rama de integración (por ejemplo `paolo-integration`), confirma que localmente tu branch está actualizado antes de hacer merge.

  ### Cómo probar localmente (rápido)

  1. Instala dependencias y arranca en modo desarrollo:

    - Asegúrate de tener un MySQL disponible y crea la base con `sistema_agua.sql` si aún no la tienes.
    - Copia un `.env` con las variables mínimas: `PORT`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
    - Comandos típicos (PowerShell):

       npm install
       npm run dev

  2. Verifica la conexión a la BD: `app.js` ejecuta una consulta simple (`SELECT 1+1 AS result`) al iniciar; revisa la salida en la consola para confirmar.

  3. Probar endpoints básicos:

    - Importa `sistema_agua.sql` en tu MySQL local para poblar tablas y datos de prueba.
    - Usa Postman/Insomnia o curl para probar rutas públicas (GET productos, GET categorias) y rutas protegidas (requieren `Authorization: Bearer <token>`).

  ### Checklist rápido antes de push / crear PR

  - Ejecutar `npm run lint` si tienes linter configurado (añádelo si falta).
  - Ejecutar `npm run dev` y confirmar que la app arranca y muestra la comprobación del pool de MySQL.
  - Probar manualmente (al menos) un endpoint público y un endpoint protegido con token válido.
  - Actualizar `README.md` si añades endpoints públicos o scripts nuevos (por ejemplo `generar-hash-real.js`).
  - Añadir una entrada breve en el changelog/PR describiendo los cambios de BD o contratos JSON.

  ### Notas de debugging comunes

  - Errores de conexión DB: revisa variables de entorno y que el usuario MySQL tenga permisos sobre la base `DB_NAME`.
  - JWT / auth: si recibes 401, confirma `process.env.JWT_SECRET` local y que el token se genera con la misma clave.
  - Duplicados/constraints SQL: si ves errores por UNIQUE constraints (usuario/email/numero_documento), valida los datos de prueba y usa transacciones cuando crees persona+usuario.
  - Transacciones: para operaciones compuestas (crear usuario+persona, crear venta+detalles, actualizar stock), usar transacciones con el pool de `mysql2/promise` para evitar estados inconsistentes.

  ### Pequeños extras y próximos pasos sugeridos

  - Añadir scripts de verificación automatizada (un par de tests de integración) que usen una base de datos en memoria o una DB de prueba para validar los endpoints más críticos (auth, crear venta).
  - Documentar payloads de ejemplo para `auth` y `venta` en un `docs/` o en el `README.md`.
  - Si vas a exponer más endpoints públicos, añade rate-limiting y validación de inputs (p. ej. `express-validator`) para robustez.

  Si quieres, aplico estos cambios directamente en un branch y abro un commit/PR con este archivo modificado y un `README.md` actualizado con los pasos para ejecutar localmente.
