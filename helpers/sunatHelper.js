// src/helpers/sunatHelper.js
/**
 * HELPER FUNCTIONS PARA SUNAT
 * Funciones auxiliares para validación y formateo
 */

/**
 * Validar DNI peruano
 */
export const validarDNI = (dni) => {
  if (!dni || typeof dni !== 'string') return false;
  
  const dniLimpio = dni.trim().replace(/\D/g, '');
  if (dniLimpio.length !== 8) return false;
  
  // Validar dígito verificador (algoritmo RENIEC)
  const digitos = dniLimpio.split('').map(Number);
  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    suma += digitos[i] * weights[i];
  }
  
  const residuo = suma % 11;
  const dv = residuo === 0 ? 0 : residuo === 1 ? 9 : 11 - residuo;
  
  return dv === digitos[7];
};

/**
 * Validar RUC peruano
 */
export const validarRUC = (ruc) => {
  if (!ruc || typeof ruc !== 'string') return false;
  
  const rucLimpio = ruc.trim().replace(/\D/g, '');
  if (rucLimpio.length !== 11) return false;
  
  // Validar dígito verificador (algoritmo SUNAT)
  const digitos = rucLimpio.split('').map(Number);
  
  // Validación de dígito verificador RUC
  const weights1 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let suma1 = 0;
  for (let i = 0; i < 10; i++) {
    suma1 += digitos[i] * weights1[i];
  }
  
  const dv1 = 11 - (suma1 % 11);
  const primerDV = dv1 === 11 ? 0 : dv1 === 10 ? 9 : dv1;
  
  return primerDV === digitos[10];
};

/**
 * Detectar tipo de documento
 * @param {string} numero - Número de documento
 * @returns {string} 'DNI' | 'RUC' | 'INVALIDO'
 */
export const detectarTipoDocumento = (numero) => {
  const limpiar = numero.trim().replace(/\D/g, '');
  
  if (limpiar.length === 8 && validarDNI(limpiar)) {
    return 'DNI';
  }
  if (limpiar.length === 11 && validarRUC(limpiar)) {
    return 'RUC';
  }
  
  return 'INVALIDO';
};

/**
 * Formatear DNI (añadir separadores)
 */
export const formatearDNI = (dni) => {
  const limpiar = dni.replace(/\D/g, '');
  if (limpiar.length !== 8) return dni;
  return `${limpiar.substring(0, 2)}-${limpiar.substring(2)}`;
};

/**
 * Formatear RUC (añadir separadores)
 */
export const formatearRUC = (ruc) => {
  const limpiar = ruc.replace(/\D/g, '');
  if (limpiar.length !== 11) return ruc;
  return `${limpiar.substring(0, 2)}-${limpiar.substring(2, 10)}-${limpiar.substring(10)}`;
};

/**
 * Limpiar número de documento (solo dígitos)
 */
export const limpiarNumeroDocumento = (numero) => {
  return numero.trim().replace(/\D/g, '');
};

/**
 * Validar monto (positivo, con hasta 2 decimales)
 */
export const validarMonto = (monto) => {
  const m = parseFloat(monto);
  return !isNaN(m) && m > 0 && (m * 100) % 1 === 0;
};

/**
 * Redondear a 2 decimales
 */
export const redondear2Decimales = (numero) => {
  return Math.round(numero * 100) / 100;
};

/**
 * Calcular IGV (18%)
 */
export const calcularIGV = (subtotal) => {
  return redondear2Decimales(subtotal * 0.18);
};

/**
 * Calcular total con IGV
 */
export const calcularTotalConIGV = (subtotal) => {
  return redondear2Decimales(subtotal + calcularIGV(subtotal));
};

/**
 * Validar serie (max 10 caracteres, alphanumeric)
 */
export const validarSerie = (serie) => {
  if (!serie || typeof serie !== 'string') return false;
  if (serie.length > 10) return false;
  return /^[A-Z0-9]+$/.test(serie);
};

/**
 * Validar número correlativo (1-99999999)
 */
export const validarNumeroCorrelativo = (numero) => {
  const n = parseInt(numero);
  return !isNaN(n) && n >= 1 && n <= 99999999;
};

/**
 * Formatear número correlativo (con ceros a la izquierda)
 */
export const formatearNumeroCorrelativo = (numero) => {
  return String(numero).padStart(8, '0');
};

/**
 * Generar ID de comprobante (serie-numero)
 */
