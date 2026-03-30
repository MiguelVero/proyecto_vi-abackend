import db from "../config/db.js";

export const getCategorias = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM categorias");
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener categorías:", error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

export const getCategoriaById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query("SELECT * FROM categorias WHERE id_categoria = ?", [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error("Error al obtener categoría:", error);
    res.status(500).json({ message: "Error al obtener categoría" });
  }
};

export const createCategoria = async (req, res) => {
  try {
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    // Verificar si ya existe una categoría con el mismo nombre
    const [existing] = await db.query("SELECT id_categoria FROM categorias WHERE nombre = ?", [nombre]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Ya existe una categoría con este nombre" });
    }

    const [result] = await db.query("INSERT INTO categorias (nombre) VALUES (?)", [nombre]);
    
    res.status(201).json({
      id_categoria: result.insertId,
      nombre,
      message: "Categoría creada exitosamente"
    });
  } catch (error) {
    console.error("Error al crear categoría:", error);
    res.status(500).json({ message: "Error al crear categoría" });
  }
};

export const updateCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    // Verificar si la categoría existe
    const [existing] = await db.query("SELECT id_categoria FROM categorias WHERE id_categoria = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    // Verificar si ya existe otra categoría con el mismo nombre
    const [duplicate] = await db.query(
      "SELECT id_categoria FROM categorias WHERE nombre = ? AND id_categoria != ?", 
      [nombre, id]
    );
    if (duplicate.length > 0) {
      return res.status(409).json({ message: "Ya existe otra categoría con este nombre" });
    }

    await db.query("UPDATE categorias SET nombre = ? WHERE id_categoria = ?", [nombre, id]);
    
    res.json({
      id_categoria: parseInt(id),
      nombre,
      message: "Categoría actualizada exitosamente"
    });
  } catch (error) {
    console.error("Error al actualizar categoría:", error);
    res.status(500).json({ message: "Error al actualizar categoría" });
  }
};

export const deleteCategoria = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si la categoría existe
    const [existing] = await db.query("SELECT id_categoria FROM categorias WHERE id_categoria = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    // Verificar si hay productos asociados a esta categoría
    const [products] = await db.query("SELECT id_producto FROM producto WHERE id_categoria = ?", [id]);
    if (products.length > 0) {
      return res.status(409).json({ 
        message: "No se puede eliminar la categoría porque tiene productos asociados" 
      });
    }

    await db.query("DELETE FROM categorias WHERE id_categoria = ?", [id]);
    
    res.json({ message: "Categoría eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar categoría:", error);
    res.status(500).json({ message: "Error al eliminar categoría" });
  }
};