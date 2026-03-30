// src/routes/producto.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getProductos, 
  getProductoById, 
  createProducto, 
  updateProducto, 
  deleteProducto 
} from "../controllers/producto.controller.js";

const router = express.Router();

// Rutas de productos con validación de módulo
router.get("/", verifyToken, requireRole([1, 2, 4], 'productos'), getProductos);
router.get("/:id", verifyToken, requireRole([1, 2, 4], 'productos'), getProductoById);

// Rutas protegidas para modificación (solo Admin y Almacenero)
router.post("/", verifyToken, requireRole([1, 4], 'productos'), createProducto);
router.put("/:id", verifyToken, requireRole([1, 4], 'productos'), updateProducto);
router.delete("/:id", verifyToken, requireRole([1], 'productos'), deleteProducto); // Solo Admin

export default router;