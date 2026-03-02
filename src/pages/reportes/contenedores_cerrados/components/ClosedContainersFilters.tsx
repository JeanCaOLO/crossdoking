
import { useState } from 'react';

export interface CCFilterValues {
  status: string;
  tienda: string;
  dateFrom: string;
  dateTo: string;
  searchTerm: string;
}

interface Props {
  tiendas: string[];
  onFilterChange: (filters: CCFilterValues) => void;
}

const statusOptions = [
  { value: 'all', label: 'Ambos' },
  { value: 'CLOSED', label: 'Cerrado' },
  { value: 'DISPATCHED', label: 'Despachado' },
];

export default function ClosedContainersFilters({ tiendas, onFilterChange }: Props) {
  const [filters, setFilters] = useState<CCFilterValues>({
    status: 'all',
    tienda: 'all',
    dateFrom: '',
    dateTo: '',
    searchTerm: '',
  });

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
    };
    setFilters(cleared);
    onFilterChange(cleared);
  };

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.tienda !== 'all' ||
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
              placeholder="Container o SKU..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

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

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Cerrado desde</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Cerrado hasta</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
