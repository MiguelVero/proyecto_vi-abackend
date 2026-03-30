// src/routes/entrega-dinero.routes.js
import express from 'express';
import db from '../config/db.js';

const router = express.Router();

// Middleware de autenticación
import { verifyToken, requireRole } from '../middleware/auth.js';

// Agregar JUSTO después de const router = express.Router();
// y ANTES de router.use(verifyToken);

/**
 * @route   GET /api/entregas-dinero/debug-noauth
 * @desc    Endpoint de diagnóstico sin autenticación (TEMPORAL)
 * @access  Public
 */
router.get('/debug-noauth', async (req, res) => {
  try {
    // Parámetro para probar diferentes repartidores
    const repartidorId = req.query.repartidor_id || 1;
    
    console.log(`🔍 Debug para repartidor ID: ${repartidorId}`);
    
    // 1. Ventas pagadas del repartidor
    const [ventasPagadas] = await db.execute(`
      SELECT 
        id_venta, total, fecha, fecha_fin_ruta,
        DATE_FORMAT(fecha, '%d/%m/%Y') as fecha_formateada,
        DATE_FORMAT(fecha_fin_ruta, '%d/%m/%Y') as fecha_fin_formateada,
        id_repartidor
      FROM venta 
      WHERE id_repartidor = ? 
        AND id_estado_venta = 7
      ORDER BY fecha_fin_ruta ASC, fecha ASC
    `, [repartidorId]);

    // 2. Entregas ya registradas
    const [entregasRegistradas] = await db.execute(`
      SELECT edr.id_entrega, edr.total, edr.fecha_entrega,
             GROUP_CONCAT(edv.id_venta) as ventas_asociadas
      FROM entrega_dinero_repartidor edr
      LEFT JOIN entrega_dinero_ventas edv ON edr.id_entrega = edv.id_entrega
      WHERE edr.id_repartidor = ? 
        AND edr.estado = 'completado'
      GROUP BY edr.id_entrega
      ORDER BY edr.fecha_entrega DESC
    `, [repartidorId]);

    // 3. Ventas ya asociadas a entregas
    const [ventasConEntrega] = await db.execute(`
      SELECT DISTINCT v.id_venta, v.total, v.fecha, v.fecha_fin_ruta
      FROM venta v
      JOIN entrega_dinero_ventas edv ON v.id_venta = edv.id_venta
      JOIN entrega_dinero_repartidor edr ON edv.id_entrega = edr.id_entrega
      WHERE v.id_repartidor = ?
        AND edr.estado = 'completado'
    `, [repartidorId]);

    // 4. Info del repartidor
    const [repartidorInfo] = await db.execute(`
      SELECT r.id_repartidor, p.nombre_completo
      FROM repartidor r
      JOIN persona p ON r.id_persona = p.id_persona
      WHERE r.id_repartidor = ?
    `, [repartidorId]);

    res.json({
      success: true,
      data: {
        repartidor: repartidorInfo[0],
        ventas_pagadas: ventasPagadas,
        entregas_registradas: entregasRegistradas,
        ventas_con_entrega: ventasConEntrega,
        resumen: {
          total_ventas_pagadas: ventasPagadas.length,
          total_entregas_registradas: entregasRegistradas.length,
          ventas_con_entrega: ventasConEntrega.length,
          ventas_sin_entrega: ventasPagadas.length - ventasConEntrega.length
        }
      }
    });

  } catch (error) {
    console.error('Error en debug:', error);
    res.status(500).json({ error: error.message });
  }
});

// Todas las rutas requieren autenticación
router.use(verifyToken);

/**
 * @route   POST /api/entregas-dinero/registrar
 * @desc    Registrar entrega de dinero del repartidor al administrador
 * @access  Private (Repartidor)
 */
