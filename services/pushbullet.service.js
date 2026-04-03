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

  connectWebSocket() {
    if (!this.accessToken) {
      console.error('❌ No se puede conectar: token no configurado');
      return;
    }

    const wsUrl = `wss://stream.pushbullet.com/websocket/${this.accessToken}`;
    console.log(`🔌 Conectando a Pushbullet WebSocket...`);
    
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
        
        if (message.type === 'push') {
          const pushContent = message.push;
          console.log(`📱 Push directo recibido, tipo: ${pushContent?.type || 'desconocido'}`);
          
          if (pushContent?.type === 'mirror') {
            console.log(`   📱 Notificación mirror:`);
            console.log(`      Título: ${pushContent.title?.substring(0, 50) || 'sin título'}`);
            console.log(`      Cuerpo: ${pushContent.body?.substring(0, 80) || 'sin cuerpo'}...`);
          }
          
          await this.processYapeNotification(pushContent);
        }
        
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
  
  reconnect() {
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    console.log(`🔄 Reintentando conexión en ${delay/1000} segundos...`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connectWebSocket();
    }, delay);
  }
  
  async fetchAndProcessLatestPush() {
    try {
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
      
      if (this.lastProcessedId === latestPush.iden) {
        return;
      }
      
      if (latestPush.title?.includes('Yape') || latestPush.body?.includes('Yape')) {
        console.log('💛 Notificación Yape detectada vía fetch!');
        await this.processYapeNotification(latestPush);
        this.lastProcessedId = latestPush.iden;
      }
      
    } catch (error) {
      console.error('❌ Error obteniendo notificación reciente:', error.message);
    }
  }
  
  parseYapeNotification(push) {
    if (!push) {
      console.log('⚠️ Push vacío');
      return null;
    }

    let title = '';
    let body = '';
    
    if (push.type === 'mirror') {
      title = push.title || '';
      body = push.body || '';
    } else {
      title = push.title || '';
      body = push.body || '';
    }
    
    const isYape = title.includes('Yape') || body.includes('Yape');
    if (!isYape) {
      return null;
    }

    console.log('📱 Parseando notificación Yape:', {
      title: title,
      body: body.substring(0, 100),
      type: push.type
    });

    const montoMatch = body.match(/S\/\s*(\d+(?:\.\d{1,2})?)/);
    const monto = montoMatch ? parseFloat(montoMatch[1]) : null;

    const codigoSeguridadMatch = body.match(/cód\.? de seguridad es:\s*(\d+)/i);
    const codigoSeguridad = codigoSeguridadMatch ? codigoSeguridadMatch[1] : null;

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
      push_iden: push.iden,
      push_type: push.type
    };
  }

  async processYapeNotification(push) {
    console.log('🔄 Procesando notificación push');
    
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
    
    const [rows] = await db.execute(
      'SELECT id_transaccion FROM transacciones_yape WHERE transaction_id = ?',
      [parsed.transaction_id]
    );
    
    if (rows.length > 0) {
      console.log('⚠️ Notificación ya procesada:', parsed.transaction_id);
      return null;
    }
    
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
      
      await db.execute(`
        INSERT INTO transacciones_yape 
        (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, push_id)
        VALUES (?, ?, ?, ?, ?, 'VENTA_NO_ENCONTRADA', NOW(), ?)
      `, [parsed.transaction_id, parsed.amount, parsed.phone, parsed.codigo_verificacion, parsed.message, parsed.transaction_id]);
      return null;
    }
    
    const venta = ventas[0];
    console.log(`✅ Venta encontrada: #${venta.id_venta}, actualizando a pagada...`);
    
    await db.execute(`
      UPDATE venta 
      SET id_estado_venta = 7,
          transaction_id_yape = ?,
          notas = CONCAT(notas, ' - YAPE CONFIRMADO #', ?),
          fecha_actualizacion = NOW()
      WHERE id_venta = ?
    `, [parsed.transaction_id, parsed.codigo_verificacion, venta.id_venta]);
    
    await db.execute(`
      INSERT INTO transacciones_yape 
      (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, id_venta, push_id)
      VALUES (?, ?, ?, ?, ?, 'CONFIRMADO', NOW(), ?, ?)
    `, [parsed.transaction_id, parsed.amount, parsed.phone, parsed.codigo_verificacion, parsed.message, venta.id_venta, parsed.transaction_id]);
    
    console.log(`✅✅✅ Venta #${venta.id_venta} marcada como pagada exitosamente!`);
    
    return { success: true, id_venta: venta.id_venta };
  }
  
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
  
  stop() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isRunning = false;
    console.log('🛑 Servicio Pushbullet detenido');
  }
  
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasToken: !!this.accessToken,
      lastProcessedId: this.lastProcessedId,
      connected: this.ws?.readyState === WebSocket.OPEN
    };
  }
}

const pushbulletService = new PushbulletService();
export default pushbulletService;