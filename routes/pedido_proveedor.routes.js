// src/routes/pedido_proveedor.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getPedidosProveedor, 
  getPedidoProveedorById, 
  createPedidoProveedor, 
  updatePedidoProveedor, 
  deletePedidoProveedor,
  getEstadosPedido
} from "../controllers/pedido_proveedor.controller.js";

const router = express.Router();

// Rutas para pedidos a proveedor (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'pedido_proveedor'), getPedidosProveedor);
router.get("/estados", verifyToken, requireRole([1, 4], 'pedido_proveedor'), getEstadosPedido);
router.get("/:id", verifyToken, requireRole([1, 4], 'pedido_proveedor'), getPedidoProveedorById);
router.post("/", verifyToken, requireRole([1, 4], 'pedido_proveedor'), createPedidoProveedor);
router.put("/:id", verifyToken, requireRole([1, 4], 'pedido_proveedor'), updatePedidoProveedor);
router.delete("/:id", verifyToken, requireRole([1, 4], 'pedido_proveedor'), deletePedidoProveedor);

export default router;