// backend_dsi6/routes/sunat.routes.js
import express from 'express';
import sunatController from '../controllers/sunat.controller.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Emitir comprobante
router.post(
    '/venta/:idVenta/emitir',
    requireRole([1, 2], 'ventas'),
    sunatController.emitirComprobante
);

// Listar comprobantes
router.get(
    '/comprobantes',
    requireRole([1, 2], 'ventas'),
    async (req, res) => {
        try {
            const { estado, tipo, limite = 50 } = req.query;
            let query = `
                SELECT cs.*, v.total, v.fecha, 
                       c.razon_social, p.nombre_completo,
                       CONCAT(cs.serie, '-', LPAD(cs.numero, 8, '0')) as serie_numero
                FROM comprobante_sunat cs
                JOIN venta v ON cs.id_venta = v.id_venta
                LEFT JOIN cliente c ON v.id_cliente = c.id_cliente
                LEFT JOIN persona p ON c.id_persona = p.id_persona
                WHERE 1=1
            `;
            
            const params = [];
            if (estado) { query += ' AND cs.estado_envio = ?'; params.push(estado); }
            if (tipo) { query += ' AND cs.tipo_comprobante = ?'; params.push(tipo); }
            
            query += ' ORDER BY cs.fecha_emision DESC LIMIT ?';
            params.push(parseInt(limite));
            
            const [comprobantes] = await db.execute(query, params);
            res.json({ success: true, total: comprobantes.length, comprobantes });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

export default router;