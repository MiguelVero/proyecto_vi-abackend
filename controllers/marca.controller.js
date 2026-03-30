import db from "../config/db.js";

export const getMarcas = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM marcas");
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener marcas:", error);
    res.status(500).json({ message: "Error al obtener marcas" });
  }
};

export const getMarcaById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM marcas WHERE id_marca = ?", [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener marca:", error);
    res.status(500).json({ message: "Error al obtener marca" });
  }
};

export const createMarca = async (req, res) => {
  try {
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    // Verificar si ya existe una marca con el mismo nombre
    const [existing] = await db.query("SELECT id_marca FROM marcas WHERE nombre = ?", [nombre]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Ya existe una marca con este nombre" });
    }

    const [result] = await db.query("INSERT INTO marcas (nombre) VALUES (?)", [nombre]);
    
    res.status(201).json({
      id_marca: result.insertId,
      nombre,
      message: "Marca creada exitosamente"
    });
  } catch (error) {
    console.error("Error al crear marca:", error);
    res.status(500).json({ message: "Error al crear marca" });
  }
};

export const updateMarca = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    // Verificar si la marca existe
    const [existing] = await db.query("SELECT id_marca FROM marcas WHERE id_marca = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    // Verificar si ya existe otra marca con el mismo nombre
    const [duplicate] = await db.query(
      "SELECT id_marca FROM marcas WHERE nombre = ? AND id_marca != ?", 
      [nombre, id]
    );
    if (duplicate.length > 0) {
      return res.status(409).json({ message: "Ya existe otra marca con este nombre" });
    }

    await db.query("UPDATE marcas SET nombre = ? WHERE id_marca = ?", [nombre, id]);
    
    res.json({
      id_marca: parseInt(id),
      nombre,
      message: "Marca actualizada exitosamente"
    });
  } catch (error) {
    console.error("Error al actualizar marca:", error);
    res.status(500).json({ message: "Error al actualizar marca" });
  }
};

export const deleteMarca = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la marca existe
    const [existing] = await db.query("SELECT id_marca FROM marcas WHERE id_marca = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Marca no encontrada" });
    }

    // Verificar si hay productos asociados a esta marca
    const [products] = await db.query("SELECT id_producto FROM producto WHERE id_marca = ?", [id]);
    if (products.length > 0) {
      return res.status(409).json({ 
        message: "No se puede eliminar la marca porque tiene productos asociados" 
      });
    }

    await db.query("DELETE FROM marcas WHERE id_marca = ?", [id]);
    
    res.json({ message: "Marca eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar marca:", error);
    res.status(500).json({ message: "Error al eliminar marca" });
  }
};