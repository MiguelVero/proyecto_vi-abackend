// src/controllers/sunatController.js
import db from '../config/db.js';
import sunatService from '../services/sunatService.js';

/**
 * Generar comprobante (Boleta o Factura según tipo de cliente)
 */
export const generarComprobante = async (req, res) => {
  try {
    const { idVenta } = req.params;

    // 1. Obtener venta
    const [ventas] = await db.execute(
      `SELECT v.*, mp.metodo_pago 
       FROM venta v
       LEFT JOIN metodo_pago mp ON v.id_metodo_pago = mp.id_metodo_pago
       WHERE v.id_venta = ?`,
      [idVenta]
    );

    if (ventas.length === 0) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const venta = ventas[0];

    // 2. Obtener cliente y persona
    const [clientes] = await db.execute(
      `SELECT c.*, p.* 
       FROM cliente c
       INNER JOIN persona p ON c.id_persona = p.id_persona
       WHERE c.id_cliente = ?`,
      [venta.id_cliente]
    );

    if (clientes.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const cliente = clientes[0];

    // 3. Obtener detalles de venta
    const [detalles] = await db.execute(
      `SELECT vd.*, p.nombre, p.precio, p.id_producto
       FROM venta_detalle vd
       JOIN producto p ON vd.id_producto = p.id_producto
       WHERE vd.id_venta = ?`,
      [idVenta]
    );

    // 4. Determinar tipo de comprobante según tipo de documento
    const esRUC = cliente.tipo_documento === 'RUC';
    const tipo = esRUC ? 'FACTURA' : 'BOLETA';

    // 5. Generar XML
    let xmlObj;
    if (esRUC) {
      xmlObj = await sunatService.generarFactura(venta, detalles, cliente, cliente);
    } else {
      xmlObj = await sunatService.generarBoleta(venta, detalles, cliente, cliente);
    }

    // Convertir a string
    const xmlString = sunatService.xmlToString(xmlObj);

    // 6. Obtener serie
    const config = await sunatService.obtenerConfiguracion();
    const serie = esRUC ? config.serie_factura : config.serie_boleta;
    const numero = await sunatService.obtenerSiguienteNumero(tipo, serie);

    // 7. Guardar en BD
    const idComprobante = await sunatService.guardarComprobante(
      idVenta,
      tipo,
      serie,
      numero,
      xmlString,
      'GENERADO'
    );

    res.status(201).json({
      success: true,
      message: `${tipo} generada correctamente`,
      idComprobante,
      tipo,
      serie,
      numero: String(numero).padStart(8, '0'),
      xml: xmlString
    });

  } catch (error) {
    console.error('Error generarComprobante:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Enviar comprobante a SUNAT
 */
export const enviarComprobante = async (req, res) => {
  try {
    const { idComprobante } = req.params;
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Obtener configuración
    const config = await sunatService.obtenerConfiguracion();

    // Enviar a SUNAT
    const resultado = await sunatService.enviarASUNAT(idComprobante, usuario, password);

    res.json({
      success: true,
      message: 'Comprobante enviado a SUNAT',
      resultado
    });

  } catch (error) {
    console.error('Error enviarComprobante:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener estado de comprobante
 */
export const obtenerComprobante = async (req, res) => {
  try {
    const { idComprobante } = req.params;

    const [comprobantes] = await db.execute(
      `SELECT cs.*, v.id_cliente, v.total, v.fecha
       FROM comprobante_sunat cs
       JOIN venta v ON cs.id_venta = v.id_venta
       WHERE cs.id_comprobante = ?`,
      [idComprobante]
    );

    if (comprobantes.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    const comprobante = comprobantes[0];

    res.json({
      success: true,
      comprobante: {
        id: comprobante.id_comprobante,
        tipo: comprobante.tipo,
        serie: comprobante.serie,
        numero: String(comprobante.numero_secuencial).padStart(8, '0'),
        estado: comprobante.estado,
        fechaGeneracion: comprobante.fecha_generacion,
        fechaEnvio: comprobante.fecha_envio,
        intentosEnvio: comprobante.intentos_envio,
        respuestaSunat: comprobante.respuesta_sunat ? JSON.parse(comprobante.respuesta_sunat) : null
      }
    });

  } catch (error) {
    console.error('Error obtenerComprobante:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Listar comprobantes emitidos
 */
export const listarComprobantes = async (req, res) => {
  try {
    const { estado, tipo, limite = 50 } = req.query;

    let query = `
      SELECT cs.*, v.id_cliente, v.total, v.fecha, c.razon_social, p.nombre_completo
      FROM comprobante_sunat cs
      JOIN venta v ON cs.id_venta = v.id_venta
      JOIN cliente c ON v.id_cliente = c.id_cliente
      JOIN persona p ON c.id_persona = p.id_persona
      WHERE 1=1
    `;

    const params = [];

    if (estado) {
      query += ' AND cs.estado = ?';
      params.push(estado);
    }

    if (tipo) {
      query += ' AND cs.tipo = ?';
      params.push(tipo);
    }

    query += ' ORDER BY cs.fecha_generacion DESC LIMIT ?';
    params.push(parseInt(limite));

    const [comprobantes] = await db.execute(query, params);

    const formateados = comprobantes.map(c => ({
      id: c.id_comprobante,
      tipo: c.tipo,
      serie: c.serie,
      numero: String(c.numero_secuencial).padStart(8, '0'),
      cliente: c.razon_social || c.nombre_completo,
      total: c.total,
      estado: c.estado,
      fechaGeneracion: c.fecha_generacion,
      fechaEnvio: c.fecha_envio,
      intentosEnvio: c.intentos_envio
    }));

    res.json({
      success: true,
      total: formateados.length,
      comprobantes: formateados
    });

  } catch (error) {
    console.error('Error listarComprobantes:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Obtener configuración de SUNAT
 */
export const obtenerConfiguracion = async (req, res) => {
  try {
    const config = await sunatService.obtenerConfiguracion();

    res.json({
      success: true,
      configuracion: {
        ruc: config.ruc,
        nombreEmpresa: config.nombre_empresa,
        direccion: config.direccion,
        serieBoleta: config.serie_boleta,
        serieFactura: config.serie_factura,
        usuarioSunat: config.usuario_sunat,
        usuarioSOL: config.usuario_sol,
        ambiente: process.env.SUNAT_AMBIENTE || 'pruebas'
      }
    });

  } catch (error) {
    console.error('Error obtenerConfiguracion:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Actualizar configuración de SUNAT
 */
export const actualizarConfiguracion = async (req, res) => {
  try {
    const {
      ruc,
      nombreEmpresa,
      direccion,
      serieBoleta,
      serieFactura,
      usuarioSunat,
      usuarioSOL
    } = req.body;

    const resultado = await sunatService.actualizarConfiguracion({
      ruc,
      nombre_empresa: nombreEmpresa,
      direccion,
      serie_boleta: serieBoleta,
      serie_factura: serieFactura,
      usuario_sunat: usuarioSunat,
      usuario_sol: usuarioSOL
    });

    if (!resultado) {
      return res.status(500).json({ error: 'No se pudo actualizar la configuración' });
    }

    res.json({
      success: true,
      message: 'Configuración actualizada correctamente'
    });

  } catch (error) {
    console.error('Error actualizarConfiguracion:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reintentrar envío de comprobante
 */
export const reintentarEnvio = async (req, res) => {
  try {
    const { idComprobante } = req.params;
    const { usuario, password } = req.body;

    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Verificar número de intentos
    const [comprobantes] = await db.execute(
      'SELECT intentos_envio FROM comprobante_sunat WHERE id_comprobante = ?',
      [idComprobante]
    );

    if (comprobantes.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    if (comprobantes[0].intentos_envio >= 5) {
      return res.status(400).json({ 
        error: 'Se ha excedido el número máximo de reintentos (5)' 
      });
    }

    // Reintentar envío
    const resultado = await sunatService.enviarASUNAT(idComprobante, usuario, password);

    res.json({
      success: true,
      message: 'Comprobante reenviado',
      resultado
    });

  } catch (error) {
    console.error('Error reintentarEnvio:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Descargar XML del comprobante
 */
export const descargarXML = async (req, res) => {
  try {
    const { idComprobante } = req.params;

    const [comprobantes] = await db.execute(
      'SELECT xml_generado, tipo, serie, numero_secuencial FROM comprobante_sunat WHERE id_comprobante = ?',
      [idComprobante]
    );

    if (comprobantes.length === 0) {
      return res.status(404).json({ error: 'Comprobante no encontrado' });
    }

    const comp = comprobantes[0];
    const nombreArchivo = `${comp.tipo}_${comp.serie}_${String(comp.numero_secuencial).padStart(8, '0')}.xml`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(comp.xml_generado);

  } catch (error) {
    console.error('Error descargarXML:', error);
    res.status(500).json({ error: error.message });
  }
};

export default {
  generarComprobante,
  enviarComprobante,
  obtenerComprobante,
  listarComprobantes,
  obtenerConfiguracion,
  actualizarConfiguracion,
  reintentarEnvio,
  descargarXML
};
