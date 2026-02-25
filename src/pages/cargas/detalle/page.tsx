import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase, Import, ImportLine } from '../../../lib/supabase';

export default function DetalleCargaPage() {
  const { id } = useParams();
  const [importData, setImportData] = useState<Import | null>(null);
  const [lines, setLines] = useState<ImportLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    pallet: '',
    sku: '',
    tienda: '',
    camion: '',
    status: 'all',
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const loadData = async () => {
    try {
      const { data: imp, error: impError } = await supabase
        .from('imports')
        .select('*')
        .eq('id', id)
        .single();

      if (impError) throw impError;
      setImportData(imp);

      const { data: linesData, error: linesError } = await supabase
        .from('import_lines')
        .select('*')
        .eq('import_id', id)
        .order('created_at', { ascending: true });

      if (linesError) throw linesError;
      setLines(linesData || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLines = lines.filter((line) => {
    if (filters.pallet && !line.pallet_code.toLowerCase().includes(filters.pallet.toLowerCase())) return false;
    if (filters.sku && !line.sku.toLowerCase().includes(filters.sku.toLowerCase())) return false;
    if (filters.tienda && !line.tienda.toLowerCase().includes(filters.tienda.toLowerCase())) return false;
    if (filters.camion && !line.camion.toLowerCase().includes(filters.camion.toLowerCase())) return false;
    if (filters.status !== 'all' && line.status !== filters.status) return false;
    return true;
  });

  const skuProgress = lines.reduce((acc: any, line) => {
    if (!acc[line.sku]) {
      acc[line.sku] = {
        sku: line.sku,
        descripcion: line.descripcion,
        total: 0,
        confirmed: 0,
      };
    }
    acc[line.sku].total += line.qty_to_send;
    acc[line.sku].confirmed += line.qty_confirmed;
    return acc;
  }, {});

  const skuStats = Object.values(skuProgress).map((stat: any) => ({
    ...stat,
    percentage: stat.total > 0 ? Math.round((stat.confirmed / stat.total) * 100) : 0,
    pending: stat.total - stat.confirmed,
  }));

  const camionProgress = lines.reduce((acc: any, line) => {
    const camion = line.camion || 'Sin Camión';
    if (!acc[camion]) {
      acc[camion] = {
        camion,
        total: 0,
        confirmed: 0,
      };
    }
    acc[camion].total += line.qty_to_send;
    acc[camion].confirmed += line.qty_confirmed;
    return acc;
  }, {});

  const camionStats = Object.values(camionProgress).map((stat: any) => ({
    ...stat,
    percentage: stat.total > 0 ? Math.round((stat.confirmed / stat.total) * 100) : 0,
    pending: stat.total - stat.confirmed,
  }));

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: 'bg-amber-100 text-amber-700',
      PARTIAL: 'bg-blue-100 text-blue-700',
      DONE: 'bg-green-100 text-green-700',
    };
    const labels = {
      PENDING: 'Pendiente',
      PARTIAL: 'Parcial',
      DONE: 'Completado',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/cargas" className="text-teal-600 hover:text-teal-700 text-sm font-medium mb-3 inline-flex items-center cursor-pointer">
          <i className="ri-arrow-left-line mr-1"></i>
          Volver a Cargas
        </Link>
        <h2 className="text-xl font-bold text-gray-900 mt-1">{importData?.file_name}</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {importData?.completed_lines} / {importData?.total_lines} líneas completadas
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Progreso por Camión</h3>
        <div className="space-y-3">
          {camionStats.map((stat: any) => (
            <div key={stat.camion} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{stat.camion}</h4>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {stat.confirmed} / {stat.total}
                  </p>
                  <p className="text-xs text-gray-500">Faltante: {stat.pending}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${stat.percentage}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700 w-10 text-right">{stat.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Progreso por SKU</h3>
        <div className="space-y-3">
          {skuStats.map((stat: any) => (
            <div key={stat.sku} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{stat.sku}</h4>
                  <p className="text-xs text-gray-500">{stat.descripcion}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {stat.confirmed} / {stat.total}
                  </p>
                  <p className="text-xs text-gray-500">Faltante: {stat.pending}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div
                    className="bg-gradient-to-r from-teal-500 to-cyan-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${stat.percentage}%` }}
                  ></div>
                </div>
                <span className="text-xs font-medium text-gray-700 w-10 text-right">{stat.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="Filtrar por Pallet"
              value={filters.pallet}
              onChange={(e) => setFilters({ ...filters, pallet: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              placeholder="Filtrar por SKU"
              value={filters.sku}
              onChange={(e) => setFilters({ ...filters, sku: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              placeholder="Filtrar por Tienda"
              value={filters.tienda}
              onChange={(e) => setFilters({ ...filters, tienda: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            <input
              type="text"
              placeholder="Filtrar por Camión"
              value={filters.camion}
              onChange={(e) => setFilters({ ...filters, camion: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="PENDING">Pendiente</option>
              <option value="PARTIAL">Parcial</option>
              <option value="DONE">Completado</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pallet</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tienda</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camión</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">A Enviar</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confirmado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredLines.map((line) => (
                <tr key={line.id} className={line.status === 'DONE' ? 'bg-emerald-50/50' : ''}>
                  <td className="px-4 py-3 text-sm text-gray-700">{line.pallet_code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{line.sku}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{line.descripcion}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{line.tienda}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{line.camion || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{line.qty_to_send}</td>
                  <td className="px-4 py-3 text-sm font-medium text-teal-600">{line.qty_confirmed}</td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(line.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
