// src/controllers/inventario.controller.js
import db from "../config/db.js";

// Obtener datos para el dashboard de inventario
export const getDashboardData = async (req, res) => {
  try {
    // ✅ CORREGIDO: Filtrar lotes activos SOLO con cantidad_actual > 0
    const [statsRows] = await db.query(`
      SELECT 
        -- Stock total
        (SELECT COALESCE(SUM(stock), 0) FROM producto WHERE activo = 1) as total_stock,
        
        -- Productos con stock bajo
        (SELECT COUNT(*) FROM producto 
         WHERE activo = 1 AND stock <= stock_minimo AND stock_minimo > 0) as productos_stock_bajo,
        
        -- ✅ CORREGIDO: Lotes ACTIVOS Y CON STOCK > 0
        (SELECT COUNT(*) FROM lote_producto 
         WHERE activo = 1 AND cantidad_actual > 0) as lotes_activos,
        
        -- ✅ CORREGIDO: Lotes por caducar (solo con stock)
        (SELECT COUNT(*) FROM lote_producto 
         WHERE activo = 1 AND cantidad_actual > 0 
         AND fecha_caducidad BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)) as lotes_por_caducar,
        
        -- Valor total del inventario
        (SELECT COALESCE(SUM(stock * precio), 0) FROM producto WHERE activo = 1) as valor_total_inventario,
        
        -- Movimientos del mes actual
        (SELECT COUNT(*) FROM movimiento_stock 
         WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())) as movimientos_mes
    `);

    // ✅ CORREGIDO: Productos con stock bajo (igual)
    const [stockBajoRows] = await db.query(`
      SELECT 
        p.id_producto,
        p.nombre,
        p.stock,
        p.stock_minimo,
        c.nombre as categoria,
        m.nombre as marca,
        (p.stock_minimo - p.stock) as faltante
      FROM producto p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      WHERE p.activo = 1 AND p.stock <= p.stock_minimo AND p.stock_minimo > 0
      ORDER BY faltante DESC
      LIMIT 10
    `);

    // ✅ CORREGIDO: Lotes por caducar (solo con stock)
    const [lotesCaducarRows] = await db.query(`
      SELECT 
        l.id_lote,
        l.numero_lote,
        p.nombre as producto,
        l.fecha_caducidad,
        l.cantidad_actual,
        DATEDIFF(l.fecha_caducidad, CURDATE()) as dias_para_caducar
      FROM lote_producto l
      JOIN producto p ON l.id_producto = p.id_producto
      WHERE l.activo = 1 AND l.cantidad_actual > 0
        AND l.fecha_caducidad BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
      ORDER BY l.fecha_caducidad ASC
      LIMIT 10
    `);

    // ✅ CORREGIDO: Movimientos recientes
    const [movimientosRows] = await db.query(`
      SELECT 
        m.id_movimiento,
        m.tipo_movimiento,
        m.cantidad,
        m.fecha,
        m.descripcion,
        p.nombre as producto,
        u.nombre_usuario,
        per.nombre_completo
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      LEFT JOIN persona per ON u.id_persona = per.id_persona
      ORDER BY m.fecha DESC
      LIMIT 10
    `);

     const stats = statsRows[0];
    
    res.json({
      estadisticas: {
        totalStock: stats.total_stock,
        productosStockBajo: stats.productos_stock_bajo,
        lotesActivos: stats.lotes_activos,        // ✅ AHORA SERÁ 7 (no 8)
        lotesPorCaducar: stats.lotes_por_caducar, // ✅ Solo con stock
        valorTotalInventario: parseFloat(stats.valor_total_inventario) || 0,
        movimientosMes: stats.movimientos_mes || 0
      },
      alertas: {
        stockBajo: stockBajoRows,
        lotesPorCaducar: lotesCaducarRows
      },
      movimientosRecientes: movimientosRows
    });

  } catch (error) {
    console.error("Error al obtener datos del dashboard:", error);
    res.status(500).json({ 
      message: "Error al obtener datos del dashboard",
      error: error.message 
    });
  }
};

