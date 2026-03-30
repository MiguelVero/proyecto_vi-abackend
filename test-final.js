// backend_dsi6/test-final.js
import axios from 'axios';

const test = async () => {
    try {
        const response = await axios.post(
            'http://localhost:8000/src/endpoints/emitir_fake.php',
            {
                id_venta: 999,
                cliente: { tipo_cliente: 'Bodega', numero_documento: '20123456789', nombre: 'TEST' },
                detalles: [{ id_producto: 1, descripcion: 'TEST', cantidad: 2, precio_unitario: 59, subtotal: 118 }],
                total: 118
            },
            { headers: { 'Content-Type': 'application/json' } }
        );
        console.log('✅ ÉXITO:', response.data.success);
        console.log('Comprobante:', response.data.comprobante);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Detalles:', error.response?.data || error.code);
    }
};

test();