router.post('/registrar', requireRole([3], 'historial_entregas'), async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    
    const { total, metodo_entrega } = req.body; // ❌ REMOVER fecha_entrega del body
    
    // Validaciones
    if (!total || total <= 0) {
      return res.status(400).json({ 
        error: 'El monto total debe ser mayor a 0' 
      });
    }

    if (!metodo_entrega || !['efectivo', 'transferencia', 'yape'].includes(metodo_entrega)) {
      return res.status(400).json({ 
        error: 'Método de entrega no válido. Use: efectivo, transferencia o yape' 
      });
    }

    // Obtener id_repartidor del usuario autenticado
    const [repartidores] = await connection.execute(`
      SELECT r.id_repartidor, p.nombre_completo
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      JOIN persona p ON r.id_persona = p.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidor = repartidores[0];
    const repartidorId = repartidor.id_repartidor;
    const repartidorNombre = repartidor.nombre_completo;

    console.log(`💰 Registrando entrega de dinero para repartidor ${repartidorNombre} (ID: ${repartidorId})`);

    // ✅ CORRECCIÓN: Usar NOW() de MySQL en lugar de fecha del frontend
    const [result] = await connection.execute(`
      INSERT INTO entrega_dinero_repartidor 
        (id_repartidor, total, metodo_entrega, fecha_entrega, estado, notas, id_usuario_registro)
      VALUES (?, ?, ?, NOW(), 'completado', ?, ?)
    `, [
      repartidorId, 
      total, 
      metodo_entrega,
      `Entrega registrada por ${repartidorNombre}. Método: ${metodo_entrega}`,
      req.user.id_usuario
    ]);

    // Asociar ventas pagadas sin entrega con esta entrega
    // REEMPLAZA la consulta actual con esta:
// REEMPLAZAR la sección de asociación de ventas con esta versión mejorada:
const [ventasSinEntrega] = await connection.execute(`
  SELECT 
    v.id_venta,
    v.total,
    v.fecha,
    v.fecha_fin_ruta,
    DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_formateada,
    -- Verificar explícitamente si ya tiene entrega usando la tabla de asociaciones
    NOT EXISTS (
      SELECT 1 
      FROM entrega_dinero_ventas edv2
      WHERE edv2.id_venta = v.id_venta
    ) as no_tiene_entrega
  FROM venta v
  WHERE v.id_repartidor = ?
    AND v.id_estado_venta = 7 -- Pagado
    AND NOT EXISTS (
      SELECT 1 
      FROM entrega_dinero_ventas edv2
      WHERE edv2.id_venta = v.id_venta
    )
  ORDER BY v.fecha ASC, v.fecha_fin_ruta ASC
`, [repartidorId]);

console.log(`📋 Ventas sin entrega encontradas: ${ventasSinEntrega.length}`);
console.log('🔍 DEBUG - IDs de ventas sin entrega:', ventasSinEntrega.map(v => v.id_venta));

let totalAsociado = 0;
const ventasAsociadas = [];

// Asociar mientras haya ventas y no hayamos alcanzado el monto
for (const venta of ventasSinEntrega) {
  // Verificar nuevamente que no tenga entrega (doble seguridad)
  const [yaTieneEntrega] = await connection.execute(
    `SELECT 1 FROM entrega_dinero_ventas WHERE id_venta = ? LIMIT 1`,
    [venta.id_venta]
  );
  
  if (yaTieneEntrega.length > 0) {
    console.log(`⏭️ Venta ${venta.id_venta} ya tiene entrega, omitiendo`);
    continue;
  }
  
  // Permitir una pequeña diferencia (1 sol) para evitar dejar ventas sin asociar
  if (totalAsociado < total + 1) {
    await connection.execute(`
      INSERT INTO entrega_dinero_ventas (id_entrega, id_venta, monto_asignado, fecha_asociacion)
      VALUES (?, ?, ?, NOW())
    `, [result.insertId, venta.id_venta, venta.total]);
    
    totalAsociado += parseFloat(venta.total);
    ventasAsociadas.push(venta.id_venta);
    
    console.log(`  ✅ Asociada venta ${venta.id_venta}: S/ ${venta.total}`);
  } else {
    console.log(`  ⚠️ Omitida venta ${venta.id_venta} (monto total excedido)`);
  }
}

// Si hay diferencia, registrar advertencia
const diferencia = totalAsociado - total;
if (Math.abs(diferencia) > 0.01) {
  console.warn(`⚠️ Diferencia detectada: Entregado S/ ${total}, Asociado S/ ${totalAsociado}, Diferencia: S/ ${diferencia.toFixed(2)}`);
}
    // Obtener el registro creado con formato correcto
    const [entregaCreada] = await connection.execute(`
      SELECT 
        id_entrega,
        total,
        metodo_entrega,
        fecha_entrega,  -- ✅ Usar campo directo sin formato
        estado,
        notas,
        fecha_registro
      FROM entrega_dinero_repartidor
      WHERE id_entrega = ?
    `, [result.insertId]);

    // Registrar en bitácora del sistema
    await connection.execute(`
      INSERT INTO sistema_bitacora 
        (modulo, accion, descripcion, id_usuario, id_referencia)
      VALUES ('entregas_dinero', 'registro', ?, ?, ?)
    `, [
      `Repartidor ${repartidorNombre} entregó S/ ${total} (${metodo_entrega})`,
      req.user.id_usuario,
      result.insertId
    ]);

    // ✅ Formatear fechas para respuesta
    const entrega = entregaCreada[0];
    const fechaEntrega = new Date(entrega.fecha_entrega);
    const fechaRegistro = new Date(entrega.fecha_registro);

    res.json({
      success: true,
      message: '✅ Entrega de dinero registrada exitosamente',
      data: {
        id_entrega: result.insertId,
        total: total,
        metodo_entrega: metodo_entrega,
        fecha_entrega: fechaEntrega.toISOString(),
        fecha_entrega_local: fechaEntrega.toLocaleString('es-PE', {
          timeZone: 'America/Lima',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        estado: 'completado',
        repartidor: {
          id: repartidorId,
          nombre: repartidorNombre
        }
      }
    });

  } catch (error) {
    console.error('❌ Error registrando entrega de dinero:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al registrar la entrega',
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});

/**
 * @route   GET /api/entregas-dinero/historial
 * @desc    Obtener historial de entregas de dinero del repartidor
 * @access  Private (Repartidor)
 */
router.get('/historial', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Obtener historial (últimas 50 entregas)
   // En el método GET /historial, cambiar la consulta:
// En el método GET /historial
const [entregas] = await db.execute(`
  SELECT 
    id_entrega,
    total,
    metodo_entrega,
    DATE_FORMAT(fecha_entrega, '%Y-%m-%d') as fecha,
    DATE_FORMAT(fecha_entrega, '%H:%i:%s') as hora, -- Formato 24h
    estado,
    notas,
    DATE_FORMAT(fecha_registro, '%Y-%m-%d %H:%i:%s') as fecha_registro
  FROM entrega_dinero_repartidor
  WHERE id_repartidor = ?
  ORDER BY fecha_entrega DESC
  LIMIT 50
`, [repartidorId]);

    // Calcular estadísticas
    const [estadisticas] = await db.execute(`
      SELECT 
        COUNT(*) as total_entregas,
        SUM(total) as monto_total,
        MIN(fecha_entrega) as primera_entrega,
        MAX(fecha_entrega) as ultima_entrega
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
    `, [repartidorId]);

    res.json({
      success: true,
      data: {
        entregas: entregas,
        estadisticas: estadisticas[0],
        total_registros: entregas.length
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial de entregas de dinero:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el historial'
    });
  }
});

/**
 * @route   GET /api/entregas-dinero/total-entregado
 * @desc    Obtener total entregado al administrador (hoy)
 * @access  Private (Repartidor)
 */
router.get('/total-entregado', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Obtener total entregado HOY
    const [result] = await db.execute(`
      SELECT 
        COALESCE(SUM(total), 0) as total_entregado,
        COUNT(*) as cantidad_entregas,
        GROUP_CONCAT(DISTINCT metodo_entrega) as metodos_utilizados
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ? 
        AND estado = 'completado'
        AND DATE(fecha_entrega) = CURDATE()
    `, [repartidorId]);

    // Obtener total entregado en la semana
    const [semanal] = await db.execute(`
      SELECT 
        COALESCE(SUM(total), 0) as total_semana,
        COUNT(*) as entregas_semana
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ? 
        AND estado = 'completado'
        AND YEARWEEK(fecha_entrega, 1) = YEARWEEK(CURDATE(), 1)
    `, [repartidorId]);

    // Obtener total entregado en el mes
    const [mensual] = await db.execute(`
      SELECT 
        COALESCE(SUM(total), 0) as total_mes,
        COUNT(*) as entregas_mes
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ? 
        AND estado = 'completado'
        AND YEAR(fecha_entrega) = YEAR(CURDATE())
        AND MONTH(fecha_entrega) = MONTH(CURDATE())
    `, [repartidorId]);

    res.json({
      success: true,
      data: {
        hoy: {
          total: parseFloat(result[0].total_entregado),
          entregas: result[0].cantidad_entregas,
          metodos: result[0].metodos_utilizados?.split(',') || []
        },
        semana: {
          total: parseFloat(semanal[0].total_semana),
          entregas: semanal[0].entregas_semana
        },
        mes: {
          total: parseFloat(mensual[0].total_mes),
          entregas: mensual[0].entregas_mes
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo total entregado:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el total entregado'
    });
  }
});

/**
 * @route   GET /api/entregas-dinero/pendiente
 * @desc    Obtener dinero pendiente de entrega (ventas pagadas hoy)
 * @access  Private (Repartidor)
 */
router.get('/pendiente', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Obtener ventas pagadas hoy que aún no tienen entrega de dinero registrada
    const [pendiente] = await db.execute(`
      SELECT 
        COALESCE(SUM(v.total), 0) as total_pendiente,
        COUNT(*) as ventas_pendientes
      FROM venta v
      WHERE v.id_repartidor = ?
        AND v.id_estado_venta = 7 -- Pagado
        AND DATE(v.fecha_fin_ruta) = CURDATE()
        AND v.id_venta NOT IN (
          SELECT edr.id_venta 
          FROM entrega_dinero_ventas edr 
          WHERE edr.id_repartidor = ?
            AND DATE(edr.fecha_asociacion) = CURDATE()
        )
    `, [repartidorId, repartidorId]);

    res.json({
      success: true,
      data: {
        pendiente: parseFloat(pendiente[0].total_pendiente),
        ventas_pendientes: pendiente[0].ventas_pendientes
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo dinero pendiente:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el dinero pendiente'
    });
  }
});

/**
 * @route   GET /api/entregas-dinero/resumen
 * @desc    Obtener resumen de entregas por rango de fechas
 * @access  Private (Repartidor)
 */
router.get('/resumen', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ 
        error: 'Las fechas de inicio y fin son requeridas' 
      });
    }

    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Obtener resumen por día
    const [resumen] = await db.execute(`
      SELECT 
        DATE(fecha_entrega) as fecha,
        COUNT(*) as cantidad_entregas,
        SUM(total) as total_dia,
        GROUP_CONCAT(DISTINCT metodo_entrega) as metodos
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
        AND estado = 'completado'
        AND DATE(fecha_entrega) BETWEEN ? AND ?
      GROUP BY DATE(fecha_entrega)
      ORDER BY fecha DESC
    `, [repartidorId, fecha_inicio, fecha_fin]);

    // Calcular totales
    const totalGeneral = resumen.reduce((sum, dia) => sum + parseFloat(dia.total_dia), 0);
    const entregasTotales = resumen.reduce((sum, dia) => sum + dia.cantidad_entregas, 0);

    res.json({
      success: true,
      data: {
        resumen: resumen,
        estadisticas: {
          total_general: totalGeneral,
          entregas_totales: entregasTotales,
          promedio_diario: totalGeneral / (resumen.length || 1),
          dias_con_entregas: resumen.length
        },
        periodo: {
          fecha_inicio: fecha_inicio,
          fecha_fin: fecha_fin,
          dias: Math.ceil((new Date(fecha_fin) - new Date(fecha_inicio)) / (1000 * 60 * 60 * 24)) + 1
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo resumen:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el resumen'
    });
  }
});
/**
 * @route   GET /api/entregas-dinero/dinero-realmente-pendiente
 * @desc    Obtener dinero realmente pendiente (ventas pagadas - entregas registradas)
 * @access  Private (Repartidor)
 */
router.get('/dinero-realmente-pendiente', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // 1. Obtener total de ventas pagadas SIN entregas registradas
    const [ventasPendientes] = await db.execute(`
      SELECT 
        COALESCE(SUM(v.total), 0) as total_pendiente,
        COUNT(*) as ventas_pendientes
      FROM venta v
      WHERE v.id_repartidor = ?
        AND v.id_estado_venta = 7 -- Pagado
        AND v.id_venta NOT IN (
          -- Ventas que ya tienen entrega de dinero registrada
          SELECT DISTINCT edv.id_venta
          FROM entrega_dinero_ventas edv
          JOIN entrega_dinero_repartidor edr ON edv.id_entrega = edr.id_entrega
          WHERE edr.id_repartidor = ?
            AND edr.estado = 'completado'
        )
    `, [repartidorId, repartidorId]);

    res.json({
      success: true,
      data: {
        pendiente: parseFloat(ventasPendientes[0].total_pendiente),
        ventas_pendientes: ventasPendientes[0].ventas_pendientes
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo dinero realmente pendiente:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el dinero pendiente'
    });
  }
});
// En entrega-dinero.routes.js - AGREGAR ESTAS RUTAS
/**
 * @route   GET /api/entregas-dinero/entregas-hoy
 * @desc    Obtener entregas del día actual
 * @access  Private (Repartidor)
 */
router.get('/entregas-hoy', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Obtener entregas de hoy
    const [entregas] = await db.execute(`
      SELECT 
        id_entrega,
        total,
        metodo_entrega,
        fecha_entrega,
        estado,
        notas
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
        AND DATE(fecha_entrega) = CURDATE()
        AND estado = 'completado'
      ORDER BY fecha_entrega DESC
    `, [repartidorId]);

    // Calcular total del día
    const [totales] = await db.execute(`
      SELECT 
        COALESCE(SUM(total), 0) as total_entregado,
        COUNT(*) as cantidad_entregas
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
        AND DATE(fecha_entrega) = CURDATE()
        AND estado = 'completado'
    `, [repartidorId]);

    res.json({
      success: true,
      data: {
        total_entregado: parseFloat(totales[0].total_entregado),
        cantidad_entregas: totales[0].cantidad_entregas,
        entregas: entregas
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo entregas de hoy:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener las entregas de hoy'
    });
  }
});

/**
 * @route   GET /api/entregas-dinero/por-fecha
 * @desc    Obtener entregas por fecha específica
 * @access  Private (Repartidor)
 */
router.get('/por-fecha', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    const { fecha } = req.query;
    
    if (!fecha) {
      return res.status(400).json({ 
        error: 'La fecha es requerida' 
      });
    }

    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Obtener entregas por fecha
    const [entregas] = await db.execute(`
      SELECT 
        id_entrega,
        total,
        metodo_entrega,
        fecha_entrega,
        estado,
        notas
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
        AND DATE(fecha_entrega) = ?
        AND estado = 'completado'
      ORDER BY fecha_entrega DESC
    `, [repartidorId, fecha]);

    res.json({
      success: true,
      data: entregas
    });

  } catch (error) {
    console.error('❌ Error obteniendo entregas por fecha:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener las entregas por fecha'
    });
  }
});
/**
 * @route   GET /api/entregas-dinero/pendiente-hoy
 * @desc    Obtener dinero pendiente de entrega específico de HOY
 * @access  Private (Repartidor)
 */
router.get('/pendiente-hoy', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor 
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidorId = repartidores[0].id_repartidor;

    // Ventas pagadas HOY
    const [ventasHoy] = await db.execute(`
      SELECT 
        COALESCE(SUM(v.total), 0) as total_ventas_hoy,
        COUNT(*) as ventas_hoy
      FROM venta v
      WHERE v.id_repartidor = ?
        AND v.id_estado_venta = 7 -- Pagado
        AND DATE(v.fecha_fin_ruta) = CURDATE()
    `, [repartidorId]);

    // Entregas registradas HOY
    const [entregasHoy] = await db.execute(`
      SELECT 
        COALESCE(SUM(total), 0) as total_entregado_hoy,
        COUNT(*) as entregas_hoy
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
        AND estado = 'completado'
        AND DATE(fecha_entrega) = CURDATE()
    `, [repartidorId]);

    const totalVentas = parseFloat(ventasHoy[0].total_ventas_hoy);
    const totalEntregado = parseFloat(entregasHoy[0].total_entregado_hoy);
    const pendiente = Math.max(0, totalVentas - totalEntregado);

    res.json({
      success: true,
      data: {
        pendiente: pendiente,
        ventas_pendientes: ventasHoy[0].ventas_hoy,
        total_ventas_hoy: totalVentas,
        total_entregado_hoy: totalEntregado
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo dinero pendiente hoy:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el dinero pendiente hoy'
    });
  }
});
export default router;
// AGREGAR ESTOS ENDPOINTS NUEVOS

/**
 * @route   GET /api/entregas-dinero/dinero-pendiente-total
 * @desc    Obtener TODO el dinero pendiente (de todos los días)
 * @access  Private (Repartidor)
 */
router.get('/dinero-pendiente-total', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor, p.nombre_completo
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      JOIN persona p ON r.id_persona = p.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidor = repartidores[0];
    console.log(`🔍 Buscando dinero pendiente para: ${repartidor.nombre_completo} (ID: ${repartidor.id_repartidor})`);

    // ✅ CONSULTA CORREGIDA: Verificar venta por venta
   // ✅ CORRECCIÓN: Excluir ventas de HOY del dinero pendiente total
   // REEMPLAZAR la consulta actual por esta versión corregida:
// En entrega-dinero.routes.js - MODIFICAR la consulta del endpoint /dinero-pendiente-total
const [ventasPendientes] = await db.execute(`
  SELECT 
    v.id_venta,
    v.total,
    v.fecha as fecha_venta,
    DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_formateada,
    v.fecha as fecha_original,
    v.notas,
    c.razon_social,
    p_cliente.nombre_completo as cliente,
    v.fecha_fin_ruta,
    v.id_estado_venta,
    -- Verificar si esta venta específica ya tiene entrega registrada
    IFNULL((
      SELECT 1 
      FROM entrega_dinero_ventas edv
      JOIN entrega_dinero_repartidor edr ON edv.id_entrega = edr.id_entrega
      WHERE edv.id_venta = v.id_venta
        AND edr.id_repartidor = v.id_repartidor
        AND edr.estado = 'completado'
      LIMIT 1
    ), 0) as tiene_entrega
  FROM venta v
  LEFT JOIN cliente c ON v.id_cliente = c.id_cliente
  LEFT JOIN persona p_cliente ON c.id_persona = p_cliente.id_persona
  WHERE v.id_repartidor = ?
    AND v.id_estado_venta = 7 -- Pagado
    -- ✅ CORRECCIÓN: Usar fecha de venta en lugar de fecha_fin_ruta
    AND DATE(v.fecha) < CURDATE()
    -- ✅ CORRECCIÓN: Excluir ventas que YA tienen entregas
    AND NOT EXISTS (
      SELECT 1 
      FROM entrega_dinero_ventas edv
      JOIN entrega_dinero_repartidor edr ON edv.id_entrega = edr.id_entrega
      WHERE edv.id_venta = v.id_venta
        AND edr.id_repartidor = v.id_repartidor
        AND edr.estado = 'completado'
    )
  ORDER BY v.fecha ASC
`, [repartidor.id_repartidor]);
    console.log(`📊 Ventas pendientes REALES (excluyendo hoy): ${ventasPendientes.length}`);

    // Debug detallado
    if (ventasPendientes.length > 0) {
      console.log('📋 Lista de ventas pendientes REALES (sin entregas registradas):');
      ventasPendientes.forEach((v, i) => {
        console.log(`  ${i+1}. Venta ${v.id_venta}: S/ ${v.total} - Fecha: ${v.fecha_formateada} - Tiene entrega: ${v.tiene_entrega ? 'SÍ' : 'NO'}`);
      });
    } else {
      console.log('✅ No hay ventas pendientes (todo está entregado)');
    }

    // Calcular total general
    const totalGeneral = ventasPendientes.reduce((sum, venta) => {
      return sum + parseFloat(venta.total);
    }, 0);

    // Agrupar por fecha formateada
    const ventasPorDia = {};
    ventasPendientes.forEach(venta => {
      const fechaKey = venta.fecha_formateada;
      
      if (!ventasPorDia[fechaKey]) {
        ventasPorDia[fechaKey] = {
          fecha: fechaKey,
          fecha_iso: venta.fecha_venta, // Para ordenamiento
          total: 0,
          ventas: [],
          cantidad: 0
        };
      }
      
      ventasPorDia[fechaKey].total += parseFloat(venta.total);
      ventasPorDia[fechaKey].ventas.push({
        id_venta: venta.id_venta,
        total: venta.total,
        cliente: venta.cliente
      });
      ventasPorDia[fechaKey].cantidad += 1;
    });

    // Convertir a array y ordenar por fecha
    const ventasPorDiaArray = Object.values(ventasPorDia).sort((a, b) => {
      // Ordenar por fecha ISO
      return new Date(a.fecha_iso) - new Date(b.fecha_iso);
    });

    // ✅ CONSULTA ADICIONAL: Verificar entregas ya registradas por fecha
    const [entregasRegistradas] = await db.execute(`
      SELECT 
        DATE(fecha_entrega) as fecha_entrega,
        SUM(total) as total_entregado,
        GROUP_CONCAT(id_entrega) as ids_entregas
      FROM entrega_dinero_repartidor
      WHERE id_repartidor = ?
        AND estado = 'completado'
      GROUP BY DATE(fecha_entrega)
      ORDER BY fecha_entrega ASC
    `, [repartidor.id_repartidor]);

    console.log('📋 Entregas registradas por fecha:');
    entregasRegistradas.forEach(entrega => {
      console.log(`  Fecha: ${entrega.fecha_entrega} - Total: S/ ${entrega.total_entregado}`);
    });

    // Mostrar resumen comparativo
    console.log('\n📊 RESUMEN COMPARATIVO:');
    console.log(`  Repartidor: ${repartidor.nombre_completo}`);
    console.log(`  Ventas pendientes sin entregar: ${ventasPendientes.length}`);
    console.log(`  Monto total pendiente: S/ ${totalGeneral.toFixed(2)}`);
    console.log(`  Días con entregas pendientes: ${ventasPorDiaArray.length}`);
    console.log(`  Entregas registradas en total: ${entregasRegistradas.length} días`);

    res.json({
      success: true,
      data: {
        total_pendiente: totalGeneral,
        ventas_pendientes: ventasPendientes.length,
        ventas_por_dia: ventasPorDiaArray,
        detalle_ventas: ventasPendientes,
        entregas_registradas: entregasRegistradas, // Para depuración
        repartidor: {
          id: repartidor.id_repartidor,
          nombre: repartidor.nombre_completo
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo dinero pendiente total:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al obtener el dinero pendiente total',
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   GET /api/entregas-dinero/debug-pendientes
 * @desc    Endpoint de diagnóstico para ver datos reales
 * @access  Private (Repartidor)
 */
router.get('/debug-pendientes', requireRole([3], 'historial_entregas'), async (req, res) => {
  try {
    // Obtener id_repartidor
    const [repartidores] = await db.execute(`
      SELECT r.id_repartidor, p.nombre_completo
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      JOIN persona p ON r.id_persona = p.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ error: 'Repartidor no encontrado' });
    }

    const repartidor = repartidores[0];
    
    // 1. Ventas pagadas del repartidor
    const [ventasPagadas] = await db.execute(`
      SELECT 
        v.id_venta, v.total, v.fecha, v.fecha_fin_ruta,
        DATE_FORMAT(v.fecha, '%d/%m/%Y') as fecha_formateada,
        v.id_repartidor,
        -- Verificar si tiene entrega
        (SELECT COUNT(*) 
         FROM entrega_dinero_ventas edv
         JOIN entrega_dinero_repartidor edr ON edv.id_entrega = edr.id_entrega
         WHERE edv.id_venta = v.id_venta 
           AND edr.estado = 'completado') as tiene_entrega
      FROM venta v
      WHERE v.id_repartidor = ? 
        AND v.id_estado_venta = 7
      ORDER BY v.fecha ASC
    `, [repartidor.id_repartidor]);

    // 2. Entregas ya registradas CON DETALLE DE VENTAS
    const [entregasRegistradas] = await db.execute(`
      SELECT 
        edr.id_entrega, 
        edr.total, 
        DATE(edr.fecha_entrega) as fecha_entrega,
        edr.fecha_entrega as fecha_hora_completa,
        GROUP_CONCAT(DISTINCT edv.id_venta) as ventas_asociadas,
        COUNT(DISTINCT edv.id_venta) as cantidad_ventas
      FROM entrega_dinero_repartidor edr
      LEFT JOIN entrega_dinero_ventas edv ON edr.id_entrega = edv.id_entrega
      WHERE edr.id_repartidor = ? 
        AND edr.estado = 'completado'
      GROUP BY edr.id_entrega
      ORDER BY edr.fecha_entrega DESC
    `, [repartidor.id_repartidor]);

    // 3. Ventas pendientes reales (sin entregas)
    const [ventasPendientes] = await db.execute(`
      SELECT v.id_venta, v.total, v.fecha
      FROM venta v
      WHERE v.id_repartidor = ?
        AND v.id_estado_venta = 7
        AND v.id_venta NOT IN (
          SELECT DISTINCT edv.id_venta
          FROM entrega_dinero_ventas edv
          JOIN entrega_dinero_repartidor edr ON edv.id_entrega = edr.id_entrega
          WHERE edr.id_repartidor = ?
            AND edr.estado = 'completado'
        )
      ORDER BY v.fecha ASC
    `, [repartidor.id_repartidor, repartidor.id_repartidor]);

    res.json({
      success: true,
      data: {
        repartidor: repartidor.nombre_completo,
        ventas_pagadas: ventasPagadas,
        entregas_registradas: entregasRegistradas,
        ventas_pendientes: ventasPendientes,
        resumen: {
          total_ventas_pagadas: ventasPagadas.length,
          ventas_con_entrega: ventasPagadas.filter(v => v.tiene_entrega > 0).length,
          ventas_sin_entrega: ventasPendientes.length,
          total_entregas_registradas: entregasRegistradas.length,
          monto_pendiente_total: ventasPendientes.reduce((sum, v) => sum + parseFloat(v.total), 0)
        }
      }
    });

  } catch (error) {
    console.error('Error en debug:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/entregas-dinero/regularizar-pendiente
 * @desc    Regularizar entregas pendientes de días anteriores
 * @access  Private (Repartidor)
 */
router.post('/regularizar-pendiente', requireRole([3], 'historial_entregas'), async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    
    const { fecha, monto_total, metodo_entrega, ventas_ids } = req.body;
    
    if (!fecha || !monto_total || monto_total <= 0) {
      return res.status(400).json({ 
        error: 'Fecha y monto total son requeridos' 
      });
    }

    // Obtener id_repartidor
    const [repartidores] = await connection.execute(`
      SELECT r.id_repartidor, p.nombre_completo
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      JOIN persona p ON r.id_persona = p.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidor = repartidores[0];
    const repartidorId = repartidor.id_repartidor;
    const repartidorNombre = repartidor.nombre_completo;

    console.log(`🔄 Regularizando entrega pendiente para fecha ${fecha} - Monto: ${monto_total}`);

    // Registrar la entrega con fecha específica
    const [result] = await connection.execute(`
      INSERT INTO entrega_dinero_repartidor 
        (id_repartidor, total, metodo_entrega, fecha_entrega, estado, notas, id_usuario_registro)
      VALUES (?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d'), 'completado', ?, ?)
    `, [
      repartidorId, 
      monto_total, 
      metodo_entrega || 'efectivo',
      fecha,
      `Entrega regularizada por ${repartidorNombre}. Fecha original: ${fecha}. Método: ${metodo_entrega || 'efectivo'}`,
      req.user.id_usuario
    ]);

    // Asociar ventas específicas si se proporcionan
    if (ventas_ids && Array.isArray(ventas_ids) && ventas_ids.length > 0) {
      for (const ventaId of ventas_ids) {
        // Verificar que la venta pertenece al repartidor y está pagada
        const [venta] = await connection.execute(`
          SELECT id_venta, total FROM venta 
          WHERE id_venta = ? AND id_repartidor = ? AND id_estado_venta = 7
        `, [ventaId, repartidorId]);

        if (venta.length > 0) {
          await connection.execute(`
            INSERT INTO entrega_dinero_ventas (id_entrega, id_venta, monto_asignado)
            VALUES (?, ?, ?)
          `, [result.insertId, ventaId, venta[0].total]);
        }
      }
    }

    // Registrar en bitácora
    await connection.execute(`
      INSERT INTO sistema_bitacora 
        (modulo, accion, descripcion, id_usuario, id_referencia)
      VALUES ('entregas_dinero', 'regularizacion', ?, ?, ?)
    `, [
      `Repartidor ${repartidorNombre} regularizó entrega pendiente de ${fecha} - S/ ${monto_total}`,
      req.user.id_usuario,
      result.insertId
    ]);

    res.json({
      success: true,
      message: '✅ Entrega pendiente regularizada exitosamente',
      data: {
        id_entrega: result.insertId,
        fecha: fecha,
        total: monto_total,
        metodo_entrega: metodo_entrega || 'efectivo'
      }
    });

  } catch (error) {
    console.error('❌ Error regularizando entrega pendiente:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al regularizar la entrega',
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});
// En entrega-dinero.routes.js - MODIFICAR SOLO el endpoint /registrar-con-ventas
/**
 * @route   POST /api/entregas-dinero/registrar-con-ventas
 * @desc    Registrar entrega con ventas específicas (para entregas "todo hoy")
 * @access  Private (Repartidor)
 */
router.post('/registrar-con-ventas', requireRole([3], 'historial_entregas'), async (req, res) => {
  let connection;
  try {
    connection = await db.getConnection();
    
    const { total, metodo_entrega, ventas_ids, tipo_entrega, fecha_regularizacion } = req.body;
    
    // Validaciones
    if (!total || total <= 0) {
      return res.status(400).json({ 
        error: 'El monto total debe ser mayor a 0' 
      });
    }

    if (!tipo_entrega) {
      return res.status(400).json({ 
        error: 'El tipo de entrega es requerido' 
      });
    }

    // Obtener id_repartidor
    const [repartidores] = await connection.execute(`
      SELECT r.id_repartidor, p.nombre_completo
      FROM repartidor r
      JOIN usuario u ON r.id_persona = u.id_persona
      JOIN persona p ON r.id_persona = p.id_persona
      WHERE u.id_usuario = ?
      LIMIT 1
    `, [req.user.id_usuario]);

    if (repartidores.length === 0) {
      return res.status(404).json({ 
        error: 'Repartidor no encontrado para este usuario' 
      });
    }

    const repartidor = repartidores[0];
    const repartidorId = repartidor.id_repartidor;
    const repartidorNombre = repartidor.nombre_completo;

    console.log(`💰 Registrando entrega tipo "${tipo_entrega}" para repartidor ${repartidorNombre}`);

    // Analizar ventas para determinar el desglose
    let ventasHoy = [];
    let ventasAnteriores = [];
    let totalHoy = 0;
    let totalAnterior = 0;
    let todasVentasSonAnteriores = true;
    let todasVentasSonHoy = true;
    
    if (ventas_ids && Array.isArray(ventas_ids) && ventas_ids.length > 0) {
      for (const ventaId of ventas_ids) {
        const [venta] = await connection.execute(`
          SELECT id_venta, total, DATE(fecha) as fecha_venta, 
                 DATE(fecha_fin_ruta) as fecha_fin
          FROM venta 
          WHERE id_venta = ? AND id_repartidor = ? AND id_estado_venta = 7
        `, [ventaId, repartidorId]);
        
        if (venta.length > 0) {
          const v = venta[0];
          const fechaVenta = new Date(v.fecha_fin || v.fecha_venta);
          const hoy = new Date();
          const esMismoDia = fechaVenta.toDateString() === hoy.toDateString();
          
          if (esMismoDia) {
            ventasHoy.push(v);
            totalHoy += parseFloat(v.total);
            todasVentasSonAnteriores = false;
          } else {
            ventasAnteriores.push(v);
            totalAnterior += parseFloat(v.total);
            todasVentasSonHoy = false;
          }
        }
      }
    }

    // Determinar nota según el tipo de entrega
    let nota = '';
    let fechaEntrega = 'NOW()';
    let tipoEntregaNota = tipo_entrega;
    
    switch (tipo_entrega) {
      case 'hoy':
        // Solo ventas de hoy
        if (ventasHoy.length === 0) {
          return res.status(400).json({ 
            error: 'No se encontraron ventas del día de hoy para registrar como "hoy"' 
          });
        }
        nota = `ENTREGA DE HOY registrada por ${repartidorNombre}.\n` +
               `• ${ventasHoy.length} ventas del día de hoy\n` +
               `• Método: ${metodo_entrega || 'efectivo'}`;
        break;
        
      case 'mixta':
        // Solo días anteriores entregados hoy (mixta)
        if (ventasAnteriores.length === 0) {
          return res.status(400).json({ 
            error: 'No se encontraron ventas de días anteriores para registrar como "mixta"' 
          });
        }
        nota = `ENTREGA MIXTA - SOLO DÍAS ANTERIORES registrada por ${repartidorNombre}.\n` +
               `• ${ventasAnteriores.length} ventas de días anteriores\n` +
               `• Total días anteriores: S/ ${totalAnterior.toFixed(2)}\n` +
               `• Registrada el: ${new Date().toLocaleDateString('es-PE')}\n` +
               `• Método: ${metodo_entrega || 'efectivo'}`;
        break;
        
      case 'completa_anterior':
        // Solo días anteriores (como si fuera "todo hoy" para solo días anteriores)
        if (ventasAnteriores.length === 0) {
          return res.status(400).json({ 
            error: 'No se encontraron ventas de días anteriores' 
          });
        }
        nota = `ENTREGA COMPLETA DE DÍAS ANTERIORES registrada por ${repartidorNombre}.\n` +
               `• ${ventasAnteriores.length} ventas de fechas pasadas\n` +
               `• Registrada el: ${new Date().toLocaleDateString('es-PE')}\n` +
               `• Método: ${metodo_entrega || 'efectivo'}`;
        break;
        
      case 'mixta_completa':
        // Hoy + días anteriores en un solo registro
        nota = `ENTREGA MIXTA COMPLETA registrada por ${repartidorNombre}.\n` +
               `• HOY: ${ventasHoy.length} ventas - S/ ${totalHoy.toFixed(2)}\n` +
               `• DÍAS ANTERIORES: ${ventasAnteriores.length} ventas - S/ ${totalAnterior.toFixed(2)}\n` +
               `• TOTAL: S/ ${total.toFixed(2)}\n` +
               `• Método: ${metodo_entrega || 'efectivo'}`;
        break;
        
      default:
        return res.status(400).json({ 
          error: 'Tipo de entrega no válido. Use: hoy, mixta, completa_anterior, mixta_completa' 
        });
    }

    // Usar fecha específica para regularizaciones o fecha actual
    let fechaEntregaParam = 'NOW()';
    let fechaEntregaValor = null;
    
    if (fecha_regularizacion && tipo_entrega === 'mixta') {
      // Para mixtas (solo días anteriores), usar fecha específica
      fechaEntregaParam = 'STR_TO_DATE(?, "%Y-%m-%d")';
      fechaEntregaValor = fecha_regularizacion;
    }

    // Registrar la entrega
    let sql = '';
    let params = [];
    
    if (fecha_regularizacion && tipo_entrega === 'mixta') {
      sql = `
        INSERT INTO entrega_dinero_repartidor 
          (id_repartidor, total, metodo_entrega, fecha_entrega, estado, notas, 
           tipo_entrega, id_usuario_registro)
        VALUES (?, ?, ?, STR_TO_DATE(?, '%Y-%m-%d'), 'completado', ?, ?, ?)
      `;
      params = [
        repartidorId, 
        total, 
        metodo_entrega || 'efectivo',
        fecha_regularizacion,
        nota,
        tipo_entrega,
        req.user.id_usuario
      ];
    } else {
      sql = `
        INSERT INTO entrega_dinero_repartidor 
          (id_repartidor, total, metodo_entrega, fecha_entrega, estado, notas, 
           tipo_entrega, id_usuario_registro)
        VALUES (?, ?, ?, NOW(), 'completado', ?, ?, ?)
      `;
      params = [
        repartidorId, 
        total, 
        metodo_entrega || 'efectivo',
        nota,
        tipo_entrega,
        req.user.id_usuario
      ];
    }

    const [result] = await connection.execute(sql, params);

    // Asociar ventas
    if (ventas_ids && Array.isArray(ventas_ids) && ventas_ids.length > 0) {
      for (const ventaId of ventas_ids) {
        // Verificar que la venta pertenece al repartidor y está pagada
        const [venta] = await connection.execute(`
          SELECT id_venta, total 
          FROM venta 
          WHERE id_venta = ? AND id_repartidor = ? AND id_estado_venta = 7
        `, [ventaId, repartidorId]);

        if (venta.length > 0) {
          await connection.execute(`
            INSERT INTO entrega_dinero_ventas (id_entrega, id_venta, monto_asignado, fecha_asociacion)
            VALUES (?, ?, ?, NOW())
          `, [result.insertId, ventaId, venta[0].total]);
        }
      }
    }

    // Obtener el registro creado
    const [entregaCreada] = await connection.execute(`
      SELECT 
        id_entrega,
        total,
        metodo_entrega,
        fecha_entrega,
        estado,
        notas,
        tipo_entrega,
        fecha_registro
      FROM entrega_dinero_repartidor
      WHERE id_entrega = ?
    `, [result.insertId]);

    // Registrar en bitácora
    await connection.execute(`
      INSERT INTO sistema_bitacora 
        (modulo, accion, descripcion, id_usuario, id_referencia)
      VALUES ('entregas_dinero', 'registro_con_ventas', ?, ?, ?)
    `, [
      `Repartidor ${repartidorNombre} registró entrega tipo "${tipo_entrega}" por S/ ${total}`,
      req.user.id_usuario,
      result.insertId
    ]);

    const entrega = entregaCreada[0];
    const fechaEntregaObj = new Date(entrega.fecha_entrega);

    res.json({
      success: true,
      message: `✅ Entrega tipo "${tipo_entrega}" registrada exitosamente`,
      data: {
        id_entrega: result.insertId,
        total: total,
        metodo_entrega: metodo_entrega || 'efectivo',
        tipo_entrega: tipo_entrega,
        fecha_entrega: fechaEntregaObj.toISOString(),
        fecha_entrega_local: fechaEntregaObj.toLocaleString('es-PE', {
          timeZone: 'America/Lima',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        estado: 'completado',
        ventas_asociadas: ventas_ids?.length || 0,
        desglose: {
          ventas_hoy: ventasHoy.length,
          total_hoy: totalHoy,
          ventas_anteriores: ventasAnteriores.length,
          total_anterior: totalAnterior
        },
        repartidor: {
          id: repartidorId,
          nombre: repartidorNombre
        }
      }
    });

  } catch (error) {
    console.error('❌ Error registrando entrega con ventas:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor al registrar la entrega',
      detalles: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
});