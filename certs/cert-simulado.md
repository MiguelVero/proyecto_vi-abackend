# Certificado SUNAT Simulado

Para desarrollo y pruebas, el sistema funciona SIN certificado real.

Cuando el cliente obtenga su certificado SUNAT real:

1. **Obtener certificado de SUNAT:**
   - Portal: https://www.sunat.gob.pe/
   - Solicitar certificado digital .pfx o .p12

2. **Desactivar modo simulación:**
# .env futuro (solo cambiar estas 4 líneas)
   En el archivo `.env` cambiar:
SUNAT_SIMULAR=false                   # ← Modo simulación DESACTIVADO
SUNAT_AMBIENTE=produccion             # ← Ambiente real de SUNAT
3. **Copiar certificado real:**
cp /ruta/del/certificado/real.pfx ./certs/cert.pfx
SUNAT_CERT_PATH=./certs/certificado-real.pfx  # ← Certificado REAL
4. **Actualizar contraseña:**
SUNAT_CERT_PASSWORD=ContraseñaReal123# ← Contraseña REAL del certificado

