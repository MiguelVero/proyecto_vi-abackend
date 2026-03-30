// src/routes/venta.routes.js
import express from 'express';
import { 
    getVentas, 
    getVentaById, 
    createVenta, 
    updateEstadoVenta,
    getVentasPorEstado,  // ✅ AGREGAR ESTA IMPORTACIÓN
    asignarRepartidor,
    getEstadisticasVentas,
    getResumenVentasPorDia,
      cancelarVentaConStock
        // ✅ AGREGAR ESTA IMPORTACIÓN
} from '../controllers/venta.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { convertirFechasPeru } from '../middleware/fecha.middleware.js';
const router = express.Router();

// Todas las rutas requieren autenticación y módulo 'ventas'
router.use(verifyToken);

// Rutas de ventas
router.get('/', requireRole([1, 2], 'ventas'),  convertirFechasPeru,getVentas);
router.get('/:id', requireRole([1, 2], 'ventas'), convertirFechasPeru,getVentaById);
router.post('/', requireRole([1, 2], 'ventas'), createVenta);
router.patch('/:id/estado', requireRole([1, 2], 'ventas'), updateEstadoVenta);

// Rutas específicas
router.get('/estado/:estadoId', requireRole([1, 2], 'ventas'), convertirFechasPeru,getVentasPorEstado);
router.patch('/:id/asignar-repartidor', requireRole([1, 2], 'ventas_asignacion_rutas'), asignarRepartidor); // Usa módulo 'rutas'
// En venta.routes.js - AGREGAR estas rutas nuevas
router.get('/estadisticas/ventas', requireRole([1, 2], 'ventas'), getEstadisticasVentas);
router.get('/estadisticas/resumen-dia', requireRole([1, 2], 'ventas'), getResumenVentasPorDia);
router.post('/:id/cancelar-con-stock', 
    requireRole([1, 2], 'ventas'), 
    cancelarVentaConStock
);
export default router;