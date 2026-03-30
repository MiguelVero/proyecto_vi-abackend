// src/routes/repartidor-venta.routes.js
import express from 'express';
import {
    getVentasAsignadas,
    getEntregasPendientes,
    getHistorialEntregas,
    getVentaDetalleAsignada,
    updateEstadoVentaRepartidor, // Nueva función
    cancelarEntregaRepartidor,
    iniciarRutaEntrega ,
    verificarPuedeMarcarPagado,
    cambiarMetodoPago  // NUEVA IMPORTACIÓN
} from '../controllers/repartidor-venta.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas existentes
router.get('/repartidor/asignadas', requireRole([3],'rutas_asignadas'), getVentasAsignadas);
router.get('/repartidor/pendientes', requireRole([3],'entregas_pendientes'), getEntregasPendientes);
router.get('/repartidor/historial', requireRole([3],'historial_entregas'), getHistorialEntregas);
router.get('/repartidor/detalle/:id', requireRole([3], 'rutas_asignadas'), getVentaDetalleAsignada);

// NUEVAS RUTAS PARA ACTUALIZAR ESTADO
router.patch('/repartidor/:id/pagado', requireRole([3], 'entregas_pendientes'), updateEstadoVentaRepartidor);
router.patch('/repartidor/:id/cancelado', requireRole([3], 'entregas_pendientes'), cancelarEntregaRepartidor);
router.patch('/repartidor/:id/iniciar-ruta', requireRole([3], 'rutas_asignadas'), iniciarRutaEntrega);
// Agregar nueva ruta de verificación
// Agrega la nueva ruta de verificación
router.get('/repartidor/:id/verificar-pago', requireRole([3], 'entregas_pendientes'), verificarPuedeMarcarPagado);
// NUEVA RUTA PARA CAMBIAR MÉTODO DE PAGO
router.patch('/repartidor/:id/cambiar-metodo-pago', requireRole([3], 'entregas_pendientes'), cambiarMetodoPago);
export default router;