// backend_dsi6/src/services/pushbullet.service.js
import WebSocket from 'ws';
import db from '../config/db.js';

class PushbulletService {
  constructor() {
    this.accessToken = null;
    this.ws = null;
    this.isRunning = false;
    this.reconnectAttempts = 0;
    this.lastProcessedId = null;
  }

  init(token) {
    this.accessToken = token;
    console.log('🔧 PushbulletService inicializado');
  }

  /**
   * Conectar al WebSocket de Pushbullet para recibir notificaciones en tiempo real
   */
  connectWebSocket() {
    if (!this.accessToken) {
      console.error('❌ No se puede conectar: token no configurado');
      return;
    }

    const wsUrl = `wss://stream.pushbullet.com/websocket/${this.accessToken}`;
    console.log(`🔌 Conectando a Pushbullet WebSocket: ${wsUrl.substring(0, 50)}...`);
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.on('open', () => {
      console.log('✅ Conectado a Pushbullet WebSocket');
      this.reconnectAttempts = 0;
      this.isRunning = true;
    });
    
 this.ws.on('message', async (data) => {
  try {
    const message = JSON.parse(data);
    console.log('📨 Mensaje WebSocket recibido:', message.type);
    
    // Caso 1: Notificación push directa
    if (message.type === 'push') {
      console.log('📱 Push directo recibido, contenido:', JSON.stringify(message.push).substring(0, 200));
      await this.processYapeNotification(message.push);
    }
    
    // Caso 2: Tickle (algo cambió, hay que consultar)
    if (message.type === 'tickle' && message.subtype === 'push') {
      console.log('📱 Tickle detectado, obteniendo pushes recientes...');
      await this.fetchAndProcessLatestPush();
    }
    
  } catch (error) {
    console.error('❌ Error procesando mensaje WebSocket:', error.message);
  }
});
    
    this.ws.on('close', () => {
      console.log('🔌 WebSocket cerrado, reconectando...');
      this.isRunning = false;
      this.reconnect();
    });
    
    this.ws.on('error', (err) => {
      console.error('❌ WebSocket error:', err.message);
    });
  }
  
