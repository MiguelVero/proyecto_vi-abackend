import db from "../config/db.js";

export const getPaises = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id_pais as id, pais as nombre FROM pais");
    res.json(rows);
  } catch (error) {
    console.error("Error al obtener países:", error);
    res.status(500).json({ message: "Error al obtener países" });
  }
};