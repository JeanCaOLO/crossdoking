
import { useDashboardStats } from './hooks/useDashboardStats';
import { useRecentActivity } from './hooks/useRecentActivity';
import { useTiendaProgress } from './hooks/useTiendaProgress';
import StatsCards from './components/StatsCards';
import ProgressOverview from './components/ProgressOverview';
import ActivityFeed from './components/ActivityFeed';
import TiendaTable from './components/TiendaTable';
import QuickActions from './components/QuickActions';

export default function DashboardPage() {
  const { stats, loading, lastUpdated, refresh } = useDashboardStats(10000);
  const { activities, loading: actLoading } = useRecentActivity();
  const { data: tiendaData, loading: tiendaLoading } = useTiendaProgress();

  // Guard against unexpected null/undefined values
  const safeLastUpdated = lastUpdated instanceof Date ? lastUpdated : new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Última actualización:{' '}
            {safeLastUpdated.toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </p>
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
