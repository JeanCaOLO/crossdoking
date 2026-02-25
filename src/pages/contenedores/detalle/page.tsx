
import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
  const [container, setContainer] = useState<ContainerData | null>(null);
  const [lines, setLines] = useState<RawContainerLine[]>([]);
  const [createdByEmail, setCreatedByEmail] = useState('');
  const [camion, setCamion] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reverseLineId, setReverseLineId] = useState<string | null>(null);

  // Load container data when the id changes
  useEffect(() => {
    if (!id) return;
    loadContainer();
  }, [id]);

  /** Fetch container and its related data */
  const loadContainer = async () => {
    setLoading(true);
    setError('');
    try {
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

      // Set container meta‑data
      setContainer({
        id: data.id,
        code: data.code,
        tienda: data.tienda,
        status: data.status,
        created_at: data.created_at,
        closed_at: data.closed_at,
        created_by: data.created_by,
      });

      // Set lines
      const containerLines = (data.container_lines as RawContainerLine[]) ?? [];
      setLines(containerLines);

      // Extract truck (camión) info from the first line, if available
      if (containerLines.length > 0 && containerLines[0].import_lines?.camion) {
        setCamion(containerLines[0].import_lines.camion);
      }

      // Fetch creator’s email / full name
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
      console.error('Error cargando contenedor:', err);
      setError('Error al cargar el contenedor');
    } finally {
      setLoading(false);
    }
  };

  /** Open the reverse‑line modal */
  const handleReverseClick = (lineId: string) => {
    setReverseLineId(lineId);
  };

  /** Refresh data after a successful reversal */
  const handleReverseSuccess = () => {
    loadContainer();
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

      <ContainerContentTable rows={tableRows} containerStatus={container.status} onReverse={handleReverseClick} />

      {reverseLineId && (
        <ReverseLineModal
          lineId={reverseLineId}
          onClose={() => setReverseLineId(null)}
          onSuccess={handleReverseSuccess}
        />
      )}
    </div>
  );
}
