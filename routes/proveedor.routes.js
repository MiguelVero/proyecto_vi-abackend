import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getProveedores, 
  getProveedorById, 
  createProveedor, 
  updateProveedor, 
  deleteProveedor 
} from "../controllers/proveedor.controller.js";

const router = express.Router();

// Rutas para proveedores (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'proveedores'), getProveedores);
router.get("/:id", verifyToken, requireRole([1, 4], 'proveedores'), getProveedorById);
router.post("/", verifyToken, requireRole([1, 4], 'proveedores'), createProveedor);
router.put("/:id", verifyToken, requireRole([1, 4], 'proveedores'), updateProveedor);
router.delete("/:id", verifyToken, requireRole([1, 4], 'proveedores'), deleteProveedor);

export default router;