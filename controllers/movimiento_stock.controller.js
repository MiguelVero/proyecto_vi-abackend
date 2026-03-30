// src/controllers/movimiento_stock.controller.js
import db from "../config/db.js";

// src/controllers/movimiento_stock.controller.js
// Obtener todos los movimientos - VERSIÓN CORREGIDA
export const getMovimientos = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        m.id_movimiento,
        m.id_producto,
        m.tipo_movimiento,
        m.cantidad,
        m.fecha,
        m.descripcion,
        m.id_usuario,
        m.id_lote,
        p.nombre as nombre_producto,
        p.stock as stock_actual,  -- ✅ NUEVO: Obtener stock actual del producto
        u.nombre_usuario,
        per.nombre_completo,
        l.numero_lote,
        l.fecha_caducidad
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
      LEFT JOIN persona per ON u.id_persona = per.id_persona
      LEFT JOIN lote_producto l ON m.id_lote = l.id_lote
      ORDER BY m.fecha DESC`);
    
    // Mapear a la estructura que espera el frontend
    const movimientosMapeados = rows.map(mov => ({
      id_movimiento: mov.id_movimiento,
      id_producto: mov.id_producto,
      tipo_movimiento: mov.tipo_movimiento,
      cantidad: mov.cantidad,
      fecha: mov.fecha,
      descripcion: mov.descripcion,
      id_usuario: mov.id_usuario,
      id_lote: mov.id_lote,
      producto: {
        nombre: mov.nombre_producto,
        stock: mov.stock_actual  // ✅ NUEVO: Incluir stock actual
      },
      usuario: {
        id_usuario: mov.id_usuario,
        username: mov.nombre_usuario,
        nombre: mov.nombre_completo
      },
      lote: mov.id_lote ? {  // ✅ CORREGIDO: Siempre incluir lote si existe id_lote
        numero_lote: mov.numero_lote,
        fecha_caducidad: mov.fecha_caducidad
      } : null
    }));
    
    res.json(movimientosMapeados);
  } catch (error) {
    console.error("Error al obtener movimientos:", error);
    res.status(500).json({ message: "Error al obtener movimientos" });
  }
};

// Obtener movimientos por producto - VERSIÓN CORREGIDA
export const getMovimientosByProducto = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        m.id_movimiento,
        m.id_producto,
        m.tipo_movimiento,
        m.cantidad,
        m.fecha,
        m.descripcion,
        m.id_usuario,
        m.id_lote,
        p.nombre as nombre_producto,
        p.stock as stock_actual,  -- ✅ NUEVO: Obtener stock actual
        u.nombre_usuario,
        per.nombre_completo,
        l.numero_lote,
        l.fecha_caducidad
       FROM movimiento_stock m
       LEFT JOIN producto p ON m.id_producto = p.id_producto
       LEFT JOIN usuario u ON m.id_usuario = u.id_usuario
       LEFT JOIN persona per ON u.id_persona = per.id_persona
       LEFT JOIN lote_producto l ON m.id_lote = l.id_lote
       WHERE m.id_producto = ?
       ORDER BY m.fecha DESC`,
      [req.params.id_producto]
    );
    
    // Mapear a la estructura que espera el frontend
    const movimientosMapeados = rows.map(mov => ({
      id_movimiento: mov.id_movimiento,
      id_producto: mov.id_producto,
      tipo_movimiento: mov.tipo_movimiento,
      cantidad: mov.cantidad,
      fecha: mov.fecha,
      descripcion: mov.descripcion,
      id_usuario: mov.id_usuario,
      id_lote: mov.id_lote,
      producto: {
        nombre: mov.nombre_producto,
        stock: mov.stock_actual  // ✅ NUEVO: Incluir stock actual
      },
      usuario: {
        id_usuario: mov.id_usuario,
        username: mov.nombre_usuario,
        nombre: mov.nombre_completo
      },
      lote: mov.id_lote ? {
        numero_lote: mov.numero_lote,
        fecha_caducidad: mov.fecha_caducidad
      } : null
    }));
    
    res.json(movimientosMapeados);
  } catch (error) {
    console.error("Error al obtener movimientos del producto:", error);
    res.status(500).json({ message: "Error al obtener movimientos del producto" });
  }
};

