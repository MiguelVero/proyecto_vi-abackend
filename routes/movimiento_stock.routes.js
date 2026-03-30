// src/routes/movimiento_stock.routes.js
import express from "express";
import { verifyToken, requireRole } from "../middleware/auth.js";
import { 
  getMovimientos, 
  getMovimientosByProducto, 
  createMovimiento,
  updateMovimiento,
  deleteMovimiento,
   verificarLotesProducto,
  obtenerStockRealProducto,
  corregirStockProducto,
  verificarSincronizacionStock
} from "../controllers/movimiento_stock.controller.js";

const router = express.Router();

// Rutas para movimientos de stock (solo Admin y Almacenero)
router.get("/", verifyToken, requireRole([1, 4], 'inventario_movimiento'), getMovimientos);
router.get("/producto/:id_producto", verifyToken, requireRole([1, 4], 'inventario_movimiento'), getMovimientosByProducto);
router.post("/", verifyToken, requireRole([1, 4], 'inventario_movimiento'), createMovimiento);
router.put("/:id", verifyToken, requireRole([1, 4], 'inventario_movimiento'), updateMovimiento);
router.delete("/:id", verifyToken, requireRole([1, 4], 'inventario_movimiento'), deleteMovimiento);
// ========== NUEVAS RUTAS PARA VERIFICACIÓN DE STOCK ==========
// Rutas públicas/para vendedores (solo lectura)
router.get("/producto/:id_producto/verificar", 
  verifyToken, 
  verificarLotesProducto
);

router.get("/producto/:id_producto/stock-real", 
  verifyToken, 
  obtenerStockRealProducto
);

// Rutas administrativas (solo Admin y Almacenero)
router.get("/stock/verificar-sincronizacion", 
  verifyToken, 
  requireRole([1, 4], 'inventario_movimiento'), 
  verificarSincronizacionStock
);

router.post("/stock/corregir/:id_producto", 
  verifyToken, 
  requireRole([1], 'inventario_movimiento'), // Solo Admin
  corregirStockProducto
);
export default router;