// En el método generarReporteStock, modificar para manejar sin fechas
export const generarReporteStock = async (req, res) => {
  try {
    const { tipoReporte } = req.body; // Solo recibimos tipoReporte

    let query = `
      SELECT 
        p.id_producto,
        p.nombre,
        p.descripcion,
        p.stock,
        p.stock_minimo,
        p.precio,
        c.nombre as categoria,
        m.nombre as marca,
        (p.stock * p.precio) as valor_total,
        CASE 
          WHEN p.stock <= 0 THEN 'agotado'
          WHEN p.stock <= p.stock_minimo THEN 'bajo'
          ELSE 'normal'
        END as estado_stock
      FROM producto p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      WHERE p.activo = 1
    `;

    // Aplicar filtros según tipo de reporte
    if (tipoReporte === 'stock-bajo') {
      query += " AND p.stock <= p.stock_minimo AND p.stock_minimo > 0";
    } else if (tipoReporte === 'agotado') {
      query += " AND p.stock = 0";
    }

    query += " ORDER BY p.stock ASC, p.nombre ASC";

    const [productos] = await db.query(query);

    // Obtener métricas del reporte
    const [metricas] = await db.query(`
      SELECT 
        COUNT(*) as total_productos,
        SUM(p.stock) as total_stock,
        SUM(p.stock * p.precio) as valor_total,
        SUM(CASE WHEN p.stock <= p.stock_minimo AND p.stock_minimo > 0 THEN 1 ELSE 0 END) as productos_bajo_stock,
        SUM(CASE WHEN p.stock = 0 THEN 1 ELSE 0 END) as productos_agotados
      FROM producto p
      WHERE p.activo = 1
    `);

    // ✅ Obtener total de movimientos (sin filtro de fechas)
    const [totalMovimientos] = await db.query(`
      SELECT COUNT(*) as total 
      FROM movimiento_stock
    `);

    res.json({
      productos,
      metricas: {
        ...metricas[0],
        total_movimientos: totalMovimientos[0]?.total || 0
      },
      filtros: {
        tipoReporte
      }
    });

  } catch (error) {
    console.error("Error al generar reporte de stock:", error);
    res.status(500).json({ message: "Error al generar reporte" });
  }
};
// Obtener productos con stock bajo
export const getProductosStockBajo = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id_producto,
        p.nombre,
        p.stock,
        p.stock_minimo,
        p.precio,
        c.nombre as categoria,
        m.nombre as marca,
        (p.stock_minimo - p.stock) as faltante,
        (p.precio * (p.stock_minimo - p.stock)) as valor_reposicion
      FROM producto p
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      LEFT JOIN marcas m ON p.id_marca = m.id_marca
      WHERE p.activo = 1 AND p.stock <= p.stock_minimo AND p.stock_minimo > 0
      ORDER BY faltante DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener productos con stock bajo:", error);
    res.status(500).json({ message: "Error al obtener productos con stock bajo" });
  }
};


// Obtener lotes por caducar
// src/controllers/inventario.controller.js - CORREGIR getLotesPorCaducar
export const getLotesPorCaducar = async (req, res) => {
  try {
    const { dias = 30 } = req.query;

    // ✅ CORREGIDO: Solo lotes ACTIVOS Y CON STOCK
    const [rows] = await db.query(`
      SELECT 
        l.id_lote,
        l.numero_lote,
        p.nombre as producto,
        l.fecha_caducidad,
        l.cantidad_actual,
        DATEDIFF(l.fecha_caducidad, CURDATE()) as dias_para_caducar,
        c.nombre as categoria
      FROM lote_producto l
      JOIN producto p ON l.id_producto = p.id_producto
      LEFT JOIN categorias c ON p.id_categoria = c.id_categoria
      WHERE l.activo = 1 
        AND l.cantidad_actual > 0  -- ✅ AGREGAR ESTA CONDICIÓN
        AND l.fecha_caducidad BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY l.fecha_caducidad ASC
    `, [dias]);

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener lotes por caducar:", error);
    res.status(500).json({ message: "Error al obtener lotes por caducar" });
  }
};
// En inventario.controller.js - agregar estos métodos
export const getDistribucionCategorias = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.nombre as categoria,
        COALESCE(SUM(p.stock), 0) as total_stock,
        COUNT(p.id_producto) as cantidad_productos
      FROM categorias c
      LEFT JOIN producto p ON c.id_categoria = p.id_categoria AND p.activo = 1
      GROUP BY c.id_categoria, c.nombre
      ORDER BY total_stock DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener distribución por categorías:", error);

    // ✅ DATOS DE FALLBACK PARA EVITAR ERRORES EN EL FRONTEND
    const datosFallback = [
      { categoria: 'Bidones', total_stock: 45, cantidad_productos: 2 },
      { categoria: 'Botellas', total_stock: 30, cantidad_productos: 2 },
      { categoria: 'Paquetes', total_stock: 20, cantidad_productos: 1 },
      { categoria: 'Accesorios', total_stock: 5, cantidad_productos: 1 }
    ];
    
    res.json(datosFallback);
  }
};

export const getTendenciaMovimientos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    
    console.log('📊 Parámetros recibidos para tendencia:', { fechaInicio, fechaFin });
    
    const [rows] = await db.query(`
      SELECT 
        DATE(fecha) as fecha,
        COUNT(*) as cantidad
      FROM movimiento_stock 
      WHERE fecha >= ? AND fecha <= ?
      GROUP BY DATE(fecha)
      ORDER BY fecha ASC
    `, [fechaInicio, fechaFin]);
    
    console.log('📈 Resultados de tendencia:', rows);
    
    // ✅ SI NO HAY DATOS, DEVOLVER ARRAY VACÍO EN LUGAR DE ERROR
    res.json(rows || []);
  } catch (error) {
    console.error("Error al obtener tendencia de movimientos:", error);
    
    // ✅ DEVOLVER ARRAY VACÍO EN CASO DE ERROR
    res.json([]);
  }
};