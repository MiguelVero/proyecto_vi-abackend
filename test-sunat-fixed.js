// backend_dsi6/test-sunat-fixed.js
import axios from 'axios';

async function testNodeToPHP() {
    console.log('🧪 Probando conexión Node.js → PHP...\n');
    
    try {
        const testData = {
            id_venta: 999,
            cliente: {
                tipo_cliente: 'Bodega',
                numero_documento: '20123456789',
                nombre: 'BODEGA TEST'
            },
            detalles: [{
                id_producto: 1,
                descripcion: 'BIDÓN AGUA TEST',
                cantidad: 2,
                precio_unitario: 59.00,
                subtotal: 118.00
            }],
            total: 118.00
        };

        console.log('📤 Enviando a PHP Fake...');
        
        // ¡IMPORTANTE! URL correcta - SIN /emitir.php al final
        const url = 'http://localhost:8000/src/endpoints/emitir_fake.php';
        console.log('URL:', url);
        
        const response = await axios.post(url, testData, {
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        console.log('✅ ÉXITO! Respuesta de PHP:');
        console.log('Status:', response.status);
        console.log('Success:', response.data.success);
        console.log('Comprobante:', response.data.comprobante);
        console.log('Hash:', response.data.sunat.hash);
        
        return response.data;

    } catch (error) {
        console.error('❌ Error completo:');
        console.error('Message:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            console.error('No response received. PHP server might be down.');
        } else {
            console.error('Request setup error:', error.message);
        }
        throw error;
    }
}

// Ejecutar prueba
testNodeToPHP()
    .then(() => console.log('\n🎉 Prueba completada!'))
    .catch(() => console.log('\n⚠️  Prueba fallida'));