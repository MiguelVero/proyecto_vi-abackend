// src/controllers/insumo.controller.js - CORREGIDO
import db from "../config/db.js";

export const getInsumos = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        i.*, 
        pr.razon_social as proveedor_principal_nombre,
        pr.id_proveedor as proveedor_principal_id
      FROM insumo i
      LEFT JOIN proveedor pr ON i.id_proveedor_principal = pr.id_proveedor
      WHERE i.activo = 1
      ORDER BY i.nombre
    `);
    
    // Mapear para que el frontend reciba la estructura esperada
    const insumosMapeados = rows.map(insumo => ({
      id_insumo: insumo.id_insumo,
      nombre: insumo.nombre,
      descripcion: insumo.descripcion,
      unidad_medida: insumo.unidad_medida,
      costo_promedio: insumo.costo_promedio,
      stock_actual: insumo.stock_actual,
      stock_minimo: insumo.stock_minimo,
      id_proveedor_principal: insumo.id_proveedor_principal,
      activo: insumo.activo,
      fecha_creacion: insumo.fecha_creacion,
      // Estructura que espera el frontend
      proveedor_principal: insumo.proveedor_principal_nombre ? {
        razon_social: insumo.proveedor_principal_nombre,
        id_proveedor: insumo.proveedor_principal_id
      } : null
    }));
    
    res.json(insumosMapeados);
  } catch (error) {
    console.error("Error al obtener insumos:", error);
    res.status(500).json({ message: "Error al obtener insumos" });
  }
};

// También corregir getInsumoById
export const getInsumoById = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        i.*,
        pr.razon_social as proveedor_principal_nombre,
        pr.id_proveedor as proveedor_principal_id
      FROM insumo i
      LEFT JOIN proveedor pr ON i.id_proveedor_principal = pr.id_proveedor
      WHERE i.id_insumo = ? AND i.activo = 1`,
      [req.params.id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Insumo no encontrado" });
    }
    
    const insumo = rows[0];
    const insumoMapeado = {
      id_insumo: insumo.id_insumo,
      nombre: insumo.nombre,
      descripcion: insumo.descripcion,
      unidad_medida: insumo.unidad_medida,
      costo_promedio: insumo.costo_promedio,
      stock_actual: insumo.stock_actual,
      stock_minimo: insumo.stock_minimo,
      id_proveedor_principal: insumo.id_proveedor_principal,
      activo: insumo.activo,
      fecha_creacion: insumo.fecha_creacion,
      proveedor_principal: insumo.proveedor_principal_nombre ? {
        razon_social: insumo.proveedor_principal_nombre,
        id_proveedor: insumo.proveedor_principal_id
      } : null
    };
    
    res.json(insumoMapeado);
  } catch (error) {
    console.error("Error al obtener insumo:", error);
    res.status(500).json({ message: "Error al obtener insumo" });
  }
};

export const createInsumo = async (req, res) => {
  try {
    const { nombre, descripcion, unidad_medida, costo_promedio, stock_minimo, id_proveedor_principal } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO insumo 
       (nombre, descripcion, unidad_medida, costo_promedio, stock_minimo, id_proveedor_principal) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, descripcion, unidad_medida, costo_promedio, stock_minimo, id_proveedor_principal]
    );

    res.status(201).json({ 
      message: "Insumo creado correctamente",
      id_insumo: result.insertId
    });
  } catch (error) {
    console.error("Error al crear insumo:", error);
    res.status(500).json({ message: "Error al crear insumo" });
  }
};

export const updateInsumo = async (req, res) => {
  try {
    const { nombre, descripcion, unidad_medida, costo_promedio, stock_minimo, id_proveedor_principal, activo } = req.body;
    
    await db.query(
      `UPDATE insumo 
       SET nombre = ?, descripcion = ?, unidad_medida = ?, costo_promedio = ?, 
           stock_minimo = ?, id_proveedor_principal = ?, activo = ?
       WHERE id_insumo = ?`,
      [nombre, descripcion, unidad_medida, costo_promedio, stock_minimo, id_proveedor_principal, activo, req.params.id]
    );

    res.json({ 
      message: "Insumo actualizado correctamente" 
    });
  } catch (error) {
    console.error("Error al actualizar insumo:", error);
    res.status(500).json({ message: "Error al actualizar insumo" });
  }
};

export const deleteInsumo = async (req, res) => {
  try {
    await db.query(
      "UPDATE insumo SET activo = 0 WHERE id_insumo = ?",
      [req.params.id]
    );

    res.json({ 
      message: "Insumo eliminado correctamente" 
    });
  } catch (error) {
    console.error("Error al eliminar insumo:", error);
    res.status(500).json({ message: "Error al eliminar insumo" });
  }
};