export const generarIDComprobante = (serie, numero) => {
  return `${serie}-${formatearNumeroCorrelativo(numero)}`;
};

/**
 * Parsear ID de comprobante
 */
export const parsearIDComprobante = (id) => {
  const [serie, numero] = id.split('-');
  return {
    serie,
    numero: parseInt(numero)
  };
};

/**
 * Validar fecha (YYYY-MM-DD)
 */
export const validarFecha = (fecha) => {
  if (!fecha || typeof fecha !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(fecha)) return false;
  
  const date = new Date(fecha);
  return date instanceof Date && !isNaN(date);
};

/**
 * Validar hora (HH:MM:SS)
 */
export const validarHora = (hora) => {
  if (!hora || typeof hora !== 'string') return false;
  const regex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
  return regex.test(hora);
};

/**
 * Validar email
 */
export const validarEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

/**
 * Validar teléfono peruano
 */
export const validarTelefono = (telefono) => {
  const limpio = telefono.replace(/\D/g, '');
  // Perú: 7 u 8 dígitos (fijo) o 9 (celular)
  return limpio.length === 7 || limpio.length === 8 || limpio.length === 9;
};

/**
 * Convertir estado numérico SUNAT a texto
 */
export const statusSUNATATexto = (codigo) => {
  const estados = {
    '0': 'Aceptado',
    '1': 'En procesamiento',
    '2': 'No procesable',
    '3': 'Fallo en validación',
    '99': 'Error en conexión'
  };
  
  return estados[String(codigo)] || 'Estado desconocido';
};

/**
 * Obtener mensaje de error SUNAT
 */
export const obtenerMensajeErrorSUNAT = (codigo) => {
  const errores = {
    'INVALID_USER': 'Usuario SUNAT inválido',
    'INVALID_CERT': 'Certificado digital no válido',
    'INVALID_XML': 'Formato XML incorrecto',
    'DUP_COMPROBANTE': 'Comprobante duplicado',
    'CLIENT_ERROR': 'Datos del cliente incorrecto',
    'RUC_DISABLED': 'RUC deshabilitado en SUNAT',
    'CERT_EXPIRED': 'Certificado expirado',
    'CONNECTION_ERROR': 'Error de conexión a SUNAT',
    'TIMEOUT': 'Tiempo de espera agotado'
  };
  
  return errores[codigo] || 'Error no identificado';
};

/**
 * Validación completa de comprobante
 */
export const validarComprobanteCompleto = (comprobante) => {
  const errores = [];
  
  // Validar cliente
  if (!comprobante.cliente) {
    errores.push('Cliente requerido');
  } else {
    if (!comprobante.cliente.numero_documento) {
      errores.push('Número de documento del cliente requerido');
    } else if (detectarTipoDocumento(comprobante.cliente.numero_documento) === 'INVALIDO') {
      errores.push('Número de documento inválido');
    }
    
    if (!comprobante.cliente.nombre_completo) {
      errores.push('Nombre del cliente requerido');
    }
  }
  
  // Validar detalles
  if (!comprobante.detalles || comprobante.detalles.length === 0) {
    errores.push('Debe haber al menos 1 línea de detalle');
  } else {
    comprobante.detalles.forEach((det, idx) => {
      if (!det.nombre) errores.push(`Línea ${idx + 1}: Nombre producto requerido`);
      if (!det.cantidad || det.cantidad <= 0) errores.push(`Línea ${idx + 1}: Cantidad inválida`);
      if (!det.precio || det.precio <= 0) errores.push(`Línea ${idx + 1}: Precio inválido`);
      if (!validarMonto(det.subtotal)) errores.push(`Línea ${idx + 1}: Subtotal inválido`);
    });
  }
  
  // Validar montos
  if (!comprobante.total || comprobante.total <= 0) {
    errores.push('Total debe ser mayor a 0');
  }
  
  return {
    valido: errores.length === 0,
    errores
  };
};

export default {
  validarDNI,
  validarRUC,
  detectarTipoDocumento,
  formatearDNI,
  formatearRUC,
  limpiarNumeroDocumento,
  validarMonto,
  redondear2Decimales,
  calcularIGV,
  calcularTotalConIGV,
  validarSerie,
  validarNumeroCorrelativo,
  formatearNumeroCorrelativo,
  generarIDComprobante,
  parsearIDComprobante,
  validarFecha,
  validarHora,
  validarEmail,
  validarTelefono,
  statusSUNATATexto,
  obtenerMensajeErrorSUNAT,
  validarComprobanteCompleto
};
