import db from "../config/db.js";

// Obtener todos los clientes con información de persona
export const getClientes = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.id_cliente as id,
        p.tipo_documento,
        p.numero_documento as dni,
        p.nombre_completo as nombre,
        p.telefono,
        p.direccion,
        p.coordenadas,
        c.tipo_cliente,
        c.razon_social,
        p.nombre_completo,
        p.activo,
        p.fecha_registro
      FROM cliente c
      INNER JOIN persona p ON c.id_persona = p.id_persona
      WHERE c.activo = TRUE
      ORDER BY p.nombre_completo
    `);
    
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    res.status(500).json({ message: "Error al obtener clientes" });
  }
};

// Obtener cliente por ID
export const getClienteById = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        c.id_cliente as id,
        p.tipo_documento,
        p.numero_documento as dni,
        p.nombre_completo as nombre,
        p.telefono,
        p.direccion,
        p.coordenadas,
        c.tipo_cliente,
        c.razon_social,
        p.nombre_completo,
        p.activo,
        p.fecha_registro
      FROM cliente c
      INNER JOIN persona p ON c.id_persona = p.id_persona
      WHERE c.id_cliente = ? AND c.activo = TRUE
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    res.status(500).json({ message: "Error al obtener cliente" });
  }
};

// Crear nuevo cliente
// Crear nuevo cliente
export const createCliente = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const {
      tipo_documento,
      dni,
      nombre,
      telefono,
      direccion,
      coordenadas,
      tipo_cliente,
      razon_social
    } = req.body;

    // Validaciones básicas
    if (!nombre || !telefono) {
      return res.status(400).json({ message: "Nombre y teléfono son requeridos" });
    }

    // Generar número de documento automático si está vacío
    let documentoFinal = dni;
    let tipoDocumentoFinal = tipo_documento;

    if (!documentoFinal || documentoFinal.trim() === '') {
      // Generar documento temporal único
      documentoFinal = `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      tipoDocumentoFinal = 'NO_ESPECIFICADO';
    }

    // 1. Insertar en tabla persona
    const [personaResult] = await connection.query(
      `INSERT INTO persona (tipo_documento, numero_documento, nombre_completo, telefono, direccion, coordenadas) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tipoDocumentoFinal, documentoFinal, nombre, telefono, direccion || '', coordenadas || null]
    );

    const personaId = personaResult.insertId;

    // 2. Insertar en tabla cliente
    const [clienteResult] = await connection.query(
      `INSERT INTO cliente (id_persona, tipo_cliente, razon_social) 
       VALUES (?, ?, ?)`,
      [personaId, tipo_cliente, razon_social || null]
    );

    await connection.commit();

    // Obtener el cliente recién creado para devolverlo
    const [nuevoCliente] = await connection.query(`
      SELECT 
        c.id_cliente as id,
        p.tipo_documento,
        p.numero_documento as dni,
        p.nombre_completo as nombre,
        p.telefono,
        p.direccion,
        p.coordenadas,
        c.tipo_cliente,
        c.razon_social,
        p.nombre_completo,
        p.activo,
        p.fecha_registro
      FROM cliente c
      INNER JOIN persona p ON c.id_persona = p.id_persona
      WHERE c.id_cliente = ?
    `, [clienteResult.insertId]);

    res.status(201).json({
      id: clienteResult.insertId,
      id_cliente: clienteResult.insertId,
      ...nuevoCliente[0],
      message: "Cliente creado correctamente"
    });

  } catch (error) {
    await connection.rollback();
    console.error("Error al crear cliente:", error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "El número de documento ya existe" });
    }
    
    res.status(500).json({ message: "Error al crear cliente" });
  } finally {
    connection.release();
  }
};

// Actualizar cliente
export const updateCliente = async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const {
      tipo_documento,
      dni,
      nombre,
      telefono,
      direccion,
      coordenadas,
      tipo_cliente,
      razon_social
    } = req.body;

    // 1. Obtener el id_persona del cliente
    const [clienteRows] = await connection.query(
      `SELECT id_persona FROM cliente WHERE id_cliente = ?`,
      [id]
    );

    if (clienteRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const personaId = clienteRows[0].id_persona;

    // 2. Actualizar tabla persona
    await connection.query(
      `UPDATE persona 
       SET tipo_documento = ?, numero_documento = ?, nombre_completo = ?, telefono = ?, direccion = ?, coordenadas = ?
       WHERE id_persona = ?`,
      [tipo_documento, dni, nombre, telefono, direccion, coordenadas || null, personaId]
    );

    // 3. Actualizar tabla cliente
    await connection.query(
      `UPDATE cliente 
       SET tipo_cliente = ?, razon_social = ?
       WHERE id_cliente = ?`,
      [tipo_cliente, razon_social || null, id]
    );

    await connection.commit();

    res.json({ message: "Cliente actualizado correctamente" });

  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar cliente:", error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "El número de documento ya existe" });
    }
    
    res.status(500).json({ message: "Error al actualizar cliente" });
  } finally {
    connection.release();
  }
};

// Eliminar cliente (borrado lógico)
export const deleteCliente = async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE cliente SET activo = FALSE WHERE id_cliente = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    res.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    res.status(500).json({ message: "Error al eliminar cliente" });
  }
};