// src/controllers/movimiento_stock.controller.js - MODIFICAR createMovimiento
// En movimiento_stock.controller.js - MODIFICAR createMovimiento
export const createMovimiento = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id_producto, tipo_movimiento, cantidad, descripcion, id_lote } = req.body;
    const id_usuario = req.user.id_usuario;

    console.log('📦 DATOS MOVIMIENTO RECIBIDOS:', { 
      id_producto, tipo_movimiento, cantidad, id_lote, id_usuario 
    });

    // Validaciones básicas
    if (!id_producto || !tipo_movimiento || !cantidad) {
      await connection.rollback();
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const tiposValidos = ['ingreso', 'egreso', 'ajuste', 'devolucion'];
    if (!tiposValidos.includes(tipo_movimiento)) {
      await connection.rollback();
      return res.status(400).json({ message: "Tipo de movimiento no válido" });
    }

    // 🟢 NUEVA VALIDACIÓN: Verificar si es un ingreso con lote NUEVO
    // (cuando el frontend crea un lote automático/manual y luego el movimiento)
    const esIngresoConLoteNuevo = tipo_movimiento === 'ingreso' && id_lote;
    let loteEsNuevo = false;

    if (esIngresoConLoteNuevo) {
      // Verificar si el lote acaba de ser creado (fecha_creación reciente)
      const [loteInfo] = await connection.query(
        'SELECT fecha_creacion, cantidad_inicial, cantidad_actual FROM lote_producto WHERE id_lote = ?',
        [id_lote]
      );
      
      if (loteInfo.length > 0) {
        const lote = loteInfo[0];
        const fechaCreacion = new Date(lote.fecha_creacion);
        const ahora = new Date();
        const diferenciaMinutos = (ahora - fechaCreacion) / (1000 * 60);
        
        // Si el lote fue creado hace menos de 5 minutos, es nuevo
        loteEsNuevo = diferenciaMinutos < 5;
        
        console.log('🕒 Información del lote:', {
          fechaCreacion: lote.fecha_creacion,
          ahora: ahora,
          diferenciaMinutos,
          loteEsNuevo,
          cantidadInicial: lote.cantidad_inicial,
          cantidadActual: lote.cantidad_actual
        });
      }
    }

    // Validar stock para egresos/ajustes (SOLO para lotes existentes)
    if (id_lote && (tipo_movimiento === 'egreso' || tipo_movimiento === 'ajuste')) {
      const [loteRows] = await connection.query(
        'SELECT cantidad_actual FROM lote_producto WHERE id_lote = ? AND activo = 1',
        [id_lote]
      );
      
      if (loteRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ message: "Lote no encontrado" });
      }
      
      if (loteRows[0].cantidad_actual < cantidad) {
        await connection.rollback();
        return res.status(400).json({ 
          message: `Stock insuficiente en el lote. Disponible: ${loteRows[0].cantidad_actual}` 
        });
      }
    }

    // Insertar movimiento
    const [result] = await connection.query(
      `INSERT INTO movimiento_stock 
       (id_producto, tipo_movimiento, cantidad, descripcion, id_usuario, id_lote) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_producto, tipo_movimiento, cantidad, descripcion, id_usuario, id_lote || null]
    );

// Actualizar stock del producto (SOLO AQUÍ DEBE HACERSE)
const stockModificacion = (tipo_movimiento === 'ingreso' || tipo_movimiento === 'devolucion') ? cantidad : -cantidad;
await connection.query(
  `UPDATE producto SET stock = stock + ? WHERE id_producto = ?`,
  [stockModificacion, id_producto]
);

// Actualizar stock del lote (solo si no es un lote nuevo)
if (id_lote && !loteEsNuevo) {
  const loteModificacion = (tipo_movimiento === 'ingreso' || tipo_movimiento === 'devolucion') ? cantidad : -cantidad;
  await connection.query(
    `UPDATE lote_producto SET cantidad_actual = cantidad_actual + ? WHERE id_lote = ?`,
    [loteModificacion, id_lote]
  );
      
      console.log('📊 Actualizando stock del lote existente:', {
        id_lote,
        modificacion: loteModificacion
      });
    } else if (id_lote && loteEsNuevo) {
      console.log('✅ Lote es nuevo, NO se actualiza cantidad_actual (ya se hizo en createLote)');
    }

    await connection.commit();
    
    // Obtener información completa del movimiento creado
    const [movimientoCompleto] = await connection.query(`
      SELECT m.*, p.nombre as nombre_producto, lp.numero_lote
      FROM movimiento_stock m
      LEFT JOIN producto p ON m.id_producto = p.id_producto
      LEFT JOIN lote_producto lp ON m.id_lote = lp.id_lote
      WHERE m.id_movimiento = ?
    `, [result.insertId]);

    res.status(201).json({ 
      movimiento: movimientoCompleto[0],
      message: "Movimiento registrado correctamente" 
    });
  } catch (error) {
    await connection.rollback();
    console.error("❌ ERROR al crear movimiento:", error);
    res.status(500).json({ 
      message: "Error al registrar movimiento",
      error: error.message 
    });
  } finally {
    connection.release();
  }
};
// ... mantener los métodos updateMovimiento y deleteMovimiento existentes

// Actualizar movimiento
export const updateMovimiento = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id_producto, tipo_movimiento, cantidad, descripcion } = req.body;
    const id_movimiento = req.params.id;
    const id_usuario = req.user.id_usuario;

    // Obtener movimiento actual
    const [movimientoRows] = await connection.query(
      "SELECT * FROM movimiento_stock WHERE id_movimiento = ?",
      [id_movimiento]
    );
    
    if (movimientoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Movimiento no encontrado" });
    }

    const movimientoActual = movimientoRows[0];

    // Revertir el movimiento anterior
    const stockModificacionAnterior = (movimientoActual.tipo_movimiento === 'ingreso' || movimientoActual.tipo_movimiento === 'devolucion') 
      ? -movimientoActual.cantidad 
      : movimientoActual.cantidad;

    await connection.query(
      `UPDATE producto SET stock = stock + ? WHERE id_producto = ?`,
      [stockModificacionAnterior, movimientoActual.id_producto]
    );

    // Aplicar el nuevo movimiento
    const stockModificacionNuevo = (tipo_movimiento === 'ingreso' || tipo_movimiento === 'devolucion') 
      ? cantidad 
      : -cantidad;

    await connection.query(
      `UPDATE producto SET stock = stock + ? WHERE id_producto = ?`,
      [stockModificacionNuevo, id_producto]
    );

    // Actualizar el movimiento
    await connection.query(
      `UPDATE movimiento_stock 
       SET id_producto = ?, tipo_movimiento = ?, cantidad = ?, descripcion = ?, id_usuario = ?
       WHERE id_movimiento = ?`,
      [id_producto, tipo_movimiento, cantidad, descripcion, id_usuario, id_movimiento]
    );

    await connection.commit();
    
    res.json({ 
      message: "Movimiento actualizado correctamente" 
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar movimiento:", error);
    res.status(500).json({ message: "Error al actualizar movimiento" });
  } finally {
    connection.release();
  }
};

// Eliminar movimiento
export const deleteMovimiento = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const id_movimiento = req.params.id;

    // Obtener movimiento
    const [movimientoRows] = await connection.query(
      "SELECT * FROM movimiento_stock WHERE id_movimiento = ?",
      [id_movimiento]
    );
    
    if (movimientoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Movimiento no encontrado" });
    }

    const movimiento = movimientoRows[0];

    // Revertir el efecto en el stock
    const stockModificacion = (movimiento.tipo_movimiento === 'ingreso' || movimiento.tipo_movimiento === 'devolucion') 
      ? -movimiento.cantidad 
      : movimiento.cantidad;

    await connection.query(
      `UPDATE producto SET stock = stock + ? WHERE id_producto = ?`,
      [stockModificacion, movimiento.id_producto]
    );

    // Eliminar el movimiento
    await connection.query(
      "DELETE FROM movimiento_stock WHERE id_movimiento = ?",
      [id_movimiento]
    );

    await connection.commit();
    
    res.json({ 
      message: "Movimiento eliminado correctamente" 
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error al eliminar movimiento:", error);
    res.status(500).json({ message: "Error al eliminar movimiento" });
  } finally {
    connection.release();
  }
};
// En movimiento_stock.controller.js - AGREGAR MÉTODO DE VERIFICACIÓN
export const verificarSincronizacionStock = async (req, res) => {
  try {
    const [productos] = await db.query(`
      SELECT 
        p.id_producto,
        p.nombre,
        p.stock as stock_tabla_producto,
        COALESCE(SUM(lp.cantidad_actual), 0) as stock_desde_lotes_activos,
        COUNT(lp.id_lote) as lotes_activos,
        CASE 
          WHEN p.stock = COALESCE(SUM(lp.cantidad_actual), 0) THEN 'SINCRONIZADO'
          ELSE 'INCONSISTENTE'
        END as estado
      FROM producto p
      LEFT JOIN lote_producto lp ON p.id_producto = lp.id_producto AND lp.activo = 1
      GROUP BY p.id_producto
      HAVING estado = 'INCONSISTENTE'
    `);

    const [productosInconsistentes] = productos;
    
    if (productosInconsistentes?.length > 0) {
      console.warn('⚠️ PRODUCTOS CON STOCK INCONSISTENTE DETECTADOS:');
      productosInconsistentes.forEach(p => {
        console.warn(`   - ${p.nombre}: Producto.stock=${p.stock_tabla_producto}, Lotes activos=${p.stock_desde_lotes_activos}`);
      });
    }

    res.json({
      productos_inconsistentes: productosInconsistentes || [],
      total_inconsistentes: productosInconsistentes?.length || 0,
      mensaje: productosInconsistentes?.length > 0 
        ? 'Se detectaron inconsistencias de stock' 
        : 'Stock sincronizado correctamente'
    });
    
  } catch (error) {
    console.error('Error verificando sincronización:', error);
    res.status(500).json({ error: error.message });
  }
};
export const verificarLotesProducto = async (req, res) => {
  try {
    const { id_producto } = req.params;
    
    const [result] = await db.query(`
      SELECT 
        COUNT(*) as lotes_activos,
        COALESCE(SUM(cantidad_actual), 0) as stock_real,
        GROUP_CONCAT(
          CONCAT(numero_lote, ' (', cantidad_actual, ')') 
          SEPARATOR ', '
        ) as lotes_detalle
      FROM lote_producto 
      WHERE id_producto = ? AND activo = 1 AND cantidad_actual > 0
    `, [id_producto]);
    
    const [producto] = await db.query(`
      SELECT nombre, stock 
      FROM producto 
      WHERE id_producto = ?
    `, [id_producto]);
    
    res.json({
      id_producto: parseInt(id_producto),
      nombre_producto: producto[0]?.nombre || 'Desconocido',
      stock_tabla_producto: producto[0]?.stock || 0,
      stock_real: Number(result[0]?.stock_real) || 0,
      lotes_activos: Number(result[0]?.lotes_activos) || 0,
      lotes_detalle: result[0]?.lotes_detalle || 'Ninguno',
      sincronizado: (producto[0]?.stock || 0) === (Number(result[0]?.stock_real) || 0)
    });
    
  } catch (error) {
    console.error('Error verificando lotes del producto:', error);
    res.status(500).json({ error: error.message });
  }
};
export const obtenerStockRealProducto = async (req, res) => {
  try {
    const { id_producto } = req.params;
    
    const [result] = await db.query(`
      SELECT COALESCE(SUM(cantidad_actual), 0) as stock_real
      FROM lote_producto 
      WHERE id_producto = ? AND activo = 1 AND cantidad_actual > 0
    `, [id_producto]);
    
    const stockReal = Number(result[0]?.stock_real) || 0;
    
    res.json({
      id_producto: parseInt(id_producto),
      stock_real: stockReal
    });
    
  } catch (error) {
    console.error('Error obteniendo stock real:', error);
    res.status(500).json({ error: error.message });
  }
};
export const corregirStockProducto = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id_producto } = req.params;
    
    // Obtener nombre del producto
    const [producto] = await connection.query(
      'SELECT nombre FROM producto WHERE id_producto = ?',
      [id_producto]
    );
    
    // Calcular stock real desde lotes activos
    const [lotesActivos] = await connection.query(`
      SELECT COALESCE(SUM(cantidad_actual), 0) as stock_real
      FROM lote_producto 
      WHERE id_producto = ? AND activo = 1
    `, [id_producto]);
    
    const stockReal = Number(lotesActivos[0]?.stock_real) || 0;
    
    // Actualizar stock del producto
    await connection.query(
      'UPDATE producto SET stock = ? WHERE id_producto = ?',
      [stockReal, id_producto]
    );
    
    // Registrar el ajuste en movimientos
    const id_usuario = req.user.id_usuario;
    await connection.query(`
      INSERT INTO movimiento_stock 
      (id_producto, tipo_movimiento, cantidad, descripcion, id_usuario)
      VALUES (?, 'ajuste', ?, 'Corrección automática de stock - Sincronización con lotes', ?)
    `, [id_producto, stockReal, id_usuario]);
    
    await connection.commit();
    
    res.json({
      success: true,
      message: `Stock del producto "${producto[0]?.nombre}" corregido a ${stockReal} unidades`,
      id_producto: parseInt(id_producto),
      stock_corregido: stockReal
    });
    
  } catch (error) {
    await connection.rollback();
    console.error('Error corrigiendo stock:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
};