import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import * as XLSX from 'xlsx';

export default function NuevaCargaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<any[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📁 ARCHIVO: Cambio detectado');
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      console.log('⚠️ ARCHIVO: No se seleccionó ningún archivo');
      return;
    }

    console.log('📁 ARCHIVO: Seleccionado -', selectedFile.name);
    setFile(selectedFile);
    setError('');

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      console.log('✅ ARCHIVO: Leído correctamente -', jsonData.length, 'filas');
      setPreview(jsonData.slice(0, 5));
    } catch (err) {
      console.error('❌ ARCHIVO: Error al leer -', err);
      setError('Error al leer el archivo Excel');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🚀 IMPORTAR: Iniciando proceso...');
    console.log('📋 IMPORTAR: File -', file?.name);
    console.log('👤 IMPORTAR: User -', user);
    
    if (!file) {
      console.log('⚠️ IMPORTAR: No hay archivo seleccionado');
      setError('Por favor selecciona un archivo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('1️⃣ IMPORTAR: Leyendo archivo Excel...');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
      console.log('✅ IMPORTAR: Excel leído -', jsonData.length, 'filas');

      console.log('2️⃣ IMPORTAR: Creando registro de importación...');
      const { data: importData, error: importError } = await supabase
        .from('imports')
        .insert({
          file_name: file.name,
          status: 'DRAFT',
          total_lines: jsonData.length,
          completed_lines: 0,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (importError) {
        console.error('❌ IMPORTAR: Error al crear import -', importError);
        throw importError;
      }
      console.log('✅ IMPORTAR: Import creado -', importData.id);

      console.log('3️⃣ IMPORTAR: Preparando líneas...');
      const lines = jsonData.map((row: any) => ({
        import_id: importData.id,
        expedicion: row.Expedicion || row.expedicion || '',
        pallet_code: row.Pallet || row.pallet || '',
        ubicacion: row.Ubicacion || row.ubicacion || '',
        sku: row.SKU || row.sku || '',
        barcode: row['Codigo de Barra'] || row['Código de Barra'] || row.barcode || row.codigo_barra || '',
        descripcion: row['Descripcion SKU'] || row.descripcion || '',
        cantidad_total: parseFloat(row['Cantidad Total'] || row.cantidad_total || 0),
        tienda: row.Tienda || row.tienda || '',
        qty_to_send: parseFloat(row['Cantidad a Enviar a la tienda'] || row.qty_to_send || 0),
        qty_confirmed: 0,
        status: 'PENDING',
        camion: row.Camion || row.camion || '',
      }));
      console.log('✅ IMPORTAR: Líneas preparadas -', lines.length);

      console.log('4️⃣ IMPORTAR: Insertando líneas en BD...');
      const { error: linesError } = await supabase.from('import_lines').insert(lines);

      if (linesError) {
        console.error('❌ IMPORTAR: Error al insertar líneas -', linesError);
        throw linesError;
      }
      console.log('✅ IMPORTAR: Líneas insertadas');

      console.log('5️⃣ IMPORTAR: Procesando pallets...');
      const uniquePallets = [...new Set(lines.map((l) => l.pallet_code))];
      console.log('📦 IMPORTAR: Pallets únicos -', uniquePallets.length);

      for (const palletCode of uniquePallets) {
        console.log('📦 IMPORTAR: Procesando pallet -', palletCode);
        const { data: existingPallet } = await supabase
          .from('pallets')
          .select('id')
          .eq('pallet_code', palletCode)
          .maybeSingle();

        if (!existingPallet) {
          console.log('📦 IMPORTAR: Creando nuevo pallet -', palletCode);
          const palletLines = lines.filter((l) => l.pallet_code === palletCode);
          const ubicacion = palletLines[0]?.ubicacion || '';

          const { data: newPallet, error: palletError } = await supabase
            .from('pallets')
            .insert({
              pallet_code: palletCode,
              ubicacion,
              status: 'OPEN',
            })
            .select()
            .single();

          if (palletError) {
            console.error('❌ IMPORTAR: Error al crear pallet -', palletError);
            throw palletError;
          }
          console.log('✅ IMPORTAR: Pallet creado -', newPallet.id);

          const skuGroups = palletLines.reduce((acc: any, line) => {
            if (!acc[line.sku]) {
              acc[line.sku] = 0;
            }
            acc[line.sku] += line.cantidad_total;
            return acc;
          }, {});

          const inventoryItems = Object.entries(skuGroups).map(([sku, qty]) => ({
            pallet_id: newPallet.id,
            sku,
            qty_initial: qty as number,
            qty_available: qty as number,
          }));

          console.log('📦 IMPORTAR: Insertando inventario -', inventoryItems.length, 'items');
          const { error: inventoryError } = await supabase.from('pallet_inventory').insert(inventoryItems);

          if (inventoryError) {
            console.error('❌ IMPORTAR: Error al insertar inventario -', inventoryError);
            throw inventoryError;
          }
          console.log('✅ IMPORTAR: Inventario insertado');
        } else {
          console.log('📦 IMPORTAR: Pallet ya existe -', palletCode);
        }
      }

      console.log('6️⃣ IMPORTAR: Actualizando estado a IN_PROGRESS...');
      await supabase.from('imports').update({ status: 'IN_PROGRESS' }).eq('id', importData.id);
      console.log('✅ IMPORTAR: Estado actualizado');

      console.log('7️⃣ IMPORTAR: Navegando a detalle...');
      navigate(`/cargas/${importData.id}`);
      console.log('🏁 IMPORTAR: Proceso completado exitosamente');
    } catch (err: any) {
      console.error('❌ IMPORTAR: Error general -', err);
      setError(err.message || 'Error al procesar el archivo');
    } finally {
      setLoading(false);
      console.log('🔚 IMPORTAR: Finalizando (loading = false)');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Formato del Excel</h2>
        <p className="text-xs text-gray-500 mb-3">El archivo debe contener las siguientes columnas:</p>
        <div className="bg-gray-50 rounded-lg p-3 text-xs font-mono text-gray-600">
          <div className="grid grid-cols-2 gap-1.5">
            <div>&bull; Expedicion</div>
            <div>&bull; Pallet</div>
            <div>&bull; Ubicacion</div>
            <div>&bull; SKU</div>
            <div>&bull; Codigo de Barra</div>
            <div>&bull; Descripcion SKU</div>
            <div>&bull; Cantidad Total</div>
            <div>&bull; Tienda</div>
            <div>&bull; Cantidad a Enviar a la tienda</div>
            <div>&bull; Camion</div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-5">
            {error}
          </div>
        )}

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Archivo Excel</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            required
          />
        </div>

        {preview.length > 0 && (
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Vista previa (primeras 5 filas)</h3>
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(preview[0]).map((key) => (
                      <th key={key} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {preview.map((row, idx) => (
                    <tr key={idx}>
                      {Object.values(row).map((val: any, i) => (
                        <td key={i} className="px-3 py-2 whitespace-nowrap text-gray-700 text-xs">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/cargas')}
            className="px-5 py-2.5 border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!file || loading}
            className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
          >
            {loading ? 'Procesando...' : 'Importar'}
          </button>
        </div>
      </form>
    </div>
  );
}
