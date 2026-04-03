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
        
        // Cuando hay una nueva notificación push
        if (message.type === 'tickle' && message.subtype === 'push') {
          console.log('📱 Nueva notificación detectada, obteniendo detalles...');
          await this.fetchAndProcessLatestPush();
        }
        
        // También puede llegar directamente el push
        if (message.type === 'push') {
          console.log('📱 Push directo recibido');
          await this.processYapeNotification(message.push);
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
  parseYapeNotification(push) {
    const isYape = push.title?.includes('Yape') || push.body?.includes('Yape');
    if (!isYape) {
      return null;
    }

    console.log('📱 Parseando notificación Yape:', {
      title: push.title,
      body: push.body?.substring(0, 100),
      created: push.created
    });

    // Extraer monto
    const montoMatch = push.body?.match(/S\/\s*(\d+(?:\.\d{1,2})?)/);
    const monto = montoMatch ? parseFloat(montoMatch[1]) : null;

    // Extraer código de seguridad de Yape
    const codigoSeguridadMatch = push.body?.match(/cód\.? de seguridad es:\s*(\d+)/i);
    const codigoSeguridad = codigoSeguridadMatch ? codigoSeguridadMatch[1] : null;

    // Extraer nombre del pagador
    const pagadorMatch = push.body?.match(/^([^*]+)\*/);
    const pagador = pagadorMatch ? pagadorMatch[1].trim() : null;

    if (!monto) {
      console.log('⚠️ Notificación Yape sin monto:', push.body);
      return null;
    }

    console.log(`💰 Código de seguridad detectado: ${codigoSeguridad}`);

    return {
      transaction_id: push.iden,
      amount: monto,
      phone: null,
      message: push.body,
      status: 'completed',
      timestamp: push.created,
      customer_name: pagador,
      codigo_verificacion: codigoSeguridad,
      push_iden: push.iden
    };
  }

  /**
   * Procesar una notificación y enviarla al webhook
   */
  async processYapeNotification(push) {
    const parsed = this.parseYapeNotification(push);
    if (!parsed || !parsed.amount) {
      return null;
    }
    
    // Verificar duplicados
    const [rows] = await db.execute(
      'SELECT id_transaccion FROM transacciones_yape WHERE transaction_id = ?',
      [parsed.transaction_id]
    );
    
    if (rows.length > 0) {
      console.log('⚠️ Notificación ya procesada:', parsed.transaction_id);
      return null;
    }
    
    console.log('💰 Pago Yape detectado:', {
      monto: parsed.amount,
      codigo: parsed.codigo_verificacion,
      pagador: parsed.customer_name
    });
    
    // Guardar registro inicial
    await db.execute(`
      INSERT INTO transacciones_yape 
      (transaction_id, monto, telefono_pagador, codigo_verificacion, mensaje, estado, fecha_transaccion, push_id)
      VALUES (?, ?, ?, ?, ?, 'PENDIENTE', FROM_UNIXTIME(?), ?)
    `, [
      parsed.transaction_id,
      parsed.amount,
      parsed.phone,
      parsed.codigo_verificacion,
      parsed.message,
      parsed.timestamp,
      parsed.transaction_id
    ]);
    
    // Enviar al webhook interno
    const backendUrl = process.env.BACKEND_URL || 'https://proyectovi-abackend-production.up.railway.app';
    const webhookUrl = `${backendUrl}/api/yape/webhook`;
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Pushbullet-Source': 'true'
        },
        body: JSON.stringify(parsed)
      });
      
      const result = await response.json();
      console.log('✅ Webhook response:', result);
      
      const estado = result.success ? 'CONFIRMADO' : (result.error ? 'ERROR_WEBHOOK' : 'PROCESADO');
      await db.execute(`
        UPDATE transacciones_yape 
        SET estado = ?, fecha_recepcion = NOW()
        WHERE transaction_id = ?
      `, [estado, parsed.transaction_id]);
      
      return result;
      
    } catch (error) {
      console.error('❌ Error enviando a webhook:', error.message);
      await db.execute(`
        UPDATE transacciones_yape 
        SET estado = 'ERROR_ENVIO', mensaje = CONCAT(mensaje, ' - Error: ', ?)
        WHERE transaction_id = ?
      `, [error.message, parsed.transaction_id]);
      return null;
    }
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