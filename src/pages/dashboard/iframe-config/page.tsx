import { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';

interface Import {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

export default function DashboardIframeConfigPage() {
  const { user } = useAuth();
  const [imports, setImports] = useState<Import[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string>('all');
  const [iframeWidth, setIframeWidth] = useState<string>('100%');
  const [iframeHeight, setIframeHeight] = useState<string>('800');
  const [showDropdown, setShowDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Cargar lista de importaciones
  useEffect(() => {
    loadImports();
  }, []);

  const loadImports = async () => {
    const { supabase } = await import('../../../lib/supabase');
    const { data } = await supabase
      .from('imports')
      .select('id, file_name, status, created_at')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });

    if (data) {
      setImports(data);
    }
  };

  // Generar URL del iframe
  const getIframeUrl = () => {
    const baseUrl = window.location.origin;
    if (selectedImportId === 'all') {
      return `${baseUrl}/dashboard-embed`;
    }
    return `${baseUrl}/dashboard-embed?import_id=${selectedImportId}`;
  };

  // Generar código del iframe
  const getIframeCode = () => {
    const url = getIframeUrl();
    return `<iframe src="${url}" width="${iframeWidth}" height="${iframeHeight}" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`;
  };

  // Copiar código al portapapeles
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(getIframeCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // Copiar URL al portapapeles
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getIframeUrl());
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // Obtener nombre de la carga seleccionada
  const getSelectedImportName = () => {
    if (selectedImportId === 'all') return 'Todas las cargas';
    const selectedImport = imports.find((imp) => imp.id === selectedImportId);
    return selectedImport?.file_name || 'Carga seleccionada';
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Obtener badge de estado
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      DRAFT: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
      IN_PROGRESS: { label: 'En Progreso', color: 'bg-blue-100 text-blue-700' },
      COMPLETED: { label: 'Completado', color: 'bg-green-100 text-green-700' },
    };
    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-700' };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración de Dashboard Embebible</h1>
          <p className="text-gray-600">Genera el código para embeber el dashboard en otro sitio web</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel de configuración */}
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuración</h2>

            {/* Selector de carga */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carga a mostrar
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg hover:border-teal-500 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <i className="ri-file-list-3-line text-gray-500"></i>
                    <span className="text-sm text-gray-900">{getSelectedImportName()}</span>
                  </div>
                  <i className={`ri-arrow-down-s-line text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}></i>
                </button>

                {showDropdown && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    {/* Opción: Todas las cargas */}
                    <button
                      onClick={() => {
                        setSelectedImportId('all');
                        setShowDropdown(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors border-b border-gray-100 ${
                        selectedImportId === 'all' ? 'bg-teal-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <i className="ri-stack-line text-teal-600 text-lg"></i>
                          <div>
                            <div className="font-medium text-gray-900">Todas las cargas</div>
                            <div className="text-xs text-gray-500">Vista global del sistema</div>
                          </div>
                        </div>
                        {selectedImportId === 'all' && (
                          <i className="ri-check-line text-teal-600 text-lg"></i>
                        )}
                      </div>
                    </button>

                    {/* Lista de cargas */}
                    {imports.map((imp) => (
                      <button
                        key={imp.id}
                        onClick={() => {
                          setSelectedImportId(imp.id);
                          setShowDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                          selectedImportId === imp.id ? 'bg-teal-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <i className="ri-file-text-line text-gray-500 text-lg"></i>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{imp.file_name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(imp.status)}
                                <span className="text-xs text-gray-500">{formatDate(imp.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          {selectedImportId === imp.id && (
                            <i className="ri-check-line text-teal-600 text-lg"></i>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dimensiones del iframe */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ancho
                </label>
                <input
                  type="text"
                  value={iframeWidth}
                  onChange={(e) => setIframeWidth(e.target.value)}
                  placeholder="100%"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Ej: 100%, 800px, 50vw</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alto
                </label>
                <input
                  type="text"
                  value={iframeHeight}
                  onChange={(e) => setIframeHeight(e.target.value)}
                  placeholder="800"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Ej: 800, 600px, 100vh</p>
              </div>
            </div>

            {/* URL directa */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                URL directa
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={getIframeUrl()}
                  readOnly
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-700"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                >
                  {copiedUrl ? (
                    <>
                      <i className="ri-check-line mr-1"></i>
                      Copiado
                    </>
                  ) : (
                    <>
                      <i className="ri-file-copy-line mr-1"></i>
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Código del iframe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código del iframe
              </label>
              <div className="relative">
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                  {getIframeCode()}
                </pre>
                <button
                  onClick={handleCopyCode}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-teal-600 text-white text-xs rounded hover:bg-teal-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <i className="ri-check-line mr-1"></i>
                      Copiado
                    </>
                  ) : (
                    <>
                      <i className="ri-file-copy-line mr-1"></i>
                      Copiar código
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Instrucciones */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <i className="ri-information-line text-blue-600 text-xl"></i>
                <div>
                  <h3 className="font-medium text-blue-900 mb-1">Cómo usar</h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>1. Selecciona la carga que deseas mostrar</li>
                    <li>2. Ajusta las dimensiones del iframe</li>
                    <li>3. Copia el código y pégalo en tu sitio web</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Vista previa */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Vista previa</h2>
            <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
              <iframe
                src={getIframeUrl()}
                style={{
                  width: '100%',
                  height: '600px',
                  border: 'none',
                }}
                title="Vista previa del dashboard"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Esta es una vista previa de cómo se verá el dashboard embebido en tu sitio web
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}