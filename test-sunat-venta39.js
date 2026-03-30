// backend_dsi6/test-sunat-venta39.js
import sunatService from './sunat/sunat.service.js';

async function testVenta39() {
    console.log('🧪 Probando SUNAT con venta ID 39...');
    
    try {
        // Verificar datos de la venta 39 primero
        console.log('🔍 Verificando venta 39 en BD...');
        
        const resultado = await sunatService.emitirComprobante(39);
        
        console.log('🎉 ✅ COMPROBANTE EMITIDO EXITOSAMENTE!');
        console.log('Resultado:', JSON.stringify(resultado, null, 2));
        
        // Verificar que se guardó en la BD
        console.log('\n🔍 Verificando registro en BD...');
        const [comprobantes] = await db.execute(
            'SELECT * FROM comprobante_sunat WHERE id_venta = 39 ORDER BY id_comprobante DESC LIMIT 1'
        );
        
        if (comprobantes.length > 0) {
            console.log('📊 Comprobante guardado en BD:');
            console.log('  ID:', comprobantes[0].id_comprobante);
            console.log('  Tipo:', comprobantes[0].tipo);
            console.log('  Serie-Número:', `${comprobantes[0].serie}-${comprobantes[0].numero_secuencial}`);
            console.log('  Estado:', comprobantes[0].estado);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Detalles:', error.stack);
    }
}

// Importar db para la verificación
import db from './config/db.js';

testVenta39();