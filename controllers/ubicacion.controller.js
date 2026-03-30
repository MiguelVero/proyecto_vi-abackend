import db from "../config/db.js";

// Obtener países
export const getPaises = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id_pais as id, pais as nombre FROM pais ORDER BY pais");
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener países:", error);
    res.status(500).json({ message: "Error al obtener países" });
  }
};

// Obtener departamentos por país
export const getDepartamentosByPais = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_departamento as id, departamento as nombre FROM departamento WHERE id_pais = ? ORDER BY departamento",
      [req.params.paisId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener departamentos:", error);
    res.status(500).json({ message: "Error al obtener departamentos" });
  }
};

// Obtener provincias por departamento
export const getProvinciasByDepartamento = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_provincia as id, provincia as nombre FROM provincia WHERE id_departamento = ? ORDER BY provincia",
      [req.params.departamentoId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener provincias:", error);
    res.status(500).json({ message: "Error al obtener provincias" });
  }
};

// Obtener distritos por provincia
export const getDistritosByProvincia = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id_distrito as id, distrito as nombre FROM distrito WHERE id_provincia = ? ORDER BY distrito",
      [req.params.provinciaId]
    );
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener distritos:", error);
    res.status(500).json({ message: "Error al obtener distritos" });
  }
};