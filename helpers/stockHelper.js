// src/helpers/stockHelper.js
import db from "../config/db.js";

export const getStockDisponiblePorLote = async (id_producto) => {
  try {
    const [lotes] = await db.execute(`
      SELECT 
        lp.id_lote,
        lp.numero_lote,
        lp.fecha_caducidad,
        lp.cantidad_actual as stock_disponible,
        DATEDIFF(lp.fecha_caducidad, CURDATE()) as dias_para_caducar,
        p.nombre as producto_nombre
      FROM lote_producto lp
      JOIN producto p ON lp.id_producto = p.id_producto
      WHERE lp.id_producto = ? AND lp.cantidad_actual > 0 AND lp.activo = 1
      ORDER BY lp.fecha_caducidad ASC
    `, [id_producto]);

    return lotes;
  } catch (error) {
    console.error("Error al obtener stock por lote:", error);
    throw error;
  }
};

export const getStockTotalProducto = async (id_producto) => {
  try {
    const [result] = await db.execute(`
      SELECT 
        p.stock as stock_general,
        COALESCE(SUM(lp.cantidad_actual), 0) as stock_por_lotes
      FROM producto p
      LEFT JOIN lote_producto lp ON p.id_producto = lp.id_producto AND lp.activo = 1
      WHERE p.id_producto = ?
      GROUP BY p.id_producto
    `, [id_producto]);

    return result[0] || { stock_general: 0, stock_por_lotes: 0 };
  } catch (error) {
    console.error("Error al obtener stock total:", error);
    throw error;
  }
};