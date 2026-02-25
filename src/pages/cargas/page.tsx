import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, Import } from '../../lib/supabase';

export default function CargasPage() {
  const [imports, setImports] = useState<Import[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadImports();
    const interval = setInterval(loadImports, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadImports = async () => {
    try {
      let query = supabase.from('imports').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setImports(data || []);
    } catch (error) {
      console.error('Error cargando cargas:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      DRAFT: 'bg-gray-100 text-gray-700',
      IN_PROGRESS: 'bg-blue-100 text-blue-700',
      DONE: 'bg-green-100 text-green-700',
    };
    const labels = {
      DRAFT: 'Borrador',
      IN_PROGRESS: 'En Progreso',
      DONE: 'Completado',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badges[status as keyof typeof badges]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getProgress = (imp: Import) => {
    if (imp.total_lines === 0) return 0;
    return Math.round((imp.completed_lines / imp.total_lines) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Link
          to="/cargas/nueva"
          className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg text-sm font-medium hover:from-teal-600 hover:to-cyan-700 transition-all whitespace-nowrap cursor-pointer"
        >
          <i className="ri-file-excel-2-line mr-2"></i>
          Importar Excel
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'all' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('DRAFT')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'DRAFT' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Borrador
            </button>
            <button
              onClick={() => setFilter('IN_PROGRESS')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'IN_PROGRESS' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              En Progreso
            </button>
            <button
              onClick={() => setFilter('DONE')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                filter === 'DONE' ? 'bg-teal-50 text-teal-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Completado
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-file-list-3-line text-3xl text-gray-300"></i>
            </div>
            <p className="text-sm text-gray-500">No hay cargas disponibles</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {imports.map((imp) => (
              <Link
                key={imp.id}
                to={`/cargas/${imp.id}`}
                className="block p-5 hover:bg-gray-50/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-4">
                    <div className="w-11 h-11 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center">
                      <i className="ri-file-list-3-line text-xl text-white"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{imp.file_name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(imp.created_at).toLocaleDateString('es-ES', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(imp.status)}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Progreso</span>
                    <span className="font-medium text-gray-700">
                      {imp.completed_lines} / {imp.total_lines} líneas ({getProgress(imp)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-teal-500 to-cyan-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${getProgress(imp)}%` }}
                    ></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
