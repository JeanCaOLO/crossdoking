import{s as p,r as f}from"./index-Cs4jv5r8.js";import{s as g,Q as u}from"./index-D5-ZigaA.js";async function h(s){try{const{data:r,error:o}=await p.from("container_lines").select(`
        id, qty, sku, pallet_id,
        pallets(id, pallet_code, ubicacion),
        import_lines:source_import_line_id(id, descripcion, barcode)
      `).eq("container_id",s);if(o)return console.error("[PRINT] Error cargando líneas:",o),{rows:[],error:o.message};const e=new Map;return(r||[]).forEach(i=>{const a=i.pallets?.pallet_code??"—",n=`${a}|${i.sku}`;if(e.has(n)){const c=e.get(n);c.qty+=Number(i.qty)||0}else e.set(n,{pallet_code:a,sku:i.sku,descripcion:i.import_lines?.descripcion??"",qty:Number(i.qty)||0})}),{rows:Array.from(e.values())}}catch(r){return console.error("[PRINT] Error inesperado:",r),{rows:[],error:r instanceof Error?r.message:"Error desconocido"}}}function b(s,r,o){try{console.log("[PRINT] Generando etiqueta:",{containerCode:s,containerTienda:r,lines:o.length});const e=g.renderToStaticMarkup(f.createElement(u,{value:s,size:200,level:"H"})),i=o.map(l=>`
        <tr>
          <td>${l.sku}</td>
          <td>${l.descripcion||"—"}</td>
          <td style="text-align:center;">${l.qty}</td>
          <td>${l.pallet_code}</td>
        </tr>`).join(""),a=o.reduce((l,m)=>l+m.qty,0),n=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),c=`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta Contenedor ${s}</title>
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
    <div class="qr-block">${e}</div>
    <div class="info-block">
      <div class="label">Contenedor</div>
      <h1>${s}</h1>
      <div class="label" style="margin-top:12px;">Tienda</div>
      <div class="value">${r}</div>
      <div class="label" style="margin-top:8px;">Total unidades</div>
      <div class="value">${a}</div>
      <div class="label" style="margin-top:8px;">Fecha cierre</div>
      <div class="value">${n}</div>
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
      ${i||'<tr><td colspan="4" style="text-align:center;padding:12px;color:#999;">Sin líneas registradas</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Total: ${a} unidades</div>
</body>
</html>`,t=document.createElement("iframe");t.style.position="fixed",t.style.right="0",t.style.bottom="0",t.style.width="0",t.style.height="0",t.style.border="0",document.body.appendChild(t);const d=t.contentWindow?.document;if(!d)throw console.error("[PRINT] ❌ No se pudo acceder al documento del iframe"),new Error("No se pudo abrir la impresión");d.open(),d.write(c),d.close(),t.onload=()=>{setTimeout(()=>{try{t.contentWindow?.focus(),t.contentWindow?.print(),console.log("[PRINT] ✅ Impresión iniciada"),setTimeout(()=>{document.body.removeChild(t)},1e3)}catch(l){throw console.error("[PRINT] ❌ Error al imprimir:",l),document.body.removeChild(t),new Error("No se pudo abrir la impresión")}},300)}}catch(e){throw console.error("[PRINT] ❌ Error generando etiqueta:",e),e}}async function v(s,r,o){try{if(console.log("[PRINT_ON_CLOSE] Iniciando impresión para containerId:",s),!r||!o){const{data:a,error:n}=await p.from("containers").select("code, tienda").eq("id",s).maybeSingle();if(n||!a)return console.error("[PRINT_ON_CLOSE] Error cargando contenedor:",n),{success:!1,error:"No se pudo cargar la información del contenedor"};r=a.code,o=a.tienda}const{rows:e,error:i}=await h(s);return i?{success:!1,error:i}:(b(r,o,e),{success:!0})}catch(e){return console.error("[PRINT_ON_CLOSE] Error inesperado:",e),{success:!1,error:e instanceof Error?e.message:"Error desconocido"}}}export{v as p};
//# sourceMappingURL=containerPrint-DGxbMbq2.js.map
