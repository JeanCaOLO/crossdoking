
import { useState } from 'react';

interface FiltersProps {
  imports: { id: string; file_name: string }[];
  onFilterChange: (filters: FilterValues) => void;
}

export interface FilterValues {
  importId: string;
  eventType: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

const eventTypes = [
  { value: 'all', label: 'Todos los tipos' },
  { value: 'SCAN_PALLET', label: 'Escaneo Pallet' },
  { value: 'SCAN_SKU', label: 'Escaneo SKU' },
  { value: 'CONFIRM_QTY', label: 'Confirmación' },
  { value: 'REVERSE', label: 'Reversión' },
  { value: 'CLOSE', label: 'Cierre' },
  { value: 'UNLOCK', label: 'Desbloqueo' },
  { value: 'ADJUST', label: 'Ajuste' },
];

export default function MovimientosFilters({ imports, onFilterChange }: FiltersProps) {
  const [filters, setFilters] = useState<FilterValues>({
    importId: 'all',
    eventType: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

  const updateFilter = (key: keyof FilterValues, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const cleared: FilterValues = {
      importId: 'all',
      eventType: 'all',
      dateFrom: '',
      dateTo: '',
      searchTerm: '',
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const hasActiveFilters =
    filters.importId !== 'all' ||
    filters.eventType !== 'all' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.searchTerm !== '';

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Buscar</label>
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="SKU, tienda, notas..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Tipo de Evento</label>
          <select
            value={filters.eventType}
            onChange={(e) => updateFilter('eventType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Importación</label>
          <select
            value={filters.importId}
            onChange={(e) => updateFilter('importId', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">Todas</option>
            {imports.map((imp) => (
              <option key={imp.id} value={imp.id}>
                {imp.file_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-5

            focus:border-transparent cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
