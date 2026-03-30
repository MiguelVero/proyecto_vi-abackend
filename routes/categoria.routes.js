import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getCategorias, 
  getCategoriaById, 
  createCategoria, 
  updateCategoria, 
  deleteCategoria 
} from "../controllers/categoria.controller.js";

const router = express.Router();

// Rutas para categorías (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'categorias'), getCategorias);
router.get("/:id", verifyToken, requireRole([1, 4], 'categorias'), getCategoriaById);
router.post("/", verifyToken, requireRole([1, 4], 'categorias'), createCategoria);
router.put("/:id", verifyToken, requireRole([1, 4], 'categorias'), updateCategoria);
router.delete("/:id", verifyToken, requireRole([1, 4], 'categorias'), deleteCategoria);

export default router;