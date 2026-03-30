import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getMarcas, 
  getMarcaById, 
  createMarca, 
  updateMarca, 
  deleteMarca 
} from "../controllers/marca.controller.js";

const router = express.Router();

// Rutas para marcas (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'marcas'), getMarcas);
router.get("/:id", verifyToken, requireRole([1, 4], 'marcas'), getMarcaById);
router.post("/", verifyToken, requireRole([1, 4], 'marcas'), createMarca);
router.put("/:id", verifyToken, requireRole([1, 4], 'marcas'), updateMarca);
router.delete("/:id", verifyToken, requireRole([1, 4], 'marcas'), deleteMarca);

export default router;