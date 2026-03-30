import express from "express";
import {
  getPaises,
  getDepartamentosByPais,
  getProvinciasByDepartamento,
  getDistritosByProvincia,
} from "../controllers/ubicacion.controller.js";

const router = express.Router();

router.get("/paises", getPaises);
router.get("/departamentos/:paisId", getDepartamentosByPais);
router.get("/provincias/:departamentoId", getProvinciasByDepartamento);
router.get("/distritos/:provinciaId", getDistritosByProvincia);

export default router;