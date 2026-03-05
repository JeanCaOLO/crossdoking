import { useState, useRef, useEffect } from 'react';
import { supabase, Pallet, PalletInventory, ImportLine } from '../../../lib/supabase';
import { getOrCreateOpenContainer, isContainerEditable } from '../../../lib/containerService';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../components/base/Toast';
import TiendaChangePopup from './TiendaChangePopup';
import SobranteModal from './SobranteModal';
import { printContainerById } from '../../../services/printing/containerPrint';

export default function DistribucionModal({
  pallet,
  inventory,
  pendingLines,
  importId,
  continueMode = false,
  targetContainer = null,
  onClose,
  onComplete,
}) {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [step, setStep] = useState('scan'); // 'scan' | 'confirm'
  const [skuInput, setSkuInput] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedLine, setSelectedLine] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showSobrante, setShowSobrante] = useState(false);
  const [remainingInventory, setRemainingInventory] = useState([]);
  const [selectedTiendaToClose, setSelectedTiendaToClose] = useState('');
  const [closingInProgress, setClosingInProgress] = useState(false);
  const [availableTiendas, setAvailableTiendas] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [manualStoreSelection, setManualStoreSelection] = useState(false);
  const [skuProgress, setSkuProgress] = useState(null);
  const [tiendasProgress, setTiendasProgress] = useState([]);
  const [skuLinesCache, setSkuLinesCache] = useState([]);
  const [tiendaChange, setTiendaChange] = useState(null);
  const previousTiendaRef = useRef(null);

  const skuInputRef = useRef(null);
  const qtyInputRef = useRef(null);

  const hasUser = !authLoading && user !== null;

  // ─── CONTINUE MODE: Fuente única de verdad ────────────────────────────────
  const continueContainerId = continueMode && targetContainer ? targetContainer.id : null;
  const targetStoreName = continueMode && targetContainer ? String(targetContainer.tienda) : null;

  console.log(
    `[DistribucionModal] CONTINUE_MODE: ${continueMode} | continueContainerId: ${
      continueContainerId ?? 'null'
    } | targetStore: ${targetStoreName ?? 'null'}`
  );

  // ✅ RESET: Limpiar estado al cambiar de pallet o abrir modal
  useEffect(() => {
    setSelectedSku('');
    setSelectedLine(null);
    setSelectedStore('');
    setManualStoreSelection(false);
    setQuantity('');
    setError('');
    setSkuProgress(null);
    setTiendasProgress([]);
    setSkuLinesCache([]);
    previousTiendaRef.current = null;
  }, [pallet.id]);

  useEffect(() => {
    if (step === 'scan') {
      setTimeout(() => skuInputRef.current?.focus(), 100);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'confirm') {
      setTimeout(() => qtyInputRef.current?.focus(), 150);
    }
  }, [step, selectedStore]);

  useEffect(() => {
    if (selectedSku && step === 'confirm') {
      loadSkuProgress();
    } else {
      setSkuProgress(null);
      setTiendasProgress([]);
      setSkuLinesCache([]);
    }
  }, [selectedSku, step]);

  // ── Log de render del modal ──
  console.log('[ModalRender] isOpen= true | step=', step, '| selectedSku=', selectedSku);

  const loadSkuProgress = async () => {
    try {
      let query = supabase
        .from('import_lines')
        .select('*')
        .eq('pallet_code', pallet.pallet_code)
        .eq('sku', selectedSku);

      if (continueMode && targetStoreName) {
        console.log('[CONTINUE_MODE] 📊 Cargando progreso solo para tienda:', targetStoreName);
        query = query.eq('tienda', targetStoreName);
      }

      const { data: lines } = await query.order('tienda', { ascending: true });

      if (!lines || lines.length === 0) return;

      setSkuLinesCache(lines);

      const total = lines.reduce((sum, l) => sum + (l.qty_to_send || 0), 0);
      const confirmed = lines.reduce((sum, l) => sum + (l.qty_confirmed || 0), 0);
      const percentage = total > 0 ? Math.round((confirmed / total) * 100) : 0;

      setSkuProgress({ total, confirmed, percentage });

      const tiendas = lines.map((line) => ({
        tienda: line.tienda,
        camion: line.camion || '',
        qty_to_send: line.qty_to_send || 0,
        qty_confirmed: line.qty_confirmed || 0,
        pending: Math.max(0, (line.qty_to_send || 0) - (line.qty_confirmed || 0)),
        status: line.status,
        importLineId: line.id,
      }));

      setTiendasProgress(tiendas);
    } catch (err) {
      console.error('[CONTINUE_MODE] Error cargando progreso del SKU:', err);
    }
  };

  const getNextPendingLine = async (sku) => {
    try {
      let query = supabase
        .from('import_lines')
        .select('*')
        .eq('pallet_code', pallet.pallet_code)
        .eq('sku', sku)
        .in('status', ['PENDING', 'PARTIAL']);

      if (continueMode && targetStoreName) {
        query = query.eq('tienda', targetStoreName);
      }

      const { data: lines } = await query.order('tienda', { ascending: true });

      if (!lines || lines.length === 0) return null;

      return lines.find((l) => (l.qty_confirmed || 0) < (l.qty_to_send || 0)) || null;
    } catch (err) {
      console.error('[CONTINUE_MODE] Error obteniendo siguiente línea pendiente:', err);
      return null;
    }
  };

  const handleStoreClick = (tienda) => {
    if (continueMode && targetStoreName && String(tienda.tienda) !== targetStoreName) {
      showToast('error', 'Tienda no permitida', `Solo puedes distribuir a ${targetStoreName} en modo continuar`);
      return;
    }

    if (tienda.pending <= 0) {
      showToast('warning', 'Tienda completa', `${tienda.tienda} ya tiene todas las unidades confirmadas`);
      return;
    }

    const line = skuLinesCache.find((l) => String(l.tienda) === String(tienda.tienda));
    if (!line) return;

    const prevStore = selectedStore;
    setSelectedStore(tienda.tienda);
    setSelectedLine(line);
    setManualStoreSelection(true);
    setQuantity('');
    setError('');

    if (prevStore && prevStore !== tienda.tienda) {
      showToast('info', 'Tienda cambiada', `Ahora distribuyendo a ${tienda.tienda}`);
    }
    setTimeout(() => qtyInputRef.current?.focus(), 100);
  };

  const handleBackToAuto = async () => {
    setManualStoreSelection(false);
    const nextLine = await getNextPendingLine(selectedSku);
    if (nextLine) {
      setSelectedLine(nextLine);
      setSelectedStore(nextLine.tienda);
      setQuantity('');
      setError('');
      showToast('info', 'Modo automático', `Tienda activa: ${nextLine.tienda}`);
      setTimeout(() => qtyInputRef.current?.focus(), 100);
    }
  };

  // ─── NORMALIZACIÓN: Eliminar saltos de línea, tabulaciones y espacios
  const normalizeInput = (raw) => {
    return raw
      .replace(/[\r\n\t]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const handleSkuSubmit = async (e) => {
    e?.preventDefault();

    const rawInput = normalizeInput(skuInput);
    if (!rawInput) return;

    setError('');
    console.log('[DistribucionModal] 🔍 Buscando SKU/barcode (normalizado):', JSON.stringify(rawInput));

    let palletInventory = remainingInventory;

    if (!palletInventory || palletInventory.length === 0) {
      const { data: freshInv, error: invError } = await supabase
        .from('pallet_inventory')
        .select('*')
        .eq('pallet_id', pallet.id)
        .gt('qty_available', 0);

      if (invError) {
        console.error('[DistribucionModal] Error al consultar inventario:', invError.message, invError.details);
        setError(`Error al buscar inventario: ${invError.message}`);
        setSkuInput('');
        skuInputRef.current?.focus();
        return;
      }
      palletInventory = freshInv ?? [];
      setRemainingInventory(palletInventory);
    }

    if (palletInventory.length === 0) {
      setError('No hay inventario disponible en este pallet');
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    let inv = palletInventory.find((i) => String(i.sku).trim() === rawInput);
    let resolvedSku = rawInput;

    if (!inv) {
      console.log('[DistribucionModal] No encontrado por SKU, intentando barcode...');

      let barcodeQuery = supabase
        .from('import_lines')
        .select('sku, tienda')
        .eq('barcode', rawInput)
        .eq('pallet_code', pallet.pallet_code);

      if (continueMode && targetStoreName) {
        console.log('[CONTINUE_MODE] 🔍 Buscando barcode solo en tienda:', targetStoreName);
        barcodeQuery = barcodeQuery.eq('tienda', targetStoreName);
      }

      const { data: lineByBarcode, error: barcodeError } = await barcodeQuery.limit(1).maybeSingle();

      if (barcodeError) {
        console.error('[DistribucionModal] Error al buscar por barcode:', barcodeError.message, barcodeError.details);
      }

      if (lineByBarcode) {
        resolvedSku = String(lineByBarcode.sku).trim();
        console.log('[DistribucionModal] ✅ Barcode resuelto a SKU:', resolvedSku, '| Tienda:', lineByBarcode.tienda);
        inv = palletInventory.find((i) => String(i.sku).trim() === resolvedSku);
      }
    }

    if (!inv) {
      console.log('[DistribucionModal] ❌ SKU/barcode no encontrado en inventario del pallet');
      if (continueMode && targetStoreName) {
        setError(`SKU / código de barra no encontrado en este pallet para ${targetStoreName}`);
      } else {
        setError('SKU / código de barra no encontrado en este pallet');
      }
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    if ((inv.qty_available ?? 0) <= 0) {
      console.log('[DistribucionModal] ❌ Sin cantidad disponible para SKU:', resolvedSku);
      setError('No hay cantidad disponible para este SKU en el pallet');
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    console.log('[DistribucionModal] ✅ Inventario encontrado | SKU:', resolvedSku, '| Disponible:', inv.qty_available);

    let query = supabase
      .from('import_lines')
      .select('*')
      .eq('pallet_code', pallet.pallet_code)
      .eq('sku', resolvedSku)
      .in('status', ['PENDING', 'PARTIAL']);

    if (continueMode && targetStoreName) {
      console.log('[CONTINUE_MODE] 🔍 Verificando SKU para tienda objetivo:', targetStoreName);
      query = query.eq('tienda', targetStoreName);
    }

    const { data: allLines, error: linesError } = await query.order('tienda', { ascending: true });

    if (linesError) {
      console.error('[CONTINUE_MODE] Error al consultar líneas:', linesError.message, linesError.details);
      setError(`Error al buscar pedidos: ${linesError.message}`);
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    if (continueMode && targetStoreName && (!allLines || allLines.length === 0)) {
      console.log('[CONTINUE_MODE] ❌ No hay líneas para la tienda objetivo | SKU:', resolvedSku);
      const { data: otherStoreLines } = await supabase
        .from('import_lines')
        .select('tienda')
        .eq('pallet_code', pallet.pallet_code)
        .eq('sku', resolvedSku)
        .in('status', ['PENDING', 'PARTIAL'])
        .limit(1);

      if (otherStoreLines && otherStoreLines.length > 0) {
        const actualStore = String(otherStoreLines[0].tienda);
        const errorMsg = `Este SKU pertenece a la tienda ${actualStore}. Estás continuando para ${targetStoreName}.`;
        setError(errorMsg);
        showToast('error', 'SKU de otra tienda', `Este producto es para ${actualStore}, no para ${targetStoreName}`);
        console.log('[CONTINUE_MODE] 🚫 SKU rechazado | Tienda real:', actualStore, '| Tienda objetivo:', targetStoreName);
      } else {
        setError(`Este SKU no tiene pedidos pendientes para ${targetStoreName}`);
      }

      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    if (!allLines || allLines.length === 0) {
      setError('No hay pedidos pendientes para este SKU');
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    const defaultLine = allLines.find((l) => (l.qty_confirmed || 0) < (l.qty_to_send || 0));
    if (!defaultLine) {
      setError('No hay pedidos pendientes para este SKU');
      setSkuInput('');
      skuInputRef.current?.focus();
      return;
    }

    setSkuLinesCache(allLines);

    if (hasUser) {
      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'SCAN_SKU',
        raw_code: rawInput,
        sku: resolvedSku,
        tienda: defaultLine.tienda,
        user_id: user.id,
      });
    }

    console.log('[CONTINUE_MODE] ✅ SKU aceptado:', resolvedSku, '| Tienda:', defaultLine.tienda);
    previousTiendaRef.current = defaultLine.tienda;
    setSelectedSku(resolvedSku);
    setSelectedLine(defaultLine);
    setSelectedStore(defaultLine.tienda);
    setManualStoreSelection(false);
    setSkuInput('');
    setStep('confirm');
  };

  const checkRemainingInventory = async () => {
    const { data: inv } = await supabase
      .from('pallet_inventory')
      .select('*')
      .eq('pallet_id', pallet.id)
      .gt('qty_available', 0);
    setRemainingInventory(inv ?? []);
    return inv ?? [];
  };

  useEffect(() => {
    if (step === 'scan' && !selectedSku) {
      checkRemainingInventory();
    }
  }, [step, selectedSku]);

  const handleConfirm = async (e) => {
    e?.preventDefault();

    if (!hasUser) {
      setError('Sesión no cargada. Por favor, vuelve a iniciar sesión.');
      return;
    }

    if (!selectedLine || !quantity) return;

    const qty = parseFloat(quantity);
    if (qty <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    const pending = (selectedLine.qty_to_send || 0) - (selectedLine.qty_confirmed || 0);
    if (pending <= 0) {
      setError('Esta línea ya está completa');
      return;
    }

    if (continueMode && targetStoreName) {
      const lineStoreName = String(selectedLine.tienda);
      const targetStoreNameStr = String(targetStoreName);

      if (lineStoreName !== targetStoreNameStr) {
        console.log(
          '[CONTINUE_MODE] ❌ BLOQUEADO: Intento de confirmar para tienda incorrecta | Línea:',
          lineStoreName,
          '| Objetivo:',
          targetStoreNameStr
        );
        const errorMsg = `Solo puedes distribuir a ${targetStoreNameStr} en modo continuar`;
        setError(errorMsg);
        showToast('error', 'Tienda incorrecta', errorMsg);
        return;
      }

      console.log('[CONTINUE_MODE] ✅ Validación de tienda OK | Línea:', lineStoreName, '| Objetivo:', targetStoreNameStr);
    }

    if (continueMode && !continueContainerId) {
      console.error('[CONTINUE_MODE] ❌ CRÍTICO: continueMode=true pero continueContainerId es null. Abortando.');
      setError('Error interno: no se encontró el contenedor a continuar. Vuelve a Contenedores.');
      return;
    }

    const { data: currentInv } = await supabase
      .from('pallet_inventory')
      .select('*')
      .eq('pallet_id', pallet.id)
      .eq('sku', selectedSku)
      .maybeSingle();

    if (!currentInv || qty > currentInv.qty_available) {
      setError('Cantidad mayor al disponible en pallet');
      return;
    }
    if (qty > pending) {
      setError('Cantidad mayor al pendiente del pedido');
      return;
    }

    console.log(
      `[DistribucionModal] 🔄 Iniciando confirmación | SKU: ${selectedSku} | Tienda: ${selectedLine.tienda} | Qty: ${qty} | Pallet: ${pallet.pallet_code}`
    );

    try {
      let containerId;

      if (continueMode) {
        console.log(
          `[DistribucionModal] 🔒 CONTINUE_MODE guard activo | Usando contenedor existente: ${continueContainerId}`
        );

        const editable = await isContainerEditable(continueContainerId);
        if (!editable) {
          setError('El contenedor que estás continuando ya fue cerrado. Vuelve a Contenedores.');
          return;
        }

        containerId = continueContainerId;
        console.log(`[DistribucionModal] ✅ containerId fijado (CONTINUE): ${containerId}`);
      } else {
        console.log(
          `[DistribucionModal] 🆕 Modo normal: getOrCreateOpenContainer | Import: ${selectedLine.import_id} | Tienda: ${selectedLine.tienda}`
        );
        containerId = await getOrCreateOpenContainer(selectedLine.import_id, selectedLine.tienda, user.id);
        console.log(`[DistribucionModal] ✅ containerId fijado (NORMAL): ${containerId}`);
      }

      const editable = await isContainerEditable(containerId);
      if (!editable) {
        setError('El contenedor de esta tienda ya está cerrado');
        return;
      }

      const { error: invError } = await supabase
        .from('pallet_inventory')
        .update({ qty_available: currentInv.qty_available - qty })
        .eq('id', currentInv.id);
      if (invError) throw invError;

      const newConfirmed = (selectedLine.qty_confirmed || 0) + qty;
      const newStatus = newConfirmed >= (selectedLine.qty_to_send || 0) ? 'DONE' : 'PARTIAL';

      const { error: lineError } = await supabase
        .from('import_lines')
        .update({
          qty_confirmed: newConfirmed,
          status: newStatus,
          ...(newStatus === 'DONE' ? { done_at: new Date().toISOString(), done_by: user.id } : {}),
        })
        .eq('id', selectedLine.id);
      if (lineError) throw lineError;

      const { error: containerLineError } = await supabase.from('container_lines').insert({
        container_id: containerId,
        pallet_id: pallet.id,
        sku: selectedSku,
        qty,
        source_import_line_id: selectedLine.id,
      });
      if (containerLineError) throw containerLineError;

      const { error: moveError } = await supabase.from('distribution_moves').insert({
        import_id: selectedLine.import_id,
        pallet_id: pallet.id,
        sku: selectedSku,
        tienda: selectedLine.tienda,
        qty,
        user_id: user.id,
        source_import_line_id: selectedLine.id,
      });
      if (moveError) throw moveError;

      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'CONFIRM_QTY',
        sku: selectedSku,
        tienda: selectedLine.tienda,
        qty,
        user_id: user.id,
      });

      showToast('success', 'Confirmado', `${qty} uds de ${selectedSku} → ${selectedLine.tienda}`);

      await loadSkuProgress();

      const currentStorePending = newConfirmed >= (selectedLine.qty_to_send || 0) ? 0 : (selectedLine.qty_to_send || 0) - newConfirmed;

      if (manualStoreSelection && currentStorePending > 0) {
        setSelectedLine({ ...selectedLine, qty_confirmed: newConfirmed, status: newStatus });
        setQuantity('');
        setError('');
        setTimeout(() => qtyInputRef.current?.focus(), 100);
        return;
      }

      const nextLine = await getNextPendingLine(selectedSku);

      const { data: updatedInv } = await supabase
        .from('pallet_inventory')
        .select('*')
        .eq('pallet_id', pallet.id)
        .eq('sku', selectedSku)
        .maybeSingle();

      const hasInventory = updatedInv && updatedInv.qty_available > 0;

      if (nextLine && hasInventory) {
        const prevTienda = previousTiendaRef.current;

        if (prevTienda && prevTienda !== nextLine.tienda && !continueMode) {
          setTiendaChange({ prev: prevTienda, next: nextLine.tienda, sku: selectedSku });
        }

        previousTiendaRef.current = nextLine.tienda;
        setSelectedLine(nextLine);
        setSelectedStore(nextLine.tienda);
        setManualStoreSelection(false);
        setQuantity('');
        setError('');
        setTimeout(() => qtyInputRef.current?.focus(), 100);
      } else {
        setStep('scan');
        setSelectedSku('');
        setSelectedLine(null);
        setSelectedStore('');
        setManualStoreSelection(false);
        setQuantity('');
        setError('');
        previousTiendaRef.current = null;

        const remaining = await checkRemainingInventory();

        if (!remaining || remaining.length === 0) {
          console.log(`[DistribucionModal] 🎉 Pallet agotado completamente | Pallet: ${pallet.pallet_code}`);
          showToast('info', 'Pallet agotado', 'Todo el inventario ha sido distribuido');
          onComplete();
        }
      }
    } catch (err) {
      console.error('[DistribucionModal] ❌ Error en handleConfirm:', err);
      setError(`Error al confirmar: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  };

  const handleOpenCloseModal = async () => {
    if (!hasUser) {
      showToast('error', 'Error de sesión', 'Vuelve a iniciar sesión.');
      return;
    }

    const resolvedImportId = importId || pendingLines[0]?.import_id;
    if (!resolvedImportId) {
      showToast('error', 'Error', 'No se encontró el ID de importación');
      return;
    }

    const { data: openContainers } = await supabase
      .from('containers')
      .select('tienda')
      .eq('import_id', resolvedImportId)
      .eq('status', 'OPEN');

    if (!openContainers || openContainers.length === 0) {
      showToast('warning', 'Sin contenedores', 'No hay contenedores abiertos para cerrar');
      return;
    }

    const tiendas = [...new Set(openContainers.map((c) => c.tienda))];
    setAvailableTiendas(tiendas);
    if (tiendas.length === 1) setSelectedTiendaToClose(tiendas[0]);
    setShowCloseModal(true);
  };

  const handleCerrarDistribucion = async () => {
    if (!hasUser || !selectedTiendaToClose) return;
    setClosingInProgress(true);

    try {
      let containerToClose = null;

      if (continueMode && continueContainerId) {
        console.log(
          `[DistribucionModal] 🔒 CONTINUE_MODE: Cerrando contenedor existente: ${continueContainerId}`
        );
        const { data: cont } = await supabase
          .from('containers')
          .select('id, code, tienda, status')
          .eq('id', continueContainerId)
          .maybeSingle();

        if (!cont || cont.status !== 'OPEN') {
          showToast('error', 'Sin contenedor', 'El contenedor ya fue cerrado o no existe');
          setShowCloseModal(false);
          setSelectedTiendaToClose('');
          return;
        }
        containerToClose = { id: cont.id, code: cont.code, tienda: cont.tienda };
      } else {
        const resolvedImportId = importId || pendingLines[0]?.import_id;
        if (!resolvedImportId) throw new Error('No se encontró el ID de importación');

        const { data: openContainer } = await supabase
          .from('containers')
          .select('id, code, tienda')
          .eq('import_id', resolvedImportId)
          .eq('tienda', selectedTiendaToClose)
          .eq('status', 'OPEN')
          .maybeSingle();

        if (!openContainer) {
          showToast('error', 'Sin contenedor', 'No hay contenedor abierto para esta tienda');
          setShowCloseModal(false);
          setSelectedTiendaToClose('');
          return;
        }
        containerToClose = openContainer;
      }

      const { count } = await supabase
        .from('container_lines')
        .select('id', { count: 'exact' })
        .eq('container_id', containerToClose.id);

      if (!count || count === 0) {
        showToast('warning', 'Contenedor vacío', 'Confirma cantidades antes de cerrar');
        setShowCloseModal(false);
        setSelectedTiendaToClose('');
        return;
      }

      // ✅ Cerrar contenedor
      const { error: updateError } = await supabase
        .from('containers')
        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
        .eq('id', containerToClose.id);
      if (updateError) throw updateError;

      await supabase.from('scan_events').insert({
        pallet_id: pallet.id,
        event_type: 'CLOSE',
        tienda: selectedTiendaToClose,
        notes: `Contenedor ${containerToClose.code} cerrado con ${count} líneas`,
        user_id: user.id,
      });

      console.log(
        `[DistribucionModal] ✅ Contenedor cerrado: ${containerToClose.code} | Tienda: ${selectedTiendaToClose} | Líneas: ${count} | CONTINUE_MODE: ${continueMode}`
      );

      showToast(
        'success',
        `Contenedor ${containerToClose.code} cerrado`,
        `Tienda: ${selectedTiendaToClose} · ${count} líneas`,
        6000
      );

      // ✅ Imprimir automáticamente después del cierre exitoso
      console.log('[PRINT_ON_CLOSE] Iniciando impresión automática...', {
        containerId: containerToClose.id,
        containerCode: containerToClose.code,
        tienda: containerToClose.tienda
      });

      try {
        const printResult = await printContainerById(
          containerToClose.id,
          containerToClose.code,
          containerToClose.tienda
        );

        if (printResult.success) {
          console.log('[PRINT_ON_CLOSE] ✅ Impresión completada exitosamente');
        } else {
          console.error('[PRINT_ON_CLOSE] ❌ Error en impresión:', printResult.error);
          showToast(
            'warning',
            'Cerrado, pero no se pudo imprimir',
            'Puedes reimprimir desde el módulo Contenedores',
            5000
          );
        }
      } catch (printError) {
        console.error('[PRINT_ON_CLOSE] ❌ Excepción en impresión:', printError);
        showToast(
          'warning',
          'Cerrado, pero no se pudo imprimir',
          'Puedes reimprimir desde el módulo Contenedores',
          5000
        );
      }

      setShowCloseModal(false);
      setSelectedTiendaToClose('');
      onComplete();
    } catch (err) {
      console.error('[DistribucionModal] Error al cerrar contenedor:', err);
      showToast('error', 'Error al cerrar', err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setClosingInProgress(false);
    }
  };

  const loadAvailableTiendas = async () => {
    const resolvedImportId = importId || pendingLines[0]?.import_id;
    if (!resolvedImportId) return;
    const { data: openContainers } = await supabase
      .from('containers')
      .select('tienda')
      .eq('import_id', resolvedImportId)
      .eq('status', 'OPEN');
    if (openContainers) {
      const tiendas = [...new Set(openContainers.map((c) => c.tienda))];
      setAvailableTiendas(tiendas);
      if (tiendas.length === 1) setSelectedTiendaToClose(tiendas[0]);
    }
  };

  const currentPending = selectedLine ? Math.max(0, (selectedLine.qty_to_send || 0) - (selectedLine.qty_confirmed || 0)) : 0;
  const isConfirmDisabled = !hasUser || !quantity || parseFloat(quantity) <= 0 || currentPending <= 0;

  console.log('[ModalProps] open= true | lines=', pendingLines?.length);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-[9999]">
        <div className="bg-white w-full md:max-w-2xl md:rounded-xl shadow-xl flex flex-col max-h-[95vh] md:max-h-[90vh] rounded-t-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-base md:text-xl font-bold text-gray-900">Distribución</h2>
              <p className="text-xs text-gray-500 font-mono">{pallet.pallet_code}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"
            >
              <i className="ri-close-line text-xl"></i>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Session error */}
            {!hasUser && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-500 text-lg mt-0.5 flex-shrink-0"></i>
                <p className="text-sm text-red-700">
                  {authLoading ? 'Cargando sesión...' : 'Sesión no disponible. Vuelve a iniciar sesión.'}
                </p>
              </div>
            )}

            {step === 'scan' ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-4">
                  <i className="ri-barcode-line text-3xl text-white"></i>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Leer SKU / Código de Barra</h3>
                <p className="text-sm text-gray-500 mb-5 text-center">
                  Escanea el producto con el handheld o ingrésalo manualmente
                </p>

                {error && (
                  <div className="w-full bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm mb-4 flex items-center gap-2">
                    <i className="ri-error-warning-line flex-shrink-0"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSkuSubmit} className="w-full space-y-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <i className="ri-barcode-line text-gray-400 text-lg"></i>
                    </div>
                    <input
                      ref={skuInputRef}
                      type="text"
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSkuSubmit();
                      }}
                      placeholder="SKU o código de barra..."
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      className="w-full pl-10 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base font-mono tracking-wider text-gray-900 placeholder-gray-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!hasUser || !skuInput.trim()}
                    className="w-full py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <i className="ri-search-line text-lg"></i>
                    Buscar SKU
                  </button>
                </form>

                {/* Surplus banner */}
                {remainingInventory.length > 0 && (
                  <div className="w-full mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-start gap-2.5 mb-3">
                      <i className="ri-archive-2-line text-amber-600 text-lg flex-shrink-0 mt-0.5"></i>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Inventario restante en pallet
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          Si ya terminaste la distribución y sobra mercadería, puedes reportarla como sobrante.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {remainingInventory.map((inv) => (
                        <div
                          key={inv.id}
                          className="flex items-center justify-between bg-white/60 rounded-lg px-3 py-2"
                        >
                          <span className="text-xs font-mono font-semibold text-gray-700">{inv.sku}</span>
                          <span className="text-sm font-bold text-amber-600">{inv.qty_available} uds</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowSobrante(true)}
                      disabled={!hasUser}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-semibold text-sm hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-archive-2-line"></i>
                      Reportar Sobrante
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-4 text-center">
                  <i className="ri-information-line mr-1"></i>
                  El handheld enviará el código automáticamente al presionar Enter
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* SKU progress bar */}
                {skuProgress && (
                  <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="text-base font-bold text-gray-900 font-mono">{selectedSku}</h3>
                        <p className="text-xs text-gray-500">Progreso total del SKU</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-teal-600">{skuProgress.percentage}%</div>
                        <div className="text-xs text-gray-500">
                          {skuProgress.confirmed}/{skuProgress.total} uds
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-teal-500 to-cyan-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${skuProgress.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Active store */}
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-500">Tienda Activa:</span>
                      <span className="text-base font-bold text-sky-700">{selectedStore}</span>
                      {selectedLine?.camion && (
                        <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <i className="ri-truck-line"></i>
                          {selectedLine.camion}
                        </span>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        manualStoreSelection
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {manualStoreSelection ? (
                        <>
                          <i className="ri-hand-coin-line mr-1"></i>
                          Manual
                        </>
                      ) : (
                        <>
                          <i className="ri-robot-line mr-1"></i>
                          Auto
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Pendiente:</span>
                    <span className={`text-xl font-bold ${currentPending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {currentPending} uds
                    </span>
                  </div>
                  {manualStoreSelection && (
                    <button
                      onClick={handleBackToAuto}
                      className="mt-2 w-full px-3 py-2 bg-white border border-sky-200 text-sky-700 rounded-lg text-xs font-medium hover:bg-sky-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <i className="ri-robot-line"></i>
                      Volver a modo automático
                    </button>
                  )}
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2.5 rounded-lg text-sm flex items-center gap-2">
                    <i className="ri-error-warning-line flex-shrink-0"></i>
                    {error}
                  </div>
                )}

                {currentPending <= 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2.5 rounded-lg text-sm flex items-center gap-2">
                    <i className="ri-checkbox-circle-line flex-shrink-0"></i>
                    Esta tienda ya está completa
                  </div>
                )}

                {/* Quantity input */}
                <form onSubmit={handleConfirm}>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cantidad a confirmar
                  </label>
                  <div className="flex gap-2">
                    <input
                      ref={qtyInputRef}
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirm();
                      }}
                      className="flex-1 px-4 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-2xl font-bold text-center text-gray-900"
                      placeholder="0"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      disabled={currentPending <= 0 || !hasUser}
                    />
                  </div>
                </form>

                {/* Tiendas progress table */}
                {tiendasProgress.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Distribución por Tienda
                      </h4>
                      <p className="text-xs text-gray-400">Toca para seleccionar</p>
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {tiendasProgress.map((tienda) => {
                        const isActive = tienda.tienda === selectedStore;
                        const isClickable = tienda.pending > 0;
                        return (
                          <div
                            key={tienda.tienda}
                            onClick={() => handleStoreClick(tienda)}
                            className={`flex items-center justify-between px-3 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                              isActive
                                ? 'bg-sky-50'
                                : isClickable
                                ? 'hover:bg-teal-50 cursor-pointer active:bg-teal-100'
                                : 'opacity-50 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {isActive ? (
                                <i className="ri-checkbox-circle-fill text-sky-500 text-lg flex-shrink-0"></i>
                              ) : isClickable ? (
                                <i className="ri-radio-button-line text-gray-300 text-lg flex-shrink-0"></i>
                              ) : (
                                <i className="ri-checkbox-circle-fill text-emerald-400 text-lg flex-shrink-0"></i>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-sm font-semibold truncate ${
                                      isActive ? 'text-sky-700' : 'text-gray-900'
                                    }`}
                                  >
                                    {tienda.tienda}
                                  </span>
                                  {isActive && (
                                    <span className="px-1.5 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded uppercase">
                                      Activa
                                    </span>
                                  )}
                                </div>
                                {tienda.camion && (
                                  <span className="text-xs text-amber-600 flex items-center gap-0.5 mt-0.5">
                                    <i className="ri-truck-line"></i>
                                    {tienda.camion}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                              <div className="text-right">
                                <div className="text-xs text-gray-400">
                                  {tienda.qty_confirmed}/{tienda.qty_to_send}
                                </div>
                                <div
                                  className={`text-sm font-bold ${
                                    tienda.pending > 0 ? 'text-amber-600' : 'text-emerald-600'
                                  }`}
                                >
                                  {tienda.pending > 0 ? `${tienda.pending} pend.` : 'Listo'}
                                </div>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  tienda.status === 'DONE'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : tienda.status === 'PARTIAL'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {tienda.status === 'DONE'
                                  ? 'Listo'
                                  : tienda.status === 'PARTIAL'
                                  ? 'Parcial'
                                  : 'Pend.'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setStep('scan');
                      setSelectedSku('');
                      setSelectedLine(null);
                      setSelectedStore('');
                      setManualStoreSelection(false);
                      setQuantity('');
                      setError('');
                      previousTiendaRef.current = null;
                    }}
                    className="flex-1 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm cursor-pointer whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={isConfirmDisabled}
                    className="flex-1 py-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer whitespace-nowrap"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={handleOpenCloseModal}
              disabled={!hasUser}
              className="w-full py-3.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer whitespace-nowrap"
            >
              <i className="ri-inbox-line text-lg"></i>
              Cerrar Distribución
            </button>
          </div>
        </div>
      </div>

      {/* Close distribution modal */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[10000]">
          <div className="bg-white w-full md:max-w-md md:rounded-xl shadow-2xl rounded-t-2xl">
            <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gray-200">
              <h3 className="text-base md:text-lg font-bold text-gray-900">Cerrar Distribución</h3>
              <button
                onClick={() => {
                  setShowCloseModal(false);
                  setSelectedTiendaToClose('');
                }}
                disabled={closingInProgress}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 cursor-pointer"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-4 md:p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                <i className="ri-alert-line text-amber-600 text-lg flex-shrink-0 mt-0.5"></i>
                <p className="text-sm text-amber-700">
                  El contenedor cambiará a estado CLOSED y no se podrán agregar más líneas.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Selecciona la tienda
                </label>
                <select
                  value={selectedTiendaToClose}
                  onChange={(e) => setSelectedTiendaToClose(e.target.value)}
                  onFocus={loadAvailableTiendas}
                  className="w-full px-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 text-sm cursor-pointer bg-white"
                  disabled={closingInProgress}
                >
                  <option value="">-- Seleccionar tienda --</option>
                  {availableTiendas.map((tienda) => (
                    <option key={tienda} value={tienda}>
                      {tienda}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setSelectedTiendaToClose('');
                  }}
                  disabled={closingInProgress}
                  className="flex-1 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm cursor-pointer whitespace-nowrap"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCerrarDistribucion}
                  disabled={!selectedTiendaToClose || closingInProgress}
                  className="flex-1 py-3.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white rounded-xl font-semibold hover:from-rose-600 hover:to-rose-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer whitespace-nowrap"
                >
                  {closingInProgress ? (
                    <>
                      <i className="ri-loader-4-line animate-spin"></i>Cerrando...
                    </>
                  ) : (
                    <>
                      <i className="ri-check-line"></i>Confirmar Cierre
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tiendaChange && (
        <TiendaChangePopup
          previousTienda={tiendaChange.prev}
          newTienda={tiendaChange.next}
          sku={tiendaChange.sku}
          onClose={() => setTiendaChange(null)}
        />
      )}

      {showSobrante && (
        <SobranteModal
          pallet={pallet}
          importId={importId || pendingLines[0]?.import_id}
          onClose={() => {
            setShowSobrante(false);
            checkRemainingInventory();
          }}
          onComplete={() => {
            setShowSobrante(false);
            showToast('success', 'Sobrante procesado', 'El pallet ha sido liberado');
            onComplete();
          }}
        />
      )}
    </>
  );
}
