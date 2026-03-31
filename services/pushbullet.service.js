// backend_dsi6/src/services/pushbullet.service.js
import fetch from 'node-fetch';
import db from '../config/db.js';

class PushbulletService {
  constructor() {
    this.accessToken = null;
    this.lastChecked = null;
    this.isRunning = false;
    this.interval = null;
    this.lastProcessedId = null;
  }

  /**
   * Inicializar el servicio con el token de acceso
   */
  init(token) {
    this.accessToken = token;
    console.log('🔧 PushbulletService inicializado');
  }

  /**
   * Obtener las notificaciones push recientes
   */
  async getRecentPushes(limit = 10) {
    if (!this.accessToken) {
      throw new Error('Pushbullet access token no configurado');
    }

    const url = new URL('https://api.pushbullet.com/v2/pushes');
    url.searchParams.append('active', 'true');
    url.searchParams.append('limit', limit.toString());
    // Ordenar por más reciente primero
    url.searchParams.append('modified_after', '0');

    const response = await fetch(url.toString(), {
      headers: {
        'Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Error fetching pushes: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.pushes || [];
  }

  /**
   * Extraer información de una notificación Yape
   * Formato típico de Yape:
   * "Yape: Confirmación de Pago"
   * "Michel Fum* te envió un pago por S/ 1. El cód. de seguridad es: 266"
   */
  parseYapeNotification(push) {
    // Verificar si es una notificación de Yape
    const isYape = push.title?.includes('Yape') || push.body?.includes('Yape');
    if (!isYape) {
      return null;
    }

    console.log('📱 Parseando notificación Yape:', {
      title: push.title,
      body: push.body,
      created: push.created
    });

    // Extraer monto (ej: "S/ 1" o "S/ 4.50")
    const montoMatch = push.body?.match(/S\/\s*(\d+(?:\.\d{1,2})?)/);
    const monto = montoMatch ? parseFloat(montoMatch[1]) : null;

    // Extraer código de seguridad de Yape (ej: "266")
    const codigoSeguridadMatch = push.body?.match(/cód\.? de seguridad es:\s*(\d+)/i);
    const codigoSeguridad = codigoSeguridadMatch ? codigoSeguridadMatch[1] : null;

    // Buscar código Yape de tu sistema (formato YP-260330-XXXX)
    const codigoYapeMatch = push.body?.match(/YP-\d{6}-\d{4}/);
    const codigoVerificacion = codigoYapeMatch ? codigoYapeMatch[0] : codigoSeguridad;

    // Extraer nombre del pagador (ej: "Michel Fum*")
    const pagadorMatch = push.body?.match(/^([^*]+)\*/);
    const pagador = pagadorMatch ? pagadorMatch[1].trim() : null;

    // Verificar si tiene datos suficientes
    if (!monto && !codigoVerificacion) {
      console.log('⚠️ Notificación Yape sin datos reconocibles:', push.body);
      return null;
    }

    return {
      transaction_id: push.iden, // Usar el ID de Pushbullet como identificador único
      amount: monto,
      phone: null, // Pushbullet no proporciona el teléfono
      message: push.body,
      status: 'completed',
      timestamp: push.created,
      customer_name: pagador,
      codigo_verificacion: codigoVerificacion,
      codigo_seguridad: codigoSeguridad,
      push_iden: push.iden,
      push_created: push.created
    };
  }

  /**
   * Verificar si una notificación ya fue procesada
   */
  async isAlreadyProcessed(pushId) {
    const [rows] = await db.execute(
      'SELECT id_transaccion FROM transacciones_yape WHERE transaction_id = ? OR push_id = ?',
      [pushId, pushId]
    );
    return rows.length > 0;
  }

  /**
   * Procesar una notificación y enviarla al webhook
   */
  async processYapeNotification(push) {
    const parsed = this.parseYapeNotification(push);
    if (!parsed || (!parsed.amount && !parsed.codigo_verificacion)) {
      return null;
    }
    
    // Verificar duplicados
    const alreadyProcessed = await this.isAlreadyProcessed(parsed.transaction_id);
    if (alreadyProcessed) {
      console.log('⚠️ Notificación ya procesada:', parsed.transaction_id);
      return null;
    }
    
    console.log('💰 Pago Yape detectado:', {
      monto: parsed.amount,
      codigo: parsed.codigo_verificacion,
      pagador: parsed.customer_name
    });
    
    // Guardar registro inicial en la base de datos
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
    
    // Obtener la URL base del backend
    const backendUrl = process.env.BACKEND_URL || 'https://proyectovi-abackend-production.up.railway.app';
    const webhookUrl = `${backendUrl}/api/yape/webhook`;
    
    try {
      // Enviar al webhook interno
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
      
      // Actualizar estado según respuesta
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
   * Ejecutar polling cada X segundos
   */
  async startPolling(intervalSeconds = 10) {
    if (this.isRunning) {
      console.log('⚠️ Polling ya está ejecutándose');
      return;
    }
    
    if (!this.accessToken) {
      console.error('❌ No se puede iniciar polling: token no configurado');
      return;
    }
    
    this.isRunning = true;
    console.log(`🚀 Iniciando polling de Pushbullet cada ${intervalSeconds} segundos`);
    
    const poll = async () => {
      try {
        const pushes = await this.getRecentPushes(15);
        
        if (pushes.length === 0) {
          return;
        }
        
        // Procesar solo las nuevas (más recientes primero)
        let newPushesFound = 0;
        
        for (const push of pushes) {
          // Si ya procesamos este ID, detener (los más recientes están al inicio)
          if (this.lastProcessedId === push.iden) {
            break;
          }
          
          // Si es una notificación Yape
          if (push.title?.includes('Yape') || push.body?.includes('Yape')) {
            await this.processYapeNotification(push);
            newPushesFound++;
          }
        }
        
        // Actualizar último procesado (el más reciente)
        if (pushes.length > 0) {
          this.lastProcessedId = pushes[0].iden;
        }
        
        if (newPushesFound > 0) {
          console.log(`📊 Procesadas ${newPushesFound} nuevas notificaciones Yape`);
        }
        
      } catch (error) {
        console.error('❌ Error en polling Pushbullet:', error.message);
      }
    };
    
    // Ejecutar inmediatamente y luego cada intervalo
    await poll();
    this.interval = setInterval(poll, intervalSeconds * 1000);
  }
  
  /**
   * Detener el polling
   */
  stopPolling() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('🛑 Polling de Pushbullet detenido');
    }
  }
  
  /**
   * Obtener estado actual
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasToken: !!this.accessToken,
      lastProcessedId: this.lastProcessedId,
      lastChecked: this.lastChecked
    };
  }
}

// Exportar instancia única
const pushbulletService = new PushbulletService();
export default pushbulletService;