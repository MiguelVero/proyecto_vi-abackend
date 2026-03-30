// src/routes/lote.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getLotes, 
  getLoteById, 
  createLote, 
  updateLote, 
  deleteLote 
} from "../controllers/lote.controller.js";

const router = express.Router();

// Rutas para lotes (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'lotes'), getLotes);
router.get("/:id", verifyToken, requireRole([1, 4], 'lotes'), getLoteById);
router.post("/", verifyToken, requireRole([1, 4], 'lotes'), createLote);
router.put("/:id", verifyToken, requireRole([1, 4], 'lotes'), updateLote);
router.delete("/:id", verifyToken, requireRole([1, 4], 'lotes'), deleteLote);

export default router;