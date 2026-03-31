// backend_dsi6/src/controllers/yape.webhook.controller.js
import db from '../config/db.js';
import crypto from 'crypto';

// ============================================
// GENERAR CÓDIGO ÚNICO DE VERIFICACIÓN
// ============================================
export const generarCodigoYape = () => {
  const fecha = new Date();
  const dia = fecha.getDate().toString().padStart(2, '0');
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
  const anio = fecha.getFullYear().toString().slice(-2);
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  return `YP-${anio}${mes}${dia}-${random}`;
};

// ============================================
// ENDPOINT PARA SOLICITAR CÓDIGO DE VERIFICACIÓN
// ============================================
export const solicitarCodigoYape = async (req, res) => {
  try {
    const { id_venta, monto } = req.body;
    
    // Generar código único
    const codigo = generarCodigoYape();
    
    // Guardar código en la venta
    await db.execute(`
      UPDATE venta 
      SET codigo_yape = ?, notas = CONCAT(notas, ' - YAPE PENDIENTE: ', ?)
      WHERE id_venta = ?
    `, [codigo, codigo, id_venta]);
    
    res.json({
      success: true,
      codigo: codigo,
      mensaje: 'Código generado correctamente'
    });
    
  } catch (error) {
    console.error('Error generando código Yape:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// WEBHOOK DE YAPE (RECIBE NOTIFICACIONES)
// ============================================
export const webhookYape = async (req, res) => {
  console.log('📱 WEBHOOK YAPE RECIBIDO');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  try {
    // ============================================
    // 1. VERIFICAR ORIGEN (Pushbullet o Yape directo)
    // ============================================
    const isFromPushbullet = req.headers['x-pushbullet-source'] === 'true';
    
    // Si es de Pushbullet, no verificamos firma (no tienen)
    // Si es de OkeyPay, verificamos firma
    const signature = req.headers['x-yape-signature'];
    const timestamp = req.headers['x-yape-timestamp'];
    
    if (!isFromPushbullet && process.env.YAPE_WEBHOOK_SECRET && signature) {
      const payload = `${timestamp}.${JSON.stringify(req.body)}`;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.YAPE_WEBHOOK_SECRET)
        .update(payload)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('❌ Firma inválida - Posible intento de fraude');
        return res.status(401).json({ error: 'Firma inválida' });
      }
    }
    
    // ============================================
    // 2. EXTRAER DATOS DE LA NOTIFICACIÓN
    // ============================================
    const {
      transaction_id,
      amount,
      phone,
      message,
      status,
      timestamp: yapeTimestamp,
      payment_method,
      customer_name,
      codigo_verificacion,  // Puede venir de Pushbullet
      codigo_seguridad,     // Código de seguridad de Yape
      push_iden             // ID de Pushbullet
    } = req.body;
    
    // Si es de Pushbullet y no tiene transaction_id, usar push_iden
    const finalTransactionId = transaction_id || push_iden || `PB-${Date.now()}`;
    
    console.log(`📊 Datos recibidos:`, {
      transaction_id: finalTransactionId,
      amount,
      phone,
      message,
      status,
      from: isFromPushbullet ? 'Pushbullet' : 'Directo'
    });
    
    // ============================================
    // 3. VERIFICAR QUE SEA UNA TRANSACCIÓN COMPLETADA
    // ============================================
    if (status !== 'completed') {
      console.log(`⏳ Transacción en estado: ${status}`);
      return res.json({ 
        received: true, 
        message: 'Transacción en proceso',
        status: 'pending'
      });
    }
    
    // ============================================
    // 4. EXTRAER CÓDIGO DEL MENSAJE
    // ============================================
    let codigoVerificacion = codigo_verificacion;
    
    if (!codigoVerificacion && message) {
      // Buscar código con formato YP-YYMMDD-XXXX
      const codigoMatch = message.match(/YP-\d{6}-\d{4}/);
      if (codigoMatch) {
        codigoVerificacion = codigoMatch[0];
      } else {
        // Buscar código de seguridad simple (ej: "266")
        const simpleMatch = message.match(/\b(\d{3,4})\b/);
        if (simpleMatch) {
          codigoVerificacion = simpleMatch[1];
        }
      }
    }
    
if (!codigoVerificacion) {
  console.log('⚠️ No se encontró código de verificación en el mensaje');
  // ✅ CORREGIDO: Usar NOW() en lugar de JavaScript Date
  await db.execute(`
    INSERT INTO transacciones_yape 
    (transaction_id, monto, telefono_pagador, mensaje, estado, fecha_transaccion, push_id)
    VALUES (?, ?, ?, ?, 'NO_ASOCIADA', NOW(), ?)
  `, [finalTransactionId, amount, phone, message, push_iden]);
  
  return res.json({ 
    received: true, 
    message: 'Transacción recibida pero sin código',
    status: 'no_code'
  });
}
    
    console.log(`🔐 Código encontrado: ${codigoVerificacion}`);
    
    // ============================================
    // 5. BUSCAR VENTA CON ESE CÓDIGO
    // ============================================
    let query = `
      SELECT id_venta, id_cliente, total, codigo_yape, transaction_id_yape
      FROM venta 
      WHERE (codigo_yape = ? OR (notas LIKE ?))
        AND id_estado_venta = 4  -- Listo para repartos (recarga pendiente)
        AND transaction_id_yape IS NULL
      ORDER BY fecha_creacion DESC
      LIMIT 1
    `;
    
    const [ventas] = await db.execute(query, [
      codigoVerificacion, 
      `%${codigoVerificacion}%`
    ]);
    
    if (ventas.length === 0) {
  console.log('❌ Código no válido o ya utilizado');
  // ✅ CORREGIDO: Usar NOW()
  await db.execute(`
    INSERT INTO transacciones_yape 
    (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, push_id)
    VALUES (?, ?, ?, ?, ?, 'CODIGO_INVALIDO', NOW(), ?)
  `, [finalTransactionId, amount, phone, codigoVerificacion, message, push_iden]);
  
  return res.status(404).json({ 
    error: 'Código no válido o ya utilizado',
    code: 'INVALID_CODE'
  });
}
    
    const venta = ventas[0];
    
    // ============================================
    // 6. VALIDAR MONTO
    // ============================================
    if (Number(venta.total) !== Number(amount)) {
  console.log(`❌ Monto incorrecto: esperado S/ ${venta.total}, recibido S/ ${amount}`);
  // ✅ CORREGIDO: Usar NOW()
  await db.execute(`
    INSERT INTO transacciones_yape 
    (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, id_venta, push_id)
    VALUES (?, ?, ?, ?, ?, 'MONTO_INCORRECTO', NOW(), ?, ?)
  `, [finalTransactionId, amount, phone, codigoVerificacion, message, venta.id_venta, push_iden]);
  
  return res.status(400).json({ 
    error: `Monto incorrecto. Esperado: S/ ${venta.total}`,
    code: 'AMOUNT_MISMATCH'
  });
}
    
    // ============================================
    // 7. VERIFICAR QUE NO SE HAYA PROCESADO ANTES
    // ============================================
    const [transaccionExistente] = await db.execute(`
      SELECT id_transaccion FROM transacciones_yape 
      WHERE transaction_id = ? OR (codigo_verificacion = ? AND estado = 'CONFIRMADO')
    `, [finalTransactionId, codigoVerificacion]);
    
    if (transaccionExistente.length > 0) {
      console.log('⚠️ Transacción ya procesada anteriormente');
      return res.json({ 
        received: true, 
        message: 'Transacción ya procesada',
        status: 'duplicate'
      });
    }
    
    // ============================================
    // 8. ACTUALIZAR ESTADO DE LA VENTA A PAGADA
    // ============================================
    await db.execute(`
      UPDATE venta 
      SET id_estado_venta = 7,  -- Pagado
          transaction_id_yape = ?,
          notas = CONCAT(notas, ' - YAPE CONFIRMADO #', ?),
          fecha_actualizacion = NOW()
      WHERE id_venta = ?
    `, [finalTransactionId, finalTransactionId, venta.id_venta]);
    
    // ============================================
    // 9. REGISTRAR TRANSACCIÓN EXITOSA
    // ============================================
    // ✅ CORREGIDO: Usar NOW() en lugar de yapeTimestamp
   await db.execute(`
  INSERT INTO transacciones_yape 
  (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, id_venta, push_id)
  VALUES (?, ?, ?, ?, ?, 'CONFIRMADO', NOW(), ?, ?)
`, [finalTransactionId, amount, phone, codigoVerificacion, message, venta.id_venta, push_iden]);
    
    console.log(`✅ PAGO CONFIRMADO: Venta #${venta.id_venta}, Monto S/ ${amount}`);
    
    // ============================================
    // 10. RESPUESTA EXITOSA
    // ============================================
    res.json({
      success: true,
      message: 'Pago confirmado correctamente',
      source: isFromPushbullet ? 'pushbullet' : 'direct',
      data: {
        id_venta: venta.id_venta,
        monto: amount,
        codigo: codigoVerificacion,
        transaction_id: finalTransactionId
      }
    });
    
  } catch (error) {
    console.error('❌ Error en webhook Yape:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
};

// ============================================
// VERIFICAR ESTADO DE UN PAGO YAPE
// ============================================
export const verificarEstadoYape = async (req, res) => {
  try {
    const { id_venta } = req.params;
    
    const [ventas] = await db.execute(`
      SELECT id_venta, transaction_id_yape, id_estado_venta, codigo_yape
      FROM venta 
      WHERE id_venta = ?
    `, [id_venta]);
    
    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }
    
    const venta = ventas[0];
    
    if (venta.id_estado_venta === 7 && venta.transaction_id_yape) {
      return res.json({
        pagado: true,
        transaction_id: venta.transaction_id_yape,
        codigo: venta.codigo_yape
      });
    }
    
    // Buscar en transacciones
    const [transaccion] = await db.execute(`
      SELECT estado, transaction_id 
      FROM transacciones_yape 
      WHERE id_venta = ?
      ORDER BY fecha_recepcion DESC LIMIT 1
    `, [id_venta]);
    
    if (transaccion.length > 0) {
      return res.json({
        pagado: transaccion[0].estado === 'CONFIRMADO',
        estado: transaccion[0].estado,
        transaction_id: transaccion[0].transaction_id
      });
    }
    
    res.json({ pagado: false });
    
  } catch (error) {
    console.error('Error verificando estado Yape:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================
// LISTAR TRANSACCIONES YAPE
// ============================================
export const listarTransaccionesYape = async (req, res) => {
  try {
    const { limite = 50, desde = 0 } = req.query;
    
    const [transacciones] = await db.execute(`
      SELECT 
        ty.*,
        v.id_venta,
        v.codigo_yape,
        v.total as monto_venta,
        c.nombre_completo as cliente
      FROM transacciones_yape ty
      LEFT JOIN venta v ON ty.id_venta = v.id_venta
      LEFT JOIN cliente cl ON v.id_cliente = cl.id_cliente
      LEFT JOIN persona c ON cl.id_persona = c.id_persona
      ORDER BY ty.fecha_recepcion DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limite), parseInt(desde)]);
    
    const [total] = await db.execute('SELECT COUNT(*) as total FROM transacciones_yape');
    
    res.json({
      data: transacciones,
      total: total[0].total,
      limite: parseInt(limite),
      desde: parseInt(desde)
    });
    
  } catch (error) {
    console.error('Error listando transacciones:', error);
    res.status(500).json({ error: error.message });
  }
};