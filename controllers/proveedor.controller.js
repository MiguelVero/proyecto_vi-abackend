import db from "../config/db.js";

// Obtener todos los proveedores con información de persona
// Obtener todos los proveedores con información de persona
export const getProveedores = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.id_proveedor,
        p.id_persona,
        p.razon_social,
        p.activo,
        p.fecha_registro,
        per.nombre_completo,
        per.tipo_documento,
        per.numero_documento,
        per.telefono,
        per.direccion
      FROM proveedor p
      INNER JOIN persona per ON p.id_persona = per.id_persona
      ORDER BY p.fecha_registro DESC
    `);
    
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener proveedores:", error);
    res.status(500).json({ message: "Error al obtener proveedores" });
  }
};

export const getProveedorById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT 
        p.id_proveedor,
        p.id_persona,
        p.razon_social,
        p.activo,
        p.fecha_registro,
        per.nombre_completo,
        per.tipo_documento,
        per.numero_documento,
        per.telefono,
        per.direccion
      FROM proveedor p
      INNER JOIN persona per ON p.id_persona = per.id_persona
      WHERE p.id_proveedor = ?
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener proveedor:", error);
    res.status(500).json({ message: "Error al obtener proveedor" });
  }
};

export const createProveedor = async (req, res) => {
  try {
    const { 
      tipo_documento, 
      numero_documento, 
      nombre_completo, 
      telefono, 
      direccion, 
      razon_social, 
      activo = true 
    } = req.body;

    // Validaciones
    if (!razon_social || !nombre_completo) {
      return res.status(400).json({ message: "Razón social y nombre completo son obligatorios" });
    }

    // Verificar si ya existe una persona con el mismo documento
    if (numero_documento) {
      const [existingPerson] = await db.query(
        "SELECT id_persona FROM persona WHERE numero_documento = ?", 
        [numero_documento]
      );
      
      if (existingPerson.length > 0) {
        return res.status(409).json({ message: "Ya existe una persona con este documento" });
      }
    }

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // 1. Crear la persona
      const [personResult] = await connection.query(
        `INSERT INTO persona 
         (tipo_documento, numero_documento, nombre_completo, telefono, direccion, activo) 
         VALUES (?, ?, ?, ?, ?, 1)`,
        [tipo_documento || 'RUC', numero_documento, nombre_completo, telefono, direccion]
      );

      const id_persona = personResult.insertId;

      // 2. Crear el proveedor
      const [proveedorResult] = await connection.query(
        `INSERT INTO proveedor (id_persona, razon_social, activo) 
         VALUES (?, ?, ?)`,
        [id_persona, razon_social, activo]
      );

      await connection.commit();

      // Obtener el proveedor creado con los datos completos
      const [newProveedor] = await db.query(`
        SELECT 
          p.id_proveedor,
          p.id_persona,
          p.razon_social,
          p.activo,
          p.fecha_registro,
          per.nombre_completo,
          per.tipo_documento,
          per.numero_documento,
          per.telefono,
          per.direccion
        FROM proveedor p
        INNER JOIN persona per ON p.id_persona = per.id_persona
        WHERE p.id_proveedor = ?
      `, [proveedorResult.insertId]);

      res.status(201).json({
        ...newProveedor[0],
        message: "Proveedor creado exitosamente"
      });

    } catch (transactionError) {
      if (connection) await connection.rollback();
      throw transactionError;
    } finally {
      if (connection) connection.release();
    }

  } catch (error) {
    console.error("Error al crear proveedor:", error);
    res.status(500).json({ message: "Error al crear proveedor" });
  }
};

export const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      razon_social, 
      activo, 
      nombre_completo, 
      telefono, 
      direccion 
    } = req.body;

    // Verificar si el proveedor existe
    const [existing] = await db.query(
      "SELECT id_proveedor, id_persona FROM proveedor WHERE id_proveedor = ?", 
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    const id_persona = existing[0].id_persona;
    let connection;
    
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // Actualizar persona si se proporcionan datos
      if (nombre_completo || telefono || direccion) {
        const updatePersonFields = [];
        const updatePersonValues = [];
        
        if (nombre_completo) {
          updatePersonFields.push("nombre_completo = ?");
          updatePersonValues.push(nombre_completo);
        }
        if (telefono) {
          updatePersonFields.push("telefono = ?");
          updatePersonValues.push(telefono);
        }
        if (direccion) {
          updatePersonFields.push("direccion = ?");
          updatePersonValues.push(direccion);
        }

        if (updatePersonFields.length > 0) {
          updatePersonValues.push(id_persona);
          await connection.query(
            `UPDATE persona SET ${updatePersonFields.join(", ")} WHERE id_persona = ?`,
            updatePersonValues
          );
        }
      }

      // Actualizar proveedor
      const updateProveedorFields = [];
      const updateProveedorValues = [];
      
      if (razon_social !== undefined) {
        updateProveedorFields.push("razon_social = ?");
        updateProveedorValues.push(razon_social);
      }
      if (activo !== undefined) {
        updateProveedorFields.push("activo = ?");
        updateProveedorValues.push(activo);
      }

      if (updateProveedorFields.length > 0) {
        updateProveedorValues.push(id);
        await connection.query(
          `UPDATE proveedor SET ${updateProveedorFields.join(", ")} WHERE id_proveedor = ?`,
          updateProveedorValues
        );
      }

      await connection.commit();

      // Obtener el proveedor actualizado
      const [updatedProveedor] = await db.query(`
        SELECT 
          p.id_proveedor,
          p.id_persona,
          p.razon_social,
          p.activo,
          p.fecha_registro,
          per.nombre_completo,
          per.tipo_documento,
          per.numero_documento,
          per.telefono,
          per.direccion
        FROM proveedor p
        INNER JOIN persona per ON p.id_persona = per.id_persona
        WHERE p.id_proveedor = ?
      `, [id]);

      res.json({
        ...updatedProveedor[0],
        message: "Proveedor actualizado exitosamente"
      });

    } catch (transactionError) {
      if (connection) await connection.rollback();
      throw transactionError;
    } finally {
      if (connection) connection.release();
    }

  } catch (error) {
    console.error("Error al actualizar proveedor:", error);
    res.status(500).json({ message: "Error al actualizar proveedor" });
  }
};

export const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el proveedor existe
    const [existing] = await db.query(
      "SELECT id_proveedor FROM proveedor WHERE id_proveedor = ?", 
      [id]
    );
    
    if (existing.length === 0) {
      return res.status(404).json({ message: "Proveedor no encontrado" });
    }

    // Verificar si hay productos asociados a este proveedor
    const [products] = await db.query(
      "SELECT id_producto FROM producto WHERE id_proveedor = ?", 
      [id]
    );
    
    if (products.length > 0) {
      return res.status(409).json({ 
        message: "No se puede eliminar el proveedor porque tiene productos asociados" 
      });
    }

    // En lugar de eliminar, desactivar el proveedor
    await db.query(
      "UPDATE proveedor SET activo = FALSE WHERE id_proveedor = ?", 
      [id]
    );

    res.json({ message: "Proveedor desactivado exitosamente" });
  } catch (error) {
    console.error("Error al eliminar proveedor:", error);
    res.status(500).json({ message: "Error al eliminar proveedor" });
  }
};