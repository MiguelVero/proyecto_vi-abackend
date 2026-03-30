// backend_dsi6/routes/sunat.routes.js
import express from 'express';
import sunatController from '../controllers/sunat.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
const router = express.Router();

router.use(verifyToken);
// ✅ RUTA PARA OBTENER SIGUIENTE NÚMERO
router.post('/siguiente-numero', requireRole([1, 2], 'sunat'), sunatController.obtenerSiguienteNumero);

// Emitir comprobante
router.post('/venta/:idVenta/emitir', requireRole([1, 2], 'sunat'), sunatController.emitirComprobante);

// Listar comprobantes
router.get('/comprobantes', requireRole([1, 2], 'sunat'), sunatController.listarComprobantes);

// Obtener XML
router.get('/comprobantes/:idComprobante/xml', requireRole([1, 2], 'sunat'), sunatController.obtenerXml);

// Obtener detalles
router.get('/comprobantes/:idComprobante', requireRole([1, 2], 'sunat'), sunatController.consultarComprobante);

// ✅ AGREGAR RUTA DE REENVÍO
router.post('/comprobantes/:idComprobante/reenviar', requireRole([1, 2], 'sunat'), sunatController.reenviarComprobante);

export default router;