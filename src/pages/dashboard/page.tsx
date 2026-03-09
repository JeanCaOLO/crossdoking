import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useDashboardStats } from './hooks/useDashboardStats';
import { useRecentActivity } from './hooks/useRecentActivity';
import { useTiendaProgress } from './hooks/useTiendaProgress';
import StatsCards from './components/StatsCards';
import ProgressOverview from './components/ProgressOverview';
import ActivityFeed from './components/ActivityFeed';
import TiendaTable from './components/TiendaTable';
import QuickActions from './components/QuickActions';

interface ImportOption {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [imports, setImports] = useState<ImportOption[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  const { stats, loading, lastUpdated, refresh } = useDashboardStats(10000, selectedImportId);
  const { activities, loading: actLoading } = useRecentActivity(selectedImportId);
  const { data: tiendaData, loading: tiendaLoading } = useTiendaProgress(selectedImportId);

  // Cargar lista de importaciones
  useEffect(() => {
    fetchImports();
  }, []);

  const fetchImports = async () => {
    try {
      const { data, error } = await supabase
        .from('imports')
        .select('id, file_name, status, created_at')
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setImports(data || []);
    } catch (error) {
      console.error('Error cargando importaciones:', error);
    } finally {
      setLoadingImports(false);
    }
  };

  const safeLastUpdated = lastUpdated instanceof Date ? lastUpdated : new Date();

  const selectedImport = imports.find((imp) => imp.id === selectedImportId);
  const displayLabel = selectedImportId && selectedImport
    ? selectedImport.file_name
    : 'Todas las cargas';

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
      IN_PROGRESS: { label: 'En Progreso', color: 'bg-teal-100 text-teal-700' },
      DONE: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700' },
    };
    return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Selector de carga */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-teal-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-file-list-3-line text-teal-600"></i>
              <span className="text-sm font-medium text-gray-700 max-w-[200px] truncate">
                {displayLabel}
              </span>
              <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`}></i>
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                ></div>
                <div className="absolute top-full left-0 mt-2 w-[400px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[400px] overflow-y-auto">
                  {/* Opción: Todas las cargas */}
                  <button
                    onClick={() => {
                      setSelectedImportId(null);
                      setShowDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 ${
                      !selectedImportId ? 'bg-teal-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
                        <i className="ri-stack-line"></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900">Todas las cargas</p>
                        <p className="text-xs text-gray-500">Vista global del sistema</p>
                      </div>
                      {!selectedImportId && (
                        <i className="ri-check-line text-teal-600"></i>
                      )}
                    </div>
                  </button>

                  {/* Lista de importaciones */}
                  {loadingImports ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                  ) : imports.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">
                      No hay cargas disponibles
                    </div>
                  ) : (
                    imports.map((imp) => {
                      const badge = getStatusBadge(imp.status);
                      const date = new Date(imp.created_at);
                      const dateStr = date.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });

                      return (
                        <button
                          key={imp.id}
                          onClick={() => {
                            setSelectedImportId(imp.id);
                            setShowDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            selectedImportId === imp.id ? 'bg-teal-50' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center mt-0.5">
                              <i className="ri-file-text-line"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {imp.file_name}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${badge.color}`}>
                                  {badge.label}
                                </span>
                                <span className="text-xs text-gray-400">{dateStr}</span>
                              </div>
                            </div>
                            {selectedImportId === imp.id && (
                              <i className="ri-check-line text-teal-600 mt-1"></i>
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          {/* Indicador de vista actual */}
          <div className="hidden md:block">
            <p className="text-xs text-gray-400">
              Vista actual: <span className="font-medium text-gray-600">{displayLabel}</span>
            </p>
            <p className="text-xs text-gray-400">
              Última actualización:{' '}
              {safeLastUpdated.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </div>
        </div>

        <button
          onClick={refresh}
          className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-refresh-line"></i>
          <span>Actualizar</span>
        </button>
      </div>

      <StatsCards stats={stats} loading={loading} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ProgressOverview stats={stats} />
          <TiendaTable data={tiendaData} loading={tiendaLoading} />
        </div>
        <div className="space-y-6">
          <QuickActions />
          <ActivityFeed activities={activities} loading={actLoading} />
        </div>
      </div>
    </div>
  );
}