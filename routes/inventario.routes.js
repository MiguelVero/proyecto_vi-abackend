// src/routes/inventario.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getDashboardData,
  generarReporteStock,
  getProductosStockBajo,
  getLotesPorCaducar,
  getDistribucionCategorias,
  getTendenciaMovimientos
} from "../controllers/inventario.controller.js";
import db from "../config/db.js"; // ✅ AGREGAR

const router = express.Router();

// Dashboard de inventario
router.get("/dashboard", verifyToken, requireRole([1, 4], 'inventario'), getDashboardData);

// ✅ AGREGAR: Métricas adicionales
router.get("/valor-total", verifyToken, requireRole([1, 4], 'inventario'), async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(stock * precio), 0) as valor_total 
      FROM producto WHERE activo = 1
    `);
    res.json(parseFloat(rows[0].valor_total) || 0);
  } catch (error) {
    console.error("Error al obtener valor total:", error);
    res.status(500).json({ message: "Error al obtener valor total" });
  }
});

// ✅ AGREGAR: Movimientos del mes
router.get("/movimientos", verifyToken, requireRole([1, 4], 'inventario'), async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    let query = `
      SELECT 
        m.id_movimiento,
        m.tipo_movimiento,
        m.cantidad,
        m.fecha,
        m.descripcion,
        p.nombre as producto,
        u.nombre_usuario
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
    `;
    
    const params = [];
    
    if (fechaInicio && fechaFin) {
      query += " WHERE m.fecha >= ? AND m.fecha <= ?";
      params.push(fechaInicio, fechaFin);
    }
    
    query += " ORDER BY m.fecha DESC";
    
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener movimientos:", error);
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
});

// ✅ AGREGAR: Lotes próximos a caducar (alias para alertas/caducidad)
router.get("/lotes-proximos-caducar", verifyToken, requireRole([1, 4], 'inventario'), getLotesPorCaducar);

// Reportes
router.post("/reportes/stock", verifyToken, requireRole([1, 4], 'inventario_reportes'), generarReporteStock);

// Alertas
router.get("/alertas/stock-bajo", verifyToken, requireRole([1, 4], 'inventario'), getProductosStockBajo);
router.get("/alertas/caducidad", verifyToken, requireRole([1, 4], 'inventario'), getLotesPorCaducar);
// En inventario.routes.js - agregar estas rutas
router.get("/distribucion-categorias", verifyToken, requireRole([1, 4], 'inventario'), getDistribucionCategorias);
router.get("/tendencia-movimientos", verifyToken, requireRole([1, 4], 'inventario'), getTendenciaMovimientos);
export default router;