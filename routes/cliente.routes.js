// src/routes/cliente.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js"; // ← Importar middleware
import { 
  getClientes, 
  getClienteById, 
  createCliente, 
  updateCliente, 
  deleteCliente 
} from "../controllers/cliente.controller.js";

const router = express.Router();

// Aplicar autenticación a TODAS las rutas de clientes
router.use(verifyToken);

// Rutas específicas con control de roles
router.get("/", requireRole([1, 2]), getClientes); // Admin y Vendedor
router.get("/:id", requireRole([1, 2]), getClienteById);
router.post("/", requireRole([1, 2]), createCliente); // Ambos pueden crear
router.put("/:id", requireRole([1]), updateCliente); // Solo Admin puede editar
router.delete("/:id", requireRole([1]), deleteCliente); // Solo Admin puede eliminar

export default router;