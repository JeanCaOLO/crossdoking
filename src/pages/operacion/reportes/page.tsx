
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Import, ImportLine, PalletInventory } from '../../../lib/supabase';
import { useToast } from '../../../components/base/Toast';

interface FaltanteRow {
  import_id: string;
  import_name: string;
  sku: string;
  descripcion: string;
  tienda: string;
  qty_to_send: number;
  qty_confirmed: number;
  faltante: number;
  pallet_code: string;
}

interface SobranteRow {
  pallet_id: string;
  pallet_code: string;
  sku: string;
  qty_available: number;
  tiene_demanda: boolean;
  import_id?: string;
  import_name?: string;
}

export default function ReportesPage() {
  const { showToast } = useToast();
  const [imports, setImports] = useState<Import[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string>('all');
  const [faltantes, setFaltantes] = useState<FaltanteRow[]>([]);
  const [sobrantes, setSobrantes] = useState<SobranteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'faltantes' | 'sobrantes'>('faltantes');

  useEffect(() => {
    loadImports();
  }, []);

  useEffect(() => {
    if (selectedImportId) {
      loadReportes();
    }
  }, [selectedImportId]);

  const loadImports = async () => {
    try {
      const { data, error } = await supabase
        .from('imports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImports(data || []);

      if (data && data.length > 0) {
        setSelectedImportId('all');
      }
    } catch (error) {
      console.error('Error cargando imports:', error);
      showToast('error', 'Error', 'No se pudieron cargar las importaciones');
    }
  };

  const loadReportes = async () => {
    setLoading(true);
    try {
      await Promise.all([loadFaltantes(), loadSobrantes()]);
    } catch (error) {
      console.error('Error cargando reportes:', error);
      showToast('error', 'Error', 'No se pudieron cargar los reportes');
    } finally {
      setLoading(false);
    }
  };

  const loadFaltantes = async () => {
    try {
      let query = supabase
        .from('import_lines')
        .select('*, imports!inner(id, file_name)')
        .lt('qty_confirmed', supabase.raw('qty_to_send'));

      if (selectedImportId !== 'all') {
        query = query.eq('import_id', selectedImportId);
      }

      const { data, error } = await query.order('tienda', { ascending: true });

      if (error) throw error;

      const faltantesData: FaltanteRow[] = (data || []).map((line: any) => ({
        import_id: line.import_id,
        import_name: line.imports.file_name,
        sku: line.sku,
        descripcion: line.descripcion,
        tienda: line.tienda,
        qty_to_send: line.qty_to_send,
        qty_confirmed: line.qty_confirmed,
        faltante: line.qty_to_send - line.qty_confirmed,
        pallet_code: line.pallet_code,
      }));

      setFaltantes(faltantesData);
    } catch (error) {
      console.error('Error cargando faltantes:', error);
      throw error;
    }
  };

  const loadSobrantes = async () => {
    try {
      let query = supabase
        .from('pallet_inventory')
        .select('*, pallets!inner(id, pallet_code, import_id), imports:pallets(imports(id, file_name))')
        .gt('qty_available', 0);

      const { data, error } = await query.order('pallet_code', { ascending: true });

      if (error) throw error;

      const sobrantesData: SobranteRow[] = [];

      for (const inv of data || []) {
        const pallet = inv.pallets as any;
        const importId = pallet.import_id;

        let tieneDemanda = false;
        if (importId) {
          const { data: demandaData } = await supabase
            .from('import_lines')
            .select('id')
            .eq('import_id', importId)
            .eq('sku', inv.sku)
            .lt('qty_confirmed', supabase.raw('qty_to_send'))
            .limit(1)
            .maybeSingle();

          tieneDemanda = !!demandaData;
        }

        if (selectedImportId === 'all' || importId === selectedImportId) {
          const importInfo = pallet.imports?.[0] || {};
          sobrantesData.push({
            pallet_id: inv.pallet_id,
            pallet_code: pallet.pallet_code,
            sku: inv.sku,
            qty_available: inv.qty_available,
            tiene_demanda: tieneDemanda,
            import_id: importId,
            import_name: importInfo.file_name,
          });
        }
      }

      setSobrantes(sobrantesData);
    } catch (error) {
      console.error('Error cargando sobrantes:', error);
      throw error;
    }
  };

  const exportToCSV = (type: 'faltantes' | 'sobrantes') => {
    try {
      let csvContent = '';
      let filename = '';

      if (type === 'faltantes') {
        csvContent = 'Import,SKU,Descripción,Tienda,Requerido,Confirmado,Faltante,Pallet\n';
        faltantes.forEach((row) => {
          // Escape double quotes in fields to keep CSV valid
          const importName = row.import_name.replace(/"/g, '""');
          const descripcion = row.descripcion.replace(/"/g, '""');
          const palletCode = row.pallet_code.replace(/"/g, '""');

          csvContent += `"${importName}","${row.sku}","${descripcion}","${row.tienda}",${row.qty_to_send},${row.qty_confirmed},${row.faltante},"${palletCode}"\n`;
        });
        filename = `faltantes_${selectedImportId}_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        csvContent = 'Import,Pallet,SKU,Cantidad Sobrante,Tiene Demanda\n';
        sobrantes.forEach((row) => {
          // Ensure proper fallback string and escape quotes
          const importName = (row.import_name || 'N/A').replace(/"/g, '""');
          const palletCode = row.pallet_code.replace(/"/g, '""');

          csvContent += `"${importName}","${palletCode}","${row.sku}",${row.qty_available},${row.tiene_demanda ? 'Sí' : 'No'}\n`;
        });
        filename = `sobrantes_${selectedImportId}_${new Date().toISOString().split('T')[0]}.csv`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('success', 'Exportado', `Archivo ${filename} descargado correctamente`);
    } catch (error) {
      console.error('Error exportando CSV:', error);
      showToast('error', 'Error', 'No se pudo exportar el archivo');
    }
  };

  const totalFaltantes = faltantes.reduce((sum, row) => sum + row.faltante, 0);
  const totalSobrantes = sobrantes.reduce((sum, row) => sum + row.qty_available, 0);
  const sobrantesSinDemanda = sobrantes.filter((s) => !s.tiene_demanda);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/operacion"
          className="text-teal-600 hover:text-teal-700 text-sm font-medium mb-3 inline-flex items-center cursor-pointer"
        >
          <i className="ri-arrow-left-line mr-1"></i>
          Volver a Operación
        </Link>
        <h2 className="text-2xl font-bold text-gray-900 mt-1">Reportes de Distribución</h2>
        <p className="text-sm text-gray-500 mt-1">Análisis de faltantes y sobrantes por importación</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium text-gray-700">Filtrar por Importación:</label>
          <select
            value={selectedImportId}
            onChange={(e) => setSelectedImportId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer min-w-[300px]"
          >
            <option value="all">Todas las importaciones</option>
            {imports.map((imp) => (
              <option key={imp.id} value={imp.id}>
                {imp.file_name} - {new Date(imp.created_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Total Faltantes</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{totalFaltantes}</p>
                <p className="text-xs text-red-600 mt-1">{faltantes.length} líneas</p>
              </div>
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                <i className="ri-error-warning-line text-2xl text-red-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700">Total Sobrantes</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{totalSobrantes}</p>
                <p className="text-xs text-amber-600 mt-1">{sobrantes.length} líneas</p>
              </div>
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                <i className="ri-inbox-line text-2xl text-amber-600"></i>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Sin Demanda</p>
                <p className="text-3xl font-bold text-gray-600 mt-1">{sobrantesSinDemanda.length}</p>
                <p className="text-xs text-gray-600 mt-1">SKUs sin pedido</p>
              </div>
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                <i className="ri-question-line text-2xl text-gray-600"></i>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('faltantes')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'faltantes'
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <i className="ri-error-warning-line mr-2"></i>
              Faltantes ({faltantes.length})
            </button>
            <button
              onClick={() => setActiveTab('sobrantes')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'sobrantes'
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <i className="ri-inbox-line mr-2"></i>
              Sobrantes ({sobrantes.length})
            </button>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
            </div>
          ) : (
            <>
              {activeTab === 'faltantes' ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Productos Faltantes
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (Requerido &gt; Confirmado)
                      </span>
                    </h3>
                    <button
                      onClick={() => exportToCSV('faltantes')}
                      disabled={faltantes.length === 0}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-download-line mr-2"></i>
                      Exportar CSV
                    </button>
                  </div>

                  {faltantes.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="ri-checkbox-circle-line text-3xl text-emerald-600"></i>
                      </div>
                      <p className="text-gray-600 font-medium">No hay faltantes</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Todas las líneas han sido completadas
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Import
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              SKU
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Descripción
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Tienda
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Requerido
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Confirmado
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Faltante
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Pallet
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {faltantes.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">{row.import_name}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.sku}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{row.descripcion}</td>
                              <td className="px-4 py-3 text-sm">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
                                  {row.tienda}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-700">
                                {row.qty_to_send}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-teal-600 font-medium">
                                {row.qty_confirmed}
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                  {row.faltante}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{row.pallet_code}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Productos Sobrantes
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        (Inventario disponible &gt; 0)
                      </span>
                    </h3>
                    <button
                      onClick={() => exportToCSV('sobrantes')}
                      disabled={sobrantes.length === 0}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-download-line mr-2"></i>
                      Exportar CSV
                    </button>
                  </div>

                  {sobrantes.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="ri-checkbox-circle-line text-3xl text-emerald-600"></i>
                      </div>
                      <p className="text-gray-600 font-medium">No hay sobrantes</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Todo el inventario ha sido distribuido
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Import
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Pallet
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              SKU
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Cantidad Sobrante
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                              Estado
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sobrantes.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-700">
                                {row.import_name || 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {row.pallet_code}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{row.sku}</td>
                              <td className="px-4 py-3 text-sm text-center">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                  {row.qty_available}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-center">
                                {row.tiene_demanda ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                    <i className="ri-shopping-cart-line mr-1"></i>
                                    Con demanda
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                    <i className="ri-close-circle-line mr-1"></i>
                                    Sin demanda
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
