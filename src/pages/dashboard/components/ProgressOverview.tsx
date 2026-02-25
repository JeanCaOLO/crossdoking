
import { DashboardStats } from '../hooks/useDashboardStats';

interface Props {
  stats: DashboardStats;
}

/**
 * ProgressOverview component displays a visual summary of import progress.
 * It safely handles missing or zero values and guarantees that the UI
 * never breaks due to division by zero or undefined data.
 */
export default function ProgressOverview({ stats }: Props) {
  // Guard against an unexpected undefined `stats` object.
  // This should never happen in normal usage, but it makes the component
  // more robust if the parent forgets to pass the required prop.
  if (!stats) {
    console.error('ProgressOverview: `stats` prop is missing.');
    return null;
  }

  const segments = [
    { label: 'Completadas', value: stats.doneLines ?? 0, color: 'bg-emerald-500' },
    { label: 'Parciales', value: stats.partialLines ?? 0, color: 'bg-amber-400' },
    { label: 'Pendientes', value: stats.pendingLines ?? 0, color: 'bg-gray-200' },
  ];

  // Avoid division by zero – fallback to 1 when totalLines is falsy.
  const total = stats.totalLines > 0 ? stats.totalLines : 1;

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Progreso General</h3>
        <span className="text-2xl font-bold text-teal-600">{stats.progressPercent ?? 0}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex mb-4">
        {segments.map((seg) => {
          const width = (seg.value / total) * 100;
          return width > 0 ? (
            <div
              key={seg.label}
              className={`${seg.color} h-full transition-all duration-500`}
              style={{ width: `${width}%` }}
            />
          ) : null;
        })}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-3">
        {segments.map((seg) => (
          <div key={seg.label} className="text-center">
            <div className="flex items-center justify-center space-x-1.5 mb-1">
              <div className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
              <span className="text-xs text-gray-500">{seg.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{seg.value}</p>
          </div>
        ))}
      </div>

      {/* Footer details */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Total de líneas</span>
          <span className="font-semibold text-gray-900">{stats.totalLines ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
          <span>Cargas completadas</span>
          <span className="font-semibold text-gray-900">{stats.doneImports ?? 0}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
          <span>Eventos de escaneo</span>
          <span className="font-semibold text-gray-900">{stats.totalEvents ?? 0}</span>
        </div>
      </div>
    </div>
  );
}
