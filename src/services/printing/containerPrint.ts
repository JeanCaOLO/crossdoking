
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../lib/supabase';

export interface ContainerContentRow {
  pallet_code: string;
  sku: string;
  descripcion: string;
  qty: number;
}

/**
 * Carga las líneas de un contenedor con detalles completos (pallet + descripción)
 * y las agrupa por pallet_code + sku para evitar duplicados
 */
export async function loadContainerLinesForPrint(
  containerId: string
): Promise<{ rows: ContainerContentRow[]; error?: string }> {
  try {
    const { data: rawLines, error: linesError } = await supabase
      .from('container_lines')
      .select(`
        id, qty, sku, pallet_id,
        pallets(id, pallet_code, ubicacion),
        import_lines:source_import_line_id(id, descripcion, barcode)
      `)
      .eq('container_id', containerId);

    if (linesError) {
      console.error('[PRINT] Error cargando líneas:', linesError);
      return { rows: [], error: linesError.message };
    }

    // Agrupar líneas por pallet_code + sku
    const grouped = new Map<string, ContainerContentRow>();
    (rawLines || []).forEach((line: any) => {
      const palletCode = line.pallets?.pallet_code ?? '—';
      const key = `${palletCode}|${line.sku}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.qty += Number(line.qty) || 0;
      } else {
        grouped.set(key, {
          pallet_code: palletCode,
          sku: line.sku,
          descripcion: line.import_lines?.descripcion ?? '',
          qty: Number(line.qty) || 0,
        });
      }
    });

    return { rows: Array.from(grouped.values()) };
  } catch (err) {
    console.error('[PRINT] Error inesperado:', err);
    return {
      rows: [],
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}

/**
 * Genera e imprime la etiqueta del contenedor usando iframe oculto
 * @param containerCode Código del contenedor (ej: "C-001")
 * @param containerTienda Tienda del contenedor
 * @param rows Líneas agrupadas del contenedor
 */
export function printContainerLabel(
  containerCode: string,
  containerTienda: string,
  rows: ContainerContentRow[]
): void {
  try {
    console.log('[PRINT] Generando etiqueta:', {
      containerCode,
      containerTienda,
      lines: rows.length,
    });

    // Generar QR como SVG string usando React.createElement (evita JSX en archivos .ts)
    const qrSvgString = renderToStaticMarkup(
      React.createElement(QRCodeSVG, {
        value: containerCode,
        size: 200,
        level: 'H',
      })
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
      console.error('[PRINT] ❌ No se pudo acceder al documento del iframe');
      throw new Error('No se pudo abrir la impresión');
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
          console.log('[PRINT] ✅ Impresión iniciada');

          // Remover iframe después de imprimir
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        } catch (printErr) {
          console.error('[PRINT] ❌ Error al imprimir:', printErr);
          document.body.removeChild(iframe);
          throw new Error('No se pudo abrir la impresión');
        }
      }, 300);
    };
  } catch (err) {
    console.error('[PRINT] ❌ Error generando etiqueta:', err);
    throw err;
  }
}

/**
 * Carga e imprime un contenedor por su ID
 * @param containerId ID del contenedor
 * @param containerCode Código del contenedor (opcional, se carga si no se provee)
 * @param containerTienda Tienda del contenedor (opcional, se carga si no se provee)
 */
export async function printContainerById(
  containerId: string,
  containerCode?: string,
  containerTienda?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[PRINT_ON_CLOSE] Iniciando impresión para containerId:', containerId);

    // Si no se proveen code/tienda, cargarlos
    if (!containerCode || !containerTienda) {
      const { data: container, error: containerError } = await supabase
        .from('containers')
        .select('code, tienda')
        .eq('id', containerId)
        .maybeSingle();

      if (containerError || !container) {
        console.error('[PRINT_ON_CLOSE] Error cargando contenedor:', containerError);
        return {
          success: false,
          error: 'No se pudo cargar la información del contenedor',
        };
      }

      containerCode = container.code;
      containerTienda = container.tienda;
    }

    // Cargar líneas agrupadas
    const { rows, error: linesError } = await loadContainerLinesForPrint(containerId);

    if (linesError) {
      return { success: false, error: linesError };
    }

    // Imprimir
    printContainerLabel(containerCode, containerTienda, rows);

    return { success: true };
  } catch (err) {
    console.error('[PRINT_ON_CLOSE] Error inesperado:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error desconocido',
    };
  }
}
