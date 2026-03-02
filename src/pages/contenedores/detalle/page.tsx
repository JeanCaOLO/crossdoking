import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supabase } from '../../../lib/supabase';
import ContainerHeader from './components/ContainerHeader';
import ContainerSummary from './components/ContainerSummary';
import ContainerContentTable, { ContainerContentRow } from './components/ContainerContentTable';
import ReverseLineModal from './components/ReverseLineModal';

interface ContainerData {
  id: string;
  code: string;
  tienda: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  created_by: string;
}

interface RawContainerLine {
  id: string;
  qty: number;
  sku: string;
  pallet_id: string | null;
  pallets: { id: string; pallet_code: string; ubicacion: string } | null;
  import_lines: {
    id: string;
    descripcion: string;
    barcode: string;
    tienda: string;
    camion: string;
  } | null;
}

export default function ContenedorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [container, setContainer] = useState<ContainerData | null>(null);
  const [lines, setLines] = useState<RawContainerLine[]>([]);
  const [createdByEmail, setCreatedByEmail] = useState('');
  const [camion, setCamion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reverseLineId, setReverseLineId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [closingContainer, setClosingContainer] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadContainer();
  }, [id]);

  const loadContainer = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('🔍 Cargando contenedor:', id);

      const { data, error: fetchErr } = await supabase
        .from('containers')
        .select(
          `
            id, code, tienda, status, created_at, closed_at, created_by,
            container_lines(
              id, qty, sku, pallet_id,
              pallets(id, pallet_code, ubicacion),
              import_lines:source_import_line_id(id, descripcion, barcode, tienda, camion)
            )
          `
        )
        .eq('id', id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;
      if (!data) {
        setError('Contenedor no encontrado');
        return;
      }

      setContainer({
        id: data.id,
        code: data.code,
        tienda: data.tienda,
        status: data.status,
        created_at: data.created_at,
        closed_at: data.closed_at,
        created_by: data.created_by,
      });

      const containerLines = (data.container_lines as RawContainerLine[]) ?? [];
      setLines(containerLines);

      console.log('📦 Contenedor cargado:', {
        code: data.code,
        tienda: data.tienda,
        status: data.status,
        totalLines: containerLines.length,
      });

      if (containerLines.length > 0 && containerLines[0].import_lines?.camion) {
        setCamion(containerLines[0].import_lines.camion);
      }

      if (data.created_by) {
        const { data: userData, error: userErr } = await supabase
          .from('users')
          .select('email, full_name')
          .eq('auth_id', data.created_by)
          .maybeSingle();

        if (userErr) throw userErr;
        if (userData) {
          setCreatedByEmail(userData.full_name || userData.email);
        }
      }
    } catch (err: any) {
      console.error('❌ Error cargando contenedor:', err);
      setError('Error al cargar el contenedor');
    } finally {
      setLoading(false);
    }
  };

  /** Build rows for the table: group by pallet_code + sku and sum quantities */
  const tableRows: ContainerContentRow[] = useMemo(() => {
    const grouped = new Map<string, ContainerContentRow>();

    lines.forEach((line) => {
      const palletCode = line.pallets?.pallet_code ?? '—';
      const key = `${palletCode}|${line.sku}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.qty += Number(line.qty) || 0;
      } else {
        grouped.set(key, {
          id: line.id,
          pallet_code: palletCode,
          ubicacion: line.pallets?.ubicacion ?? '',
          sku: line.sku,
          descripcion: line.import_lines?.descripcion ?? '',
          barcode: line.import_lines?.barcode ?? '',
          qty: Number(line.qty) || 0,
        });
      }
    });

    return Array.from(grouped.values());
  }, [lines]);

  /** Filter rows by search term */
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return tableRows;

    const term = searchTerm.toLowerCase();
    return tableRows.filter(
      (row) =>
        row.sku.toLowerCase().includes(term) ||
        row.pallet_code.toLowerCase().includes(term) ||
        row.descripcion.toLowerCase().includes(term) ||
        row.barcode.toLowerCase().includes(term)
    );
  }, [tableRows, searchTerm]);

  /** KPI: distinct pallets */
  const totalPallets = useMemo(() => {
    const uniquePalletIds = new Set<string>();
    lines.forEach((l) => {
      if (l.pallet_id) uniquePalletIds.add(l.pallet_id);
    });
    return uniquePalletIds.size;
  }, [lines]);

  /** KPI: distinct SKUs */
  const totalSkus = useMemo(() => {
    const uniqueSkus = new Set<string>();
    lines.forEach((l) => {
      if (l.sku) uniqueSkus.add(l.sku);
    });
    return uniqueSkus.size;
  }, [lines]);

  /** KPI: total units */
  const totalUnits = useMemo(() => {
    return lines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0);
  }, [lines]);

  const handleReverseClick = (lineId: string) => {
    setReverseLineId(lineId);
  };

  const handleReverseSuccess = () => {
    loadContainer();
  };

  /** Genera e imprime la etiqueta del contenedor usando iframe oculto */
  const printContainerLabel = (
    containerCode: string,
    containerTienda: string,
    rows: ContainerContentRow[]
  ) => {
    try {
      console.log('🖨️ Generando etiqueta para contenedor:', containerCode);

      // Generar QR como SVG string
      const qrSvgString = renderToStaticMarkup(
        <QRCodeSVG value={containerCode} size={200} level="H" />
      );

      // Generar filas de la tabla
      const rowsHtml = rows
        .map(
          (row) => `
        <tr>
          <td>${row.sku}</td>
          <td>${row.descripcion || '—'}</td>
          <td style="text-align:center;">${row.qty}</td>
          <td>${row.pallet_code}</td>
        </tr>`
        )
        .join('');

      const totalUnidades = rows.reduce((sum, r) => sum + r.qty, 0);

      const fechaCierre = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta Contenedor ${containerCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      padding: 24px;
      color: #111;
      background: #fff;
    }
    .header {
      display: flex;
      align-items: flex-start;
      gap: 24px;
      border-bottom: 2px solid #111;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .qr-block { flex-shrink: 0; }
    .info-block { flex: 1; }
    .info-block h1 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 1px;
      font-family: monospace;
    }
    .info-block .label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #666;
      margin-top: 8px;
    }
    .info-block .value {
      font-size: 16px;
      font-weight: 600;
      margin-top: 2px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #444;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead tr { background: #111; color: #fff; }
    thead th {
      padding: 8px 10px;
      text-align: left;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 11px;
    }
    tbody tr:nth-child(even) { background: #f5f5f5; }
    tbody td {
      padding: 7px 10px;
      border-bottom: 1px solid #e0e0e0;
    }
    .footer {
      margin-top: 16px;
      display: flex;
      justify-content: flex-end;
      font-size: 13px;
      font-weight: 600;
      border-top: 1px solid #ccc;
      padding-top: 8px;
    }
    @media print {
      body { padding: 12px; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="qr-block">${qrSvgString}</div>
    <div class="info-block">
      <div class="label">Contenedor</div>
      <h1>${containerCode}</h1>
      <div class="label" style="margin-top:12px;">Tienda</div>
      <div class="value">${containerTienda}</div>
      <div class="label" style="margin-top:8px;">Total unidades</div>
      <div class="value">${totalUnidades}</div>
      <div class="label" style="margin-top:8px;">Fecha cierre</div>
      <div class="value">${fechaCierre}</div>
    </div>
  </div>

  <div class="section-title">Packing List</div>
  <table>
    <thead>
      <tr>
        <th>Artículo (SKU)</th>
        <th>Descripción</th>
        <th style="text-align:center;">Cantidad</th>
        <th>Pallet padre</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4" style="text-align:center;padding:12px;color:#999;">Sin líneas registradas</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Total: ${totalUnidades} unidades</div>
</body>
</html>`;

      // Crear iframe oculto
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      // Escribir contenido en el iframe
      const iframeDoc = iframe.contentWindow?.document;
      if (!iframeDoc) {
        console.error('❌ No se pudo acceder al documento del iframe');
        alert('No se pudo abrir la impresión');
        document.body.removeChild(iframe);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Esperar a que el contenido se renderice y luego imprimir
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            console.log('✅ Impresión iniciada');

            // Remover iframe después de imprimir
            setTimeout(() => {
              document.body.removeChild(iframe);
            }, 1000);
          } catch (printErr) {
            console.error('❌ Error al imprimir:', printErr);
            alert('Contenedor cerrado, pero no se pudo abrir la impresión');
            document.body.removeChild(iframe);
          }
        }, 300);
      };
    } catch (err) {
      console.error('❌ Error generando etiqueta:', err);
      alert('Contenedor cerrado, pero no se pudo generar la etiqueta');
    }
  };

  /** Confirmar y cerrar contenedor */
  const handleConfirmClose = async () => {
    if (!container || container.status !== 'OPEN') return;

    setShowCloseModal(false);
    setClosingContainer(true);

    try {
      console.log('🔒 Cerrando contenedor:', container.code);

      // Capturar datos ANTES de actualizar
      const codeSnapshot = container.code;
      const tiendaSnapshot = container.tienda;
      const rowsSnapshot = [...tableRows];

      // Actualizar estado del contenedor
      const { error: updateErr } = await supabase
        .from('containers')
        .update({
          status: 'CLOSED',
          closed_at: new Date().toISOString(),
        })
        .eq('id', container.id);

      if (updateErr) throw updateErr;

      console.log('✅ Contenedor cerrado exitosamente');

      // Reload para reflejar cambios
      await loadContainer();

      // Imprimir etiqueta con los datos capturados
      printContainerLabel(codeSnapshot, tiendaSnapshot, rowsSnapshot);
    } catch (err: any) {
      console.error('❌ Error cerrando contenedor:', err);
      alert('Error al cerrar el contenedor');
    } finally {
      setClosingContainer(false);
    }
  };

  /** Abrir modal de confirmación */
  const handleCloseContainer = () => {
    setShowCloseModal(true);
  };

  /** Continue container (navigate to Operación) */
  const handleContinueContainer = () => {
    if (!container) return;
    console.log('➡️ Continuando contenedor:', container.code, '→ /operacion');
    navigate(`/operacion?containerId=${container.id}`);
  };

  // ----- Render ---------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-error-warning-line text-3xl text-red-400"></i>
        </div>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (!container) return null;

  return (
    <div className="space-y-6">
      <ContainerHeader
        code={container.code}
        tienda={container.tienda}
        camion={camion}
        status={container.status}
        createdAt={container.created_at}
        closedAt={container.closed_at}
        createdByEmail={createdByEmail}
      />

      <ContainerSummary totalPallets={totalPallets} totalSkus={totalSkus} totalUnits={totalUnits} />

      {container.status === 'OPEN' && (
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleContinueContainer}
            className="flex-1 min-w-[200px] px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            <i className="ri-play-line text-lg"></i>
            Continuar contenedor
          </button>
          <button
            onClick={handleCloseContainer}
            disabled={closingContainer}
            className="flex-1 min-w-[200px] px-5 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {closingContainer ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Cerrando...
              </>
            ) : (
              <>
                <i className="ri-lock-line text-lg"></i>
                Cerrar contenedor
              </>
            )}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Buscar por SKU, pallet, descripción o código de barra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <i className="ri-close-line"></i>
            </button>
          )}
        </div>
        {searchTerm && (
          <p className="text-xs text-gray-500 mt-2">
            {filteredRows.length} resultado{filteredRows.length !== 1 ? 's' : ''} encontrado{filteredRows.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <ContainerContentTable
        rows={filteredRows}
        containerStatus={container.status}
        onReverse={handleReverseClick}
      />

      {reverseLineId && (
        <ReverseLineModal
          lineId={reverseLineId}
          onClose={() => setReverseLineId(null)}
          onSuccess={handleReverseSuccess}
        />
      )}

      {/* Modal de confirmación de cierre */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="ri-lock-line text-2xl text-amber-600"></i>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">Cerrar contenedor</h3>
                <p className="text-sm text-gray-600 mb-1">
                  ¿Seguro que deseas cerrar el contenedor <span className="font-mono font-semibold">{container.code}</span>?
                </p>
                <p className="text-xs text-gray-500">
                  Se generará e imprimirá automáticamente la etiqueta del contenedor.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowCloseModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmClose}
                className="flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors cursor-pointer"
              >
                Sí, cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
