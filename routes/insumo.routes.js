// src/routes/insumo.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getInsumos, 
  getInsumoById, 
  createInsumo, 
  updateInsumo, 
  deleteInsumo 
} from "../controllers/insumo.controller.js";

const router = express.Router();

// Rutas para insumos (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'pedido_proveedor'), getInsumos);
router.get("/:id", verifyToken, requireRole([1, 4], 'pedido_proveedor'), getInsumoById);
router.post("/", verifyToken, requireRole([1, 4], 'pedido_proveedor'), createInsumo);
router.put("/:id", verifyToken, requireRole([1, 4], 'pedido_proveedor'), updateInsumo);
router.delete("/:id", verifyToken, requireRole([1, 4], 'pedido_proveedor'), deleteInsumo);

export default router;