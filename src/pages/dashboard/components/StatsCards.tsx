import { DashboardStats } from '../hooks/useDashboardStats';

interface Props {
  stats: DashboardStats;
  loading: boolean;
}

export default function StatsCards({ stats, loading }: Props) {
  const cards = [
    {
      title: 'Total Pallets',
      value: stats.totalPallets || 0,
      icon: 'ri-stack-line',
      color: 'bg-teal-100 text-teal-700',
    },
    {
      title: 'SKUs Únicos',
      value: stats.totalSKUs || 0,
      icon: 'ri-barcode-line',
      color: 'bg-sky-100 text-sky-700',
    },
    {
      title: 'Tiendas',
      value: stats.totalTiendas || 0,
      icon: 'ri-store-2-line',
      color: 'bg-purple-100 text-purple-700',
    },
    {
      title: 'Camiones',
      value: stats.totalCamiones || 0,
      icon: 'ri-truck-line',
      color: 'bg-amber-100 text-amber-700',
    },
    {
      title: 'Unidades Totales',
      value: (stats.totalUnits || 0).toLocaleString(),
      icon: 'ri-inbox-line',
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      title: 'Confirmadas',
      value: (stats.totalConfirmed || 0).toLocaleString(),
      icon: 'ri-check-double-line',
      color: 'bg-green-100 text-green-700',
    },
    {
      title: 'Pendientes',
      value: (stats.totalPending || 0).toLocaleString(),
      icon: 'ri-time-line',
      color: 'bg-rose-100 text-rose-700',
    },
    {
      title: 'Progreso',
      value: `${stats.progressPercent || 0}%`,
      icon: 'ri-pie-chart-line',
      color: 'bg-indigo-100 text-indigo-700',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
              <div className="flex-1">
                <div className="h-3 w-20 bg-gray-200 rounded mb-2"></div>
                <div className="h-6 w-16 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
              <i className={`${card.icon} text-xl`}></i>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-1">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
