import{j as e,L as Y,u as J,c as X,r as l,s as u,b as Z,a as ee}from"./index-Cs4jv5r8.js";import{s as te,Q as se}from"./index-D5-ZigaA.js";const re={OPEN:{bg:"bg-sky-100 text-sky-700",label:"Abierto"},CLOSED:{bg:"bg-amber-100 text-amber-700",label:"Cerrado"},DISPATCHED:{bg:"bg-emerald-100 text-emerald-700",label:"Despachado"}};function I(o){const d=new Date(o);return Number.isNaN(d.getTime())?"Fecha no válida":d.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}function ae({code:o,tienda:d,camion:n,status:m,createdAt:s,closedAt:b,createdByEmail:y}){const r=re[m]??{bg:"bg-gray-100 text-gray-700",label:m};return e.jsxs("div",{children:[e.jsxs(Y,{to:"/contenedores",className:"text-teal-600 hover:text-teal-700 text-sm font-medium mb-3 inline-flex items-center cursor-pointer",children:[e.jsx("i",{className:"ri-arrow-left-line mr-1"}),"Volver a Contenedores"]}),e.jsxs("div",{className:"bg-white rounded-xl border border-gray-100 p-4 md:p-5 mt-2",children:[e.jsxs("div",{className:"flex items-start justify-between gap-3 flex-wrap",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center flex-shrink-0",children:e.jsx("i",{className:"ri-inbox-line text-xl md:text-2xl text-white"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg md:text-xl font-bold text-gray-900 font-mono",children:o}),e.jsxs("div",{className:"flex items-center gap-2 mt-0.5 flex-wrap",children:[e.jsx("span",{className:"text-sm text-gray-600 font-medium",children:d}),n&&e.jsxs("span",{className:"inline-flex items-center gap-1 text-xs text-amber-600 font-medium",children:[e.jsx("i",{className:"ri-truck-line"}),n]})]})]})]}),e.jsx("span",{className:`px-3 py-1.5 rounded-full text-xs font-semibold ${r.bg}`,children:r.label})]}),e.jsxs("div",{className:"grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100",children:[e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] uppercase tracking-wider text-gray-400 font-medium",children:"Creado"}),e.jsx("p",{className:"text-xs md:text-sm text-gray-800 mt-1",children:I(s)})]}),b&&e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] uppercase tracking-wider text-gray-400 font-medium",children:"Cerrado"}),e.jsx("p",{className:"text-xs md:text-sm text-gray-800 mt-1",children:I(b)})]}),y&&e.jsxs("div",{children:[e.jsx("p",{className:"text-[10px] uppercase tracking-wider text-gray-400 font-medium",children:"Creado por"}),e.jsx("p",{className:"text-xs md:text-sm text-gray-800 mt-1",children:y})]})]})]})]})}function ne({totalPallets:o,totalSkus:d,totalUnits:n}){const m=[{label:"Pallets",value:o,icon:"ri-stack-line",gradient:"from-teal-500 to-cyan-600"},{label:"SKUs distintos",value:d,icon:"ri-barcode-line",gradient:"from-violet-500 to-purple-600"},{label:"Unidades totales",value:n.toLocaleString("es-ES"),icon:"ri-hashtag",gradient:"from-rose-500 to-pink-600"}];return e.jsx("div",{className:"grid grid-cols-3 gap-3 md:gap-4",children:m.map(s=>e.jsxs("div",{className:"bg-white rounded-xl border border-gray-100 p-3 md:p-5 flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4",children:[e.jsx("div",{className:`w-9 h-9 md:w-11 md:h-11 bg-gradient-to-br ${s.gradient} rounded-lg flex items-center justify-center flex-shrink-0`,children:e.jsx("i",{className:`${s.icon} text-base md:text-xl text-white`})}),e.jsxs("div",{className:"text-center md:text-left",children:[e.jsx("p",{className:"text-xl md:text-2xl font-bold text-gray-900",children:s.value}),e.jsx("p",{className:"text-[10px] md:text-xs text-gray-500 mt-0.5 leading-tight",children:s.label})]})]},s.label))})}function ie({rows:o,containerStatus:d,onReverse:n}){const m=d!=="DISPATCHED";return o.length===0?e.jsxs("div",{className:"bg-white rounded-xl border border-gray-100 p-10 text-center",children:[e.jsx("div",{className:"w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3",children:e.jsx("i",{className:"ri-inbox-line text-3xl text-gray-300"})}),e.jsx("p",{className:"text-sm text-gray-500",children:"No hay líneas en este contenedor"})]}):e.jsxs("div",{className:"bg-white rounded-xl border border-gray-100 overflow-hidden",children:[e.jsxs("div",{className:"px-4 py-3 md:px-6 md:py-4 border-b border-gray-100",children:[e.jsx("h3",{className:"text-base md:text-lg font-bold text-gray-900",children:"Contenido del Contenedor"}),e.jsxs("p",{className:"text-xs text-gray-500 mt-0.5",children:[o.length," líneas registradas"]})]}),e.jsx("div",{className:"md:hidden divide-y divide-gray-100",children:o.map(s=>e.jsxs("div",{className:"p-4 space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between gap-2",children:[e.jsxs("div",{className:"flex items-center gap-2 min-w-0",children:[e.jsx("div",{className:"w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center flex-shrink-0",children:e.jsx("i",{className:"ri-stack-line text-white text-sm"})}),e.jsx("span",{className:"text-sm font-bold text-gray-900 font-mono truncate",children:s.pallet_code})]}),e.jsx("span",{className:"text-xl font-bold text-teal-600 flex-shrink-0",children:s.qty})]}),e.jsxs("div",{className:"flex items-center gap-2 flex-wrap",children:[e.jsx("span",{className:"inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-100 text-sky-700 font-mono",children:s.sku}),s.ubicacion&&e.jsxs("span",{className:"text-xs text-gray-500",children:[e.jsx("i",{className:"ri-map-pin-line mr-0.5"}),s.ubicacion]})]}),s.descripcion&&e.jsx("p",{className:"text-xs text-gray-600 leading-snug",children:s.descripcion}),s.barcode&&e.jsx("p",{className:"text-xs text-gray-400 font-mono",children:s.barcode}),m&&e.jsxs("button",{onClick:()=>n?.(s.id),className:"w-full mt-1 py-2.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 active:bg-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5",children:[e.jsx("i",{className:"ri-arrow-go-back-line"}),"Reversar línea"]})]},s.id))}),e.jsx("div",{className:"hidden md:block overflow-x-auto",children:e.jsxs("table",{className:"w-full",children:[e.jsx("thead",{className:"bg-gray-50 border-b border-gray-100",children:e.jsxs("tr",{children:[e.jsx("th",{className:"px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"Pallet"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"Ubicación"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"SKU"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"Descripción"}),e.jsx("th",{className:"px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"Código de Barra"}),e.jsx("th",{className:"px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"Cantidad"}),m&&e.jsx("th",{className:"px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider",children:"Acciones"})]})}),e.jsx("tbody",{className:"divide-y divide-gray-100",children:o.map(s=>e.jsxs("tr",{className:"hover:bg-gray-50 transition-colors",children:[e.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-8 h-8 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg flex items-center justify-center",children:e.jsx("i",{className:"ri-stack-line text-white text-sm"})}),e.jsx("span",{className:"text-sm font-semibold text-gray-900 font-mono",children:s.pallet_code})]})}),e.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500",children:s.ubicacion||"—"}),e.jsx("td",{className:"px-6 py-4 whitespace-nowrap",children:e.jsx("span",{className:"inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-100 text-sky-700 font-mono",children:s.sku})}),e.jsx("td",{className:"px-6 py-4 text-sm text-gray-700",children:s.descripcion||"—"}),e.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono",children:s.barcode||"—"}),e.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-center",children:e.jsx("span",{className:"text-sm font-bold text-teal-600",children:s.qty})}),m&&e.jsx("td",{className:"px-6 py-4 whitespace-nowrap text-center",children:e.jsxs("button",{onClick:()=>n?.(s.id),className:"inline-flex items-center px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer gap-1.5",children:[e.jsx("i",{className:"ri-arrow-go-back-line"}),"Reversar"]})})]},s.id))})]})})]})}function le({lineId:o,onClose:d,onSuccess:n}){const{user:m}=J(),{showToast:s}=X(),[b,y]=l.useState(!1),[r,R]=l.useState(null),[C,j]=l.useState("");l.useEffect(()=>{S()},[o]);const S=async()=>{try{const{data:i,error:g}=await u.from("container_lines").select(`
          id,
          container_id,
          pallet_id,
          sku,
          qty,
          source_import_line_id,
          pallets(pallet_code),
          import_lines:source_import_line_id(descripcion, tienda)
        `).eq("id",o).maybeSingle();if(g)throw g;if(!i){j("Línea no encontrada");return}R({id:i.id,container_id:i.container_id,pallet_id:i.pallet_id,sku:i.sku,qty:i.qty,source_import_line_id:i.source_import_line_id,pallet_code:i.pallets?.pallet_code||"—",descripcion:i.import_lines?.descripcion||"—",tienda:i.import_lines?.tienda||"—"})}catch(i){console.error("Error cargando detalles de línea:",i),j("Error al cargar los detalles")}},E=async()=>{if(!(!r||!m)){y(!0),j("");try{const{data:i}=await u.from("containers").select("status").eq("id",r.container_id).maybeSingle();if(!i)throw new Error("Contenedor no encontrado");if(i.status==="DISPATCHED")throw new Error("No se pueden reversar líneas de contenedores despachados");const{data:g}=await u.from("pallet_inventory").select("qty_available").eq("pallet_id",r.pallet_id).eq("sku",r.sku).maybeSingle();if(!g)throw new Error("Inventario del pallet no encontrado");const{error:w}=await u.from("pallet_inventory").update({qty_available:g.qty_available+r.qty}).eq("pallet_id",r.pallet_id).eq("sku",r.sku);if(w)throw w;const{data:h}=await u.from("import_lines").select("qty_confirmed, qty_to_send").eq("id",r.source_import_line_id).maybeSingle();if(!h)throw new Error("Línea de importación no encontrada");const N=Math.max(0,h.qty_confirmed-r.qty),_=N===0?"PENDING":N>=h.qty_to_send?"DONE":"PARTIAL",{error:k}=await u.from("import_lines").update({qty_confirmed:N,status:_,..._!=="DONE"?{done_at:null,done_by:null}:{}}).eq("id",r.source_import_line_id);if(k)throw k;const{error:q}=await u.from("container_lines").delete().eq("id",r.id);if(q)throw q;await u.from("scan_events").insert({pallet_id:r.pallet_id,event_type:"REVERSE",sku:r.sku,tienda:r.tienda,qty:r.qty,user_id:m.id,notes:"Reversión de línea de contenedor"}),s("success","Línea reversada",`${r.qty} uds de ${r.sku} devueltas al pallet ${r.pallet_code}`),n(),d()}catch(i){console.error("Error reversando línea:",i),j(i.message||"Error al reversar la línea"),s("error","Error",i.message||"No se pudo reversar la línea")}finally{y(!1)}}};return r?e.jsx("div",{className:"fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",children:e.jsxs("div",{className:"bg-white rounded-xl shadow-xl max-w-md w-full",children:[e.jsx("div",{className:"p-6 border-b border-gray-200",children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("h3",{className:"text-xl font-bold text-gray-900",children:"Reversar Línea"}),e.jsx("button",{onClick:d,disabled:b,className:"text-gray-400 hover:text-gray-600 cursor-pointer",children:e.jsx("i",{className:"ri-close-line text-2xl"})})]})}),e.jsxs("div",{className:"p-6",children:[e.jsx("div",{className:"bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6",children:e.jsxs("div",{className:"flex items-start",children:[e.jsx("i",{className:"ri-alert-line text-amber-600 text-xl mr-3 mt-0.5"}),e.jsxs("div",{children:[e.jsx("p",{className:"text-sm font-medium text-amber-900 mb-1",children:"Confirmar reversión"}),e.jsx("p",{className:"text-sm text-amber-700",children:"Esta acción devolverá la cantidad al pallet de origen y actualizará el estado del pedido."})]})]})}),C&&e.jsx("div",{className:"bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6",children:C}),e.jsxs("div",{className:"space-y-4 mb-6",children:[e.jsxs("div",{className:"flex items-center justify-between py-2 border-b border-gray-100",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Pallet:"}),e.jsx("span",{className:"text-sm font-semibold text-gray-900",children:r.pallet_code})]}),e.jsxs("div",{className:"flex items-center justify-between py-2 border-b border-gray-100",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:"SKU:"}),e.jsx("span",{className:"text-sm font-semibold text-gray-900",children:r.sku})]}),e.jsxs("div",{className:"flex items-center justify-between py-2 border-b border-gray-100",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Descripción:"}),e.jsx("span",{className:"text-sm text-gray-900",children:r.descripcion})]}),e.jsxs("div",{className:"flex items-center justify-between py-2 border-b border-gray-100",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Tienda:"}),e.jsx("span",{className:"text-sm font-semibold text-gray-900",children:r.tienda})]}),e.jsxs("div",{className:"flex items-center justify-between py-2",children:[e.jsx("span",{className:"text-sm font-medium text-gray-700",children:"Cantidad a reversar:"}),e.jsxs("span",{className:"text-lg font-bold text-amber-600",children:[r.qty," uds"]})]})]}),e.jsxs("div",{className:"flex items-center space-x-4",children:[e.jsx("button",{onClick:d,disabled:b,className:"flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",children:"Cancelar"}),e.jsx("button",{onClick:E,disabled:b,className:"flex-1 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-medium hover:from-amber-600 hover:to-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer",children:b?e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-loader-4-line mr-2 animate-spin"}),"Reversando..."]}):e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-arrow-go-back-line mr-2"}),"Confirmar Reversión"]})})]})]})]})}):e.jsx("div",{className:"fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",children:e.jsx("div",{className:"bg-white rounded-xl shadow-xl max-w-md w-full p-6",children:e.jsx("div",{className:"flex items-center justify-center py-8",children:e.jsx("div",{className:"animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"})})})})}function ce(){const{id:o}=Z(),d=ee(),[n,m]=l.useState(null),[s,b]=l.useState([]),[y,r]=l.useState(""),[R,C]=l.useState(""),[j,S]=l.useState(!0),[E,i]=l.useState(""),[g,w]=l.useState(null),[h,N]=l.useState(""),[_,k]=l.useState(!1),[q,T]=l.useState(!1);l.useEffect(()=>{o&&P()},[o]);const P=async()=>{S(!0),i("");try{console.log("🔍 Cargando contenedor:",o);const{data:t,error:a}=await u.from("containers").select(`
            id, code, tienda, status, created_at, closed_at, created_by,
            container_lines(
              id, qty, sku, pallet_id,
              pallets(id, pallet_code, ubicacion),
              import_lines:source_import_line_id(id, descripcion, barcode, tienda, camion)
            )
          `).eq("id",o).maybeSingle();if(a)throw a;if(!t){i("Contenedor no encontrado");return}m({id:t.id,code:t.code,tienda:t.tienda,status:t.status,created_at:t.created_at,closed_at:t.closed_at,created_by:t.created_by});const p=t.container_lines??[];if(b(p),console.log("📦 Contenedor cargado:",{code:t.code,tienda:t.tienda,status:t.status,totalLines:p.length}),p.length>0&&p[0].import_lines?.camion&&C(p[0].import_lines.camion),t.created_by){const{data:c,error:v}=await u.from("users").select("email, full_name").eq("auth_id",t.created_by).maybeSingle();if(v)throw v;c&&r(c.full_name||c.email)}}catch(t){console.error("❌ Error cargando contenedor:",t),i("Error al cargar el contenedor")}finally{S(!1)}},L=l.useMemo(()=>{const t=new Map;return s.forEach(a=>{const p=a.pallets?.pallet_code??"—",c=`${p}|${a.sku}`;if(t.has(c)){const v=t.get(c);v.qty+=Number(a.qty)||0}else t.set(c,{id:a.id,pallet_code:p,ubicacion:a.pallets?.ubicacion??"",sku:a.sku,descripcion:a.import_lines?.descripcion??"",barcode:a.import_lines?.barcode??"",qty:Number(a.qty)||0})}),Array.from(t.values())},[s]),D=l.useMemo(()=>{if(!h.trim())return L;const t=h.toLowerCase();return L.filter(a=>a.sku.toLowerCase().includes(t)||a.pallet_code.toLowerCase().includes(t)||a.descripcion.toLowerCase().includes(t)||a.barcode.toLowerCase().includes(t))},[L,h]),A=l.useMemo(()=>{const t=new Set;return s.forEach(a=>{a.pallet_id&&t.add(a.pallet_id)}),t.size},[s]),M=l.useMemo(()=>{const t=new Set;return s.forEach(a=>{a.sku&&t.add(a.sku)}),t.size},[s]),U=l.useMemo(()=>s.reduce((t,a)=>t+(Number(a.qty)||0),0),[s]),O=t=>{w(t)},F=()=>{P()},H=(t,a,p)=>{try{console.log("🖨️ Generando etiqueta para contenedor:",t);const c=te.renderToStaticMarkup(e.jsx(se,{value:t,size:200,level:"H"})),v=p.map(f=>`
        <tr>
          <td>${f.sku}</td>
          <td>${f.descripcion||"—"}</td>
          <td style="text-align:center;">${f.qty}</td>
          <td>${f.pallet_code}</td>
        </tr>`).join(""),z=p.reduce((f,Q)=>f+Q.qty,0),V=new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),W=`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Etiqueta Contenedor ${t}</title>
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
    <div class="qr-block">${c}</div>
    <div class="info-block">
      <div class="label">Contenedor</div>
      <h1>${t}</h1>
      <div class="label" style="margin-top:12px;">Tienda</div>
      <div class="value">${a}</div>
      <div class="label" style="margin-top:8px;">Total unidades</div>
      <div class="value">${z}</div>
      <div class="label" style="margin-top:8px;">Fecha cierre</div>
      <div class="value">${V}</div>
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
      ${v||'<tr><td colspan="4" style="text-align:center;padding:12px;color:#999;">Sin líneas registradas</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Total: ${z} unidades</div>
</body>
</html>`,x=document.createElement("iframe");x.style.position="fixed",x.style.right="0",x.style.bottom="0",x.style.width="0",x.style.height="0",x.style.border="0",document.body.appendChild(x);const $=x.contentWindow?.document;if(!$){console.error("❌ No se pudo acceder al documento del iframe"),alert("No se pudo abrir la impresión"),document.body.removeChild(x);return}$.open(),$.write(W),$.close(),x.onload=()=>{setTimeout(()=>{try{x.contentWindow?.focus(),x.contentWindow?.print(),console.log("✅ Impresión iniciada"),setTimeout(()=>{document.body.removeChild(x)},1e3)}catch(f){console.error("❌ Error al imprimir:",f),alert("Contenedor cerrado, pero no se pudo abrir la impresión"),document.body.removeChild(x)}},300)}}catch(c){console.error("❌ Error generando etiqueta:",c),alert("Contenedor cerrado, pero no se pudo generar la etiqueta")}},K=async()=>{if(!(!n||n.status!=="OPEN")){T(!1),k(!0);try{console.log("🔒 Cerrando contenedor:",n.code);const t=n.code,a=n.tienda,p=[...L],{error:c}=await u.from("containers").update({status:"CLOSED",closed_at:new Date().toISOString()}).eq("id",n.id);if(c)throw c;console.log("✅ Contenedor cerrado exitosamente"),await P(),H(t,a,p)}catch(t){console.error("❌ Error cerrando contenedor:",t),alert("Error al cerrar el contenedor")}finally{k(!1)}}},B=()=>{T(!0)},G=()=>{n&&(console.log("➡️ Continuando contenedor:",n.code,"→ /operacion"),d(`/operacion?containerId=${n.id}`))};return j?e.jsx("div",{className:"flex items-center justify-center py-20",children:e.jsx("div",{className:"animate-spin rounded-full h-10 w-10 border-b-2 border-teal-500"})}):E?e.jsxs("div",{className:"text-center py-20",children:[e.jsx("div",{className:"w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4",children:e.jsx("i",{className:"ri-error-warning-line text-3xl text-red-400"})}),e.jsx("p",{className:"text-sm text-gray-600",children:E})]}):n?e.jsxs("div",{className:"space-y-6",children:[e.jsx(ae,{code:n.code,tienda:n.tienda,camion:R,status:n.status,createdAt:n.created_at,closedAt:n.closed_at,createdByEmail:y}),e.jsx(ne,{totalPallets:A,totalSkus:M,totalUnits:U}),n.status==="OPEN"&&e.jsxs("div",{className:"flex items-center gap-3 flex-wrap",children:[e.jsxs("button",{onClick:G,className:"flex-1 min-w-[200px] px-5 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl font-semibold hover:from-teal-600 hover:to-cyan-700 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm",children:[e.jsx("i",{className:"ri-play-line text-lg"}),"Continuar contenedor"]}),e.jsx("button",{onClick:B,disabled:_,className:"flex-1 min-w-[200px] px-5 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",children:_?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"}),"Cerrando..."]}):e.jsxs(e.Fragment,{children:[e.jsx("i",{className:"ri-lock-line text-lg"}),"Cerrar contenedor"]})})]}),e.jsxs("div",{className:"bg-white rounded-xl border border-gray-100 p-4",children:[e.jsxs("div",{className:"relative",children:[e.jsx("i",{className:"ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"}),e.jsx("input",{type:"text",placeholder:"Buscar por SKU, pallet, descripción o código de barra...",value:h,onChange:t=>N(t.target.value),className:"w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"}),h&&e.jsx("button",{onClick:()=>N(""),className:"absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer",children:e.jsx("i",{className:"ri-close-line"})})]}),h&&e.jsxs("p",{className:"text-xs text-gray-500 mt-2",children:[D.length," resultado",D.length!==1?"s":""," encontrado",D.length!==1?"s":""]})]}),e.jsx(ie,{rows:D,containerStatus:n.status,onReverse:O}),g&&e.jsx(le,{lineId:g,onClose:()=>w(null),onSuccess:F}),q&&e.jsx("div",{className:"fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",children:e.jsxs("div",{className:"bg-white rounded-xl shadow-xl max-w-md w-full p-6",children:[e.jsxs("div",{className:"flex items-start gap-4",children:[e.jsx("div",{className:"w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0",children:e.jsx("i",{className:"ri-lock-line text-2xl text-amber-600"})}),e.jsxs("div",{className:"flex-1",children:[e.jsx("h3",{className:"text-lg font-bold text-gray-900 mb-2",children:"Cerrar contenedor"}),e.jsxs("p",{className:"text-sm text-gray-600 mb-1",children:["¿Seguro que deseas cerrar el contenedor ",e.jsx("span",{className:"font-mono font-semibold",children:n.code}),"?"]}),e.jsx("p",{className:"text-xs text-gray-500",children:"Se generará e imprimirá automáticamente la etiqueta del contenedor."})]})]}),e.jsxs("div",{className:"flex items-center gap-3 mt-6",children:[e.jsx("button",{onClick:()=>T(!1),className:"flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors cursor-pointer",children:"Cancelar"}),e.jsx("button",{onClick:K,className:"flex-1 px-4 py-2.5 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors cursor-pointer",children:"Sí, cerrar"})]})]})})]}):null}export{ce as default};
//# sourceMappingURL=page-Dw8hP6B8.js.map
