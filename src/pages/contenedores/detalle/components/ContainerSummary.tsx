
interface ContainerSummaryProps {
  totalPallets: number;
  totalSkus: number;
  totalUnits: number;
}

export default function ContainerSummary({ totalPallets, totalSkus, totalUnits }: ContainerSummaryProps) {
  const cards = [
    {
      label: 'Pallets',
      value: totalPallets,
      icon: 'ri-stack-line',
      gradient: 'from-teal-500 to-cyan-600',
    },
    {
      label: 'SKUs distintos',
      value: totalSkus,
      icon: 'ri-barcode-line',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      label: 'Unidades totales',
      value: totalUnits.toLocaleString('es-ES'),
      icon: 'ri-hashtag',
      gradient: 'from-rose-500 to-pink-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5 flex items-center space-x-4">
          <div
            className={`w-11 h-11 bg-gradient-to-br ${card.gradient} rounded-lg flex items-center justify-center`}
          >
            <i className={`${card.icon} text-xl text-white`}></i>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
