
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import StatsCards from '../components/StatsCards';
import ProgressOverview from '../components/ProgressOverview';
import TiendaTable from '../components/TiendaTable';
import ActivityFeed from '../components/ActivityFeed';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { useTiendaProgress } from '../hooks/useTiendaProgress';
import { supabase } from '../../../lib/supabase';

interface Import {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

function DashboardEmbedContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlImportId = searchParams.get('import_id');

  const [selectedImportId, setSelectedImportId] = useState<string | null>(urlImportId);
  const [imports, setImports] = useState<Import[]>([]);
  const [showImportSelector, setShowImportSelector] = useState(false);

  const { stats, loading: statsLoading, lastUpdated } = useDashboardStats(
    10000,
    selectedImportId
  );
  const { activities, loading: activitiesLoading } = useRecentActivity(selectedImportId);
  const { data: tiendas, loading: tiendasLoading } = useTiendaProgress(selectedImportId);

  // Load imports once on mount
  useEffect(() => {
    loadImports();
  }, []);

  // Keep state in sync when URL param changes
  useEffect(() => {
    if (urlImportId) {
      setSelectedImportId(urlImportId);
    }
  }, [urlImportId]);

  /** Load imports from Supabase with basic error handling */
  const loadImports = async () => {
    try {
      const { data, error } = await supabase
        .from('imports')
        .select('id, file_name, status, created_at')
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImports(data ?? []);
    } catch (error) {
      console.error('Error loading imports:', error);
    }
  };

  /** Handle selection change and keep URL in sync */
  const handleImportChange = (importId: string | null) => {
    setSelectedImportId(importId);
    setShowImportSelector(false);

    if (importId) {
      setSearchParams({ import_id: importId });
    } else {
      setSearchParams({});
    }
  };

  /** Map import status to badge style */
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
      IN_PROGRESS: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700' },
      DONE: { label: 'Completado', color: 'bg-green-100 text-green-700' },
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
  };

  const selectedImport = imports.find((imp) => imp.id === selectedImportId);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header con selector de carga */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard de Crossdocking</h1>
            <p className="text-sm text-gray-500 mt-1">
              Última actualización: {lastUpdated.toLocaleTimeString('es-ES')}
            </p>
          </div>

          {/* Selector de carga */}
          <div className="relative">
            <button
              onClick={() => setShowImportSelector(!showImportSelector)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm min-w-[280px] justify-between"
            >
              <div className="flex items-center gap-2">
                <i className="ri-file-list-3-line text-gray-600"></i>
                <span className="text-sm font-medium text-gray-700">
                  {selectedImport ? selectedImport.file_name : 'Todas las cargas'}
                </span>
              </div>
              <i
                className={`ri-arrow-down-s-line text-gray-400 transition-transform ${
                  showImportSelector ? 'rotate-180' : ''
                }`}
              ></i>
            </button>

            {showImportSelector && (
              <>
                {/* Background overlay to close selector when clicking outside */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowImportSelector(false)}
                ></div>

                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                  {/* Opción: Todas las cargas */}
                  <button
                    onClick={() => handleImportChange(null)}
                    className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors border-b border-gray-100 ${
                      !selectedImportId ? 'bg-teal-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <i className="ri-stack-line text-teal-600 text-lg"></i>
                        <div>
                          <div className="font-medium text-gray-900">Todas las cargas</div>
                          <div className="text-xs text-gray-500">Vista global del sistema</div>
                        </div>
                      </div>
                      {!selectedImportId && (
                        <i className="ri-check-line text-teal-600 text-lg"></i>
                      )}
                    </div>
                  </button>

                  {/* Lista de cargas */}
                  {imports.map((imp) => {
                    const badge = getStatusBadge(imp.status);
                    return (
                      <button
                        key={imp.id}
                        onClick={() => handleImportChange(imp.id)}
                        className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                          selectedImportId === imp.id ? 'bg-teal-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <i className="ri-file-text-line text-gray-400 text-lg flex-shrink-0"></i>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">{imp.file_name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                                  {badge.label}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(imp.created_at).toLocaleDateString('es-ES')}
                                </span>
                              </div>
                            </div>
                          </div>
                          {selectedImportId === imp.id && (
                            <i className="ri-check-line text-teal-600 text-lg flex-shrink-0 ml-2"></i>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Indicador de vista actual */}
        {selectedImport && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <i className="ri-filter-line"></i>
            <span>
              Vista actual: <strong className="text-teal-600">{selectedImport.file_name}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="mb-6">
        <StatsCards stats={stats} loading={statsLoading} />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          <ProgressOverview stats={stats} loading={statsLoading} />
          <TiendaTable data={tiendas} loading={tiendasLoading} />
        </div>

        {/* Right Column - 1/3 */}
        <div className="lg:col-span-1">
          <ActivityFeed activities={activities} loading={activitiesLoading} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardEmbedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <i className="ri-loader-4-line text-4xl text-teal-600 animate-spin"></i>
            <p className="mt-4 text-gray-600">Cargando dashboard...</p>
          </div>
        </div>
      }
    >
      <DashboardEmbedContent />
    </Suspense>
  );
}