  /**
   * Reintentar conexión con backoff exponencial
   */
  reconnect() {
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    console.log(`🔄 Reintentando conexión en ${delay/1000} segundos...`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connectWebSocket();
    }, delay);
  }
  
  /**
   * Obtener la notificación más reciente y procesarla
   */
  async fetchAndProcessLatestPush() {
    try {
      // Obtener solo la notificación más reciente
      const response = await fetch('https://api.pushbullet.com/v2/pushes?limit=1&active=true', {
        headers: { 'Access-Token': this.accessToken }
      });
      
      if (!response.ok) {
        console.error(`Error fetching latest push: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const pushes = data.pushes || [];
      
      if (pushes.length === 0) return;
      
      const latestPush = pushes[0];
      
      // Verificar si ya procesamos esta
      if (this.lastProcessedId === latestPush.iden) {
        return;
      }
      
      // Si es notificación Yape, procesarla
      if (latestPush.title?.includes('Yape') || latestPush.body?.includes('Yape')) {
        console.log('💛 Notificación Yape detectada vía WebSocket!');
        await this.processYapeNotification(latestPush);
        this.lastProcessedId = latestPush.iden;
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo notificación reciente:', error.message);
    }
  }
  
  /**
   * Extraer información de una notificación Yape
   */
// Modifica el método parseYapeNotification para que sea más robusto
parseYapeNotification(push) {
  // Si no hay push, salir
  if (!push) {
    console.log('⚠️ Push vacío');
    return null;
  }

  // El título o body pueden estar en diferentes campos
  const title = push.title || '';
  const body = push.body || '';
  
  const isYape = title.includes('Yape') || body.includes('Yape');
  if (!isYape) {
    return null;
  }

  console.log('📱 Parseando notificación Yape:', {
    title: title,
    body: body.substring(0, 100),
    created: push.created,
    type: push.type
  });

  // Extraer monto (ej: "S/ 4" o "S/ 4.00")
  const montoMatch = body.match(/S\/\s*(\d+(?:\.\d{1,2})?)/);
  const monto = montoMatch ? parseFloat(montoMatch[1]) : null;

  // Extraer código de seguridad de Yape (ej: "542")
  const codigoSeguridadMatch = body.match(/cód\.? de seguridad es:\s*(\d+)/i);
  const codigoSeguridad = codigoSeguridadMatch ? codigoSeguridadMatch[1] : null;

  // Extraer nombre del pagador (ej: "Michel Fum*")
  const pagadorMatch = body.match(/^([^*]+)\*/);
  const pagador = pagadorMatch ? pagadorMatch[1].trim() : null;

  if (!monto) {
    console.log('⚠️ Notificación Yape sin monto reconocible:', body);
    return null;
  }

  console.log(`💰 Yape detectado - Monto: S/ ${monto}, Código seguridad: ${codigoSeguridad}, Pagador: ${pagador}`);

  return {
    transaction_id: push.iden || `pb-${Date.now()}`,
    amount: monto,
    phone: null,
    message: body,
    status: 'completed',
    timestamp: push.created || Date.now() / 1000,
    customer_name: pagador,
    codigo_verificacion: codigoSeguridad,
    push_iden: push.iden
  };
}

  /**
   * Procesar una notificación y enviarla al webhook
   */
// Modifica processYapeNotification para que registre más detalles
async processYapeNotification(push) {
  console.log('🔄 Procesando notificación push:', push?.type || 'desconocido');
  
  const parsed = this.parseYapeNotification(push);
  if (!parsed || !parsed.amount) {
    console.log('⚠️ No se pudo parsear la notificación o no es Yape');
    return null;
  }
  
  console.log('💰 Pago Yape detectado:', {
    monto: parsed.amount,
    codigo: parsed.codigo_verificacion,
    pagador: parsed.customer_name
  });
  
  // Verificar duplicados
  const [rows] = await db.execute(
    'SELECT id_transaccion FROM transacciones_yape WHERE transaction_id = ?',
    [parsed.transaction_id]
  );
  
  if (rows.length > 0) {
    console.log('⚠️ Notificación ya procesada:', parsed.transaction_id);
    return null;
  }
  
  // Buscar venta pendiente con el mismo monto
  const [ventas] = await db.execute(`
    SELECT id_venta, id_cliente, total, codigo_yape, transaction_id_yape
    FROM venta 
    WHERE id_estado_venta = 4
      AND id_metodo_pago = 2
      AND total = ?
      AND transaction_id_yape IS NULL
    ORDER BY fecha_creacion DESC
    LIMIT 1
  `, [parsed.amount]);
  
  if (ventas.length === 0) {
    console.log(`❌ No se encontró venta pendiente para monto S/ ${parsed.amount}`);
    
    // Guardar transacción fallida
    await db.execute(`
      INSERT INTO transacciones_yape 
      (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, push_id)
      VALUES (?, ?, ?, ?, ?, 'VENTA_NO_ENCONTRADA', NOW(), ?)
    `, [parsed.transaction_id, parsed.amount, parsed.phone, parsed.codigo_verificacion, parsed.message, parsed.transaction_id]);
    return null;
  }
  
  const venta = ventas[0];
  console.log(`✅ Venta encontrada: #${venta.id_venta}, actualizando a pagada...`);
  
  // Actualizar venta
  await db.execute(`
    UPDATE venta 
    SET id_estado_venta = 7,
        transaction_id_yape = ?,
        notas = CONCAT(notas, ' - YAPE CONFIRMADO #', ?),
        fecha_actualizacion = NOW()
    WHERE id_venta = ?
  `, [parsed.transaction_id, parsed.codigo_verificacion, venta.id_venta]);
  
  // Guardar transacción exitosa
  await db.execute(`
    INSERT INTO transacciones_yape 
    (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, id_venta, push_id)
    VALUES (?, ?, ?, ?, ?, 'CONFIRMADO', NOW(), ?, ?)
  `, [parsed.transaction_id, parsed.amount, parsed.phone, parsed.codigo_verificacion, parsed.message, venta.id_venta, parsed.transaction_id]);
  
  console.log(`✅ Venta #${venta.id_venta} marcada como pagada`);
  
  return { success: true, id_venta: venta.id_venta };
}
  
  /**
   * Iniciar el servicio (WebSocket)
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Servicio ya está ejecutándose');
      return;
    }
    
    if (!this.accessToken) {
      console.error('❌ No se puede iniciar: token no configurado');
      return;
    }
    
    this.connectWebSocket();
  }
  
  /**
   * Detener el servicio
   */
  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isRunning = false;
    console.log('🛑 Servicio Pushbullet detenido');
  }
  
  /**
   * Obtener estado actual
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasToken: !!this.accessToken,
      lastProcessedId: this.lastProcessedId,
      connected: this.ws?.readyState === WebSocket.OPEN
    };
  }
}

// Exportar instancia única
const pushbulletService = new PushbulletService();
export default pushbulletService;