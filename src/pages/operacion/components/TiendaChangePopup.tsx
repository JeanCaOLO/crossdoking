
import { useEffect, useState } from 'react';

interface Props {
  previousTienda: string;
  newTienda: string;
  sku: string;
  onClose: () => void;
}

export default function TiendaChangePopup({ previousTienda, newTienda, sku, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 transition-all duration-250 ${isVisible ? 'bg-black/40' : 'bg-black/0'}`}
      onClick={handleClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transition-all duration-250 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-sky-500 to-cyan-500 px-6 py-5 text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <i className="ri-store-2-line text-3xl text-white"></i>
          </div>
          <h3 className="text-lg font-bold text-white">Cambio de Tienda</h3>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-500 text-center mb-5">
            El SKU <span className="font-semibold text-gray-800">{sku}</span> ahora se distribuye a otra tienda
          </p>

          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="flex-1 text-center bg-gray-50 rounded-xl py-3 px-2 border border-gray-100">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">Anterior</p>
              <p className="text-sm font-bold text-gray-700">{previousTienda}</p>
            </div>
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              <i className="ri-arrow-right-line text-xl text-sky-500"></i>
            </div>
            <div className="flex-1 text-center bg-sky-50 rounded-xl py-3 px-2 border border-sky-100">
              <p className="text-[10px] uppercase tracking-wider text-sky-400 font-medium mb-1">Nueva</p>
              <p className="text-sm font-bold text-sky-700">{newTienda}</p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-full py-3 bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-xl font-medium text-sm hover:from-sky-600 hover:to-cyan-600 transition-all whitespace-nowrap cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
