import express from "express";
import { getPaises } from "../controllers/pais.controller.js";

const router = express.Router();

router.get("/", getPaises);

export default router;