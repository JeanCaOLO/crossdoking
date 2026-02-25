
import React from 'react';

interface StatsProps {
  totalMovimientos: number;
  totalConfirmaciones: number;
  totalReversiones: number;
  totalUnidades: number;
}

/**
 * MovimientosStats component displays a set of statistical cards.
 * It safely handles missing or malformed numeric values by falling back
 * to zero and wrapping number formatting in a try/catch block.
 */
export default function MovimientosStats({
  totalMovimientos,
  totalConfirmaciones,
  totalReversiones,
  totalUnidades,
}: StatsProps) {
  // Guard against undefined / NaN values
  const safeNumber = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const stats = [
    {
      label: 'Total Movimientos',
      value: safeNumber(totalMovimientos),
      icon: 'ri-exchange-line',
      gradient: 'from-teal-50 to-cyan-50',
      border: 'border-teal-200',
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      valueColor: 'text-teal-700',
    },
    {
      label: 'Confirmaciones',
      value: safeNumber(totalConfirmaciones),
      icon: 'ri-checkbox-circle-line',
      gradient: 'from-emerald-50 to-green-50',
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-700',
    },
    {
      label: 'Reversiones',
      value: safeNumber(totalReversiones),
      icon: 'ri-arrow-go-back-line',
      gradient: 'from-amber-50 to-orange-50',
      border: 'border-amber-200',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-700',
    },
    {
      label: 'Unidades Movidas',
      value: safeNumber(totalUnidades),
      icon: 'ri-stack-line',
      gradient: 'from-rose-50 to-pink-50',
      border: 'border-rose-200',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      valueColor: 'text-rose-700',
    },
  ];

  const formatNumber = (num: number) => {
    try {
      return num.toLocaleString();
    } catch {
      // Fallback for environments where toLocaleString might fail
      return String(num);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`bg-gradient-to-br ${stat.gradient} border ${stat.border} rounded-xl p-4`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.valueColor} mt-1`}>
                {formatNumber(stat.value)}
              </p>
            </div>
            <div className={`w-11 h-11 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
              <i className={`${stat.icon} text-xl ${stat.iconColor}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
