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
    <div className="grid grid-cols-3 gap-3 md:gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-3 md:p-5 flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4">
          <div className={`w-9 h-9 md:w-11 md:h-11 bg-gradient-to-br ${card.gradient} rounded-lg flex items-center justify-center flex-shrink-0`}>
            <i className={`${card.icon} text-base md:text-xl text-white`}></i>
          </div>
          <div className="text-center md:text-left">
            <p className="text-xl md:text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-[10px] md:text-xs text-gray-500 mt-0.5 leading-tight">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
