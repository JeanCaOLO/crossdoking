import { useState } from 'react';

export interface CCFilterValues {
  status: string;
  tienda: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
  importId: string;
}

export interface ImportOption {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

interface Props {
  tiendas: string[];
  imports: ImportOption[];
  loadingImports: boolean;
  onFilterChange: (filters: CCFilterValues) => void;
}

const statusOptions = [
  { value: 'all', label: 'Ambos' },
  { value: 'CLOSED', label: 'Cerrado' },
  { value: 'DISPATCHED', label: 'Despachado' },
];

const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
    IN_PROGRESS: { label: 'En Progreso', color: 'bg-teal-100 text-teal-700' },
    DONE: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700' },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
};

export default function ClosedContainersFilters({ tiendas, imports, loadingImports, onFilterChange }: Props) {
  const [filters, setFilters] = useState<CCFilterValues>({
    status: 'all',
    tienda: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
    importId: 'all',
  });
  const [showImportDropdown, setShowImportDropdown] = useState(false);

  const updateFilter = (key: keyof CCFilterValues, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const cleared: CCFilterValues = {
      status: 'all',
      tienda: 'all',
      dateFrom: '',
      dateTo: '',
      searchTerm: '',
      importId: 'all',
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.tienda !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.searchTerm !== '' ||
    filters.importId !== 'all';

  const selectedImport = imports.find((i) => i.id === filters.importId);
  const importLabel = selectedImport ? selectedImport.file_name : 'Todas las cargas';

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Filtros</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium cursor-pointer whitespace-nowrap"
          >
            <i className="ri-filter-off-line mr-1"></i>
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Buscar */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Buscar</label>
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="Container o SKU..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Estado */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Estado</label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Tienda */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Tienda</label>
          <select
            value={filters.tienda}
            onChange={(e) => updateFilter('tienda', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">Todas</option>
            {tiendas.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Cerrado desde */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Cerrado desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          />
        </div>

        {/* Cerrado hasta */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Cerrado hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          />
        </div>

        {/* Carga / Importación */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Carga</label>
          <div className="relative">
            <button
              onClick={() => setShowImportDropdown(!showImportDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg text-sm hover:border-teal-300 transition-colors cursor-pointer bg-white"
            >
              <div className="flex items-center space-x-1.5 min-w-0">
                <i className="ri-file-list-3-line text-teal-600 flex-shrink-0"></i>
                <span className="truncate text-gray-700">{importLabel}</span>
              </div>
              <i className={`ri-arrow-down-s-line text-gray-400 flex-shrink-0 transition-transform ${showImportDropdown ? 'rotate-180' : ''}`}></i>
            </button>

            {showImportDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowImportDropdown(false)}
                ></div>
                <div className="absolute top-full right-0 mt-1 w-[340px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-[320px] overflow-y-auto">
                  {/* Todas las cargas */}
                  <button
                    onClick={() => {
                      updateFilter('importId', 'all');
                      setShowImportDropdown(false);
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 ${
                      filters.importId === 'all' ? 'bg-teal-50' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <i className="ri-stack-line text-sm"></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">Todas las cargas</p>
                        <p className="text-xs text-gray-400">Vista global</p>
                      </div>
                      {filters.importId === 'all' && (
                        <i className="ri-check-line text-teal-600 flex-shrink-0"></i>
                      )}
                    </div>
                  </button>

                  {/* Lista de importaciones */}
                  {loadingImports ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full mx-auto"></div>
                    </div>
                  ) : imports.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">
                      No hay cargas disponibles
                    </div>
                  ) : (
                    imports.map((imp) => {
                      const badge = getStatusBadge(imp.status);
                      const dateStr = new Date(imp.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      });
                      return (
                        <button
                          key={imp.id}
                          onClick={() => {
                            updateFilter('importId', imp.id);
                            setShowImportDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100 last:border-b-0 ${
                            filters.importId === imp.id ? 'bg-teal-50' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="w-7 h-7 bg-sky-100 text-sky-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                              <i className="ri-file-text-line text-sm"></i>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{imp.file_name}</p>
                              <div className="flex items-center space-x-2 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.color}`}>
                                  {badge.label}
                                </span>
                                <span className="text-xs text-gray-400">{dateStr}</span>
                              </div>
                            </div>
                            {filters.importId === imp.id && (
                              <i className="ri-check-line text-teal-600 flex-shrink-0 mt-1"></i>
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
        </div>
      </div>
    </div>
  );
}
