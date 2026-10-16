'use strict';
(() => {
if (window.top !== window.self) { document.documentElement.classList.add('framed'); return; }

const $ = s => document.querySelector(s);
const main = $('#main'), ov = $('#overlay');
const APP_VERSION = 1;
const PRIO = {need:'Lo necesito', want:'Lo quiero', someday:'Algún día'}, PRIO_ORDER = {need:0, want:1, someday:2};
const FILTERS = [['active','Todo'],['need','Lo necesito'],['want','Lo quiero'],['someday','Algún día'],['bought','Comprado']];
const STORES = [[/(^|\.)(amazon\.|a\.co$|amzn\.)/,'Amazon'],[/shein\./,'Shein'],[/temu\./,'Temu'],[/ebay\./,'eBay'],[/walmart\./,'Walmart'],[/aliexpress\./,'AliExpress'],[/bestbuy\./,'Best Buy'],[/mercadolibre\./,'Mercado Libre'],[/(^|\.)target\.com$/,'Target'],[/costco\./,'Costco'],[/samsung\./,'Samsung'],[/(^|\.)apple\.com$/,'Apple'],[/siman\./,'Siman'],[/prado\./,'Prado'],[/sephora\./,'Sephora'],[/nike\./,'Nike'],[/adidas\./,'Adidas']];
const I = {plus:'<path d="M12 5v14M5 12h14"/>',back:'<path d="m15 6-6 6 6 6"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',chev:'<path d="m9 6 6 6-6 6"/>',down:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',check:'<path d="m5 12 5 5 9-10"/>'};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Array.from(crypto.getRandomValues(new Uint8Array(6)), b => (b % 36).toString(36)).join('');
const NO_SPELL = 'autocomplete="off" autocorrect="off" spellcheck="false"';
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const fmtD = s => { if (!s) return ''; const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d).toLocaleDateString('es-SV', {day:'numeric', month:'short', year:'numeric'}).replace(/\./g,''); };
const money = n => n == null || !isFinite(n) ? '' : '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };

/* ---------- Almacenamiento ---------- */
const DB = { db:null,
  open(){ return new Promise(res => { try { const r = indexedDB.open('mi-lista', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('items', {keyPath:'id'}); d.createObjectStore('meta', {keyPath:'k'}); };
    r.onsuccess = () => { this.db = r.result; res(true); }; r.onerror = () => res(false); r.onblocked = () => res(false); } catch(e){ res(false); } }); },
  req(s, m, fn){ return new Promise((res, rej) => { try { const t = this.db.transaction(s, m), q = fn(t.objectStore(s)); let out;
    if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); } catch(e){ rej(e); } }); },
  get(s,k){ return this.req(s,'readonly',o=>o.get(k)); },
  all(s){ return this.req(s,'readonly',o=>o.getAll()).then(r=>r||[]); },
  put(s,v){ return this.req(s,'readwrite',o=>o.put(v)); },
  del(s,k){ return this.req(s,'readwrite',o=>o.delete(k)); },
  clear(s){ return this.req(s,'readwrite',o=>o.clear()); } };

/* ---------- Estado ---------- */
let items = [], cfg = {k:'cfg', rate:0, fee:0, tax:0}, view = {name:'list'}, hist = [], filter = 'active', draft = null, installEvt = null, sheetRes = null;

/* ---------- Validación ---------- */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, ID_RE = /^[a-z0-9]{6,40}$/;
const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href.slice(0, 2000) : ''; } catch(e){ return ''; } };
function clean(i){ if (!i || typeof i !== 'object' || !ID_RE.test(i.id)) return null; const name = str(i.name, 160).trim(); if (!name) return null;
  const prices = Array.isArray(i.prices) ? i.prices.filter(p => p && DATE_RE.test(p.d) && num(p.p) !== null).map(p => ({d:p.d, p:num(p.p)})).slice(-200) : [];
  const b = i.bought && DATE_RE.test(i.bought.d) && num(i.bought.p) !== null ? {d:i.bought.d, p:num(i.bought.p)} : null;
  return {id:i.id, name, store:str(i.store,60), url:safeUrl(i.url||''), photo:typeof i.photo==='string'&&IMG_RE.test(i.photo)?i.photo:null, prio:PRIO[i.prio]?i.prio:'want', prices, target:i.target==null?null:num(i.target), ship:!!i.ship, lb:i.lb==null?null:num(i.lb), notes:str(i.notes,2000), created:+i.created||Date.now(), updated:+i.updated||Date.now(), bought:b}; }

/* ---------- Cálculos ---------- */
const cur = i => i.prices.length ? i.prices[i.prices.length-1].p : null;
const prev = i => i.prices.length > 1 ? i.prices[i.prices.length-2].p : null;
const low = i => i.prices.length ? Math.min(...i.prices.map(p => p.p)) : null;
const high = i => i.prices.length ? Math.max(...i.prices.map(p => p.p)) : null;
const extras = (i, p) => i.ship && p != null ? {ship:(i.lb||0) * cfg.rate + cfg.fee, tax:p * cfg.tax / 100} : {ship:0, tax:0};
const landed = (i, p = cur(i)) => { if (p == null) return null; const e = extras(i, p); return p + e.ship + e.tax; };
const hit = i => !i.bought && i.target != null && cur(i) != null && cur(i) <= i.target;
function badge(i){
  if (i.bought) return {k:'muted', t:`Comprado el ${fmtD(i.bought.d)}`};
  if (hit(i)) return {k:'good', t:'Precio objetivo alcanzado'};
  const c = cur(i), p = prev(i);
  if (c != null && p) { const ch = (c - p) / p * 100; if (ch <= -0.5) return {k:'good', t:`Bajó ${Math.round(-ch)} %`}; if (ch >= 0.5) return {k:'bad', t:`Subió ${Math.round(ch)} %`}; }
  if (i.target != null) return {k:'muted', t:'Esperando buen precio'};
  return null; }
function storeFrom(url){ try { const h = new URL(url).hostname.replace(/^www\./,''); for (const [re, n] of STORES) if (re.test(h)) return n; const p = h.split('.'); return p.length > 1 ? p[p.length-2].charAt(0).toUpperCase() + p[p.length-2].slice(1) : h; } catch(e){ return ''; } }

/* ---------- UI general ---------- */
function toast(m){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function openOverlay(html, cls){ ov.className = cls; ov.innerHTML = html; ov.hidden = false; document.body.style.overflow = 'hidden'; }
function closeOverlay(){ ov.hidden = true; ov.innerHTML = ''; ov.className = ''; document.body.style.overflow = ''; }
function confirmBox(title, text, ok){ return new Promise(res => { sheetRes = v => res(!!v); openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><button class="btn btn-danger" data-act="sheetOk">${esc(ok)}</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim'); }); }
function priceSheet(title, text, value, ok){ return new Promise(res => { sheetRes = res;
  openOverlay(`<div class="sheet" role="dialog" aria-modal="true"><h2>${esc(title)}</h2><p>${esc(text)}</p><label class="field money"><input id="sheetPrice" type="text" inputmode="decimal" value="${value!=null?value:''}" placeholder="0.00" ${NO_SPELL}></label><em class="err" id="sheetErr"></em><button class="btn btn-primary" data-act="sheetPrice">${esc(ok)}</button><button class="btn btn-ghost" data-act="sheetNo">Cancelar</button></div>`, 'dim');
  setTimeout(() => { const i = $('#sheetPrice'); if (i){ i.focus(); i.select(); } }, 80); }); }
function go(v){ hist.push(view); view = v; render(); window.scrollTo(0,0); }
function back(){ view = hist.pop() || {name:'list'}; render(); window.scrollTo(0,0); }
const curItem = () => items.find(i => i.id === view.id);
async function saveItem(i){ i.updated = Date.now(); await DB.put('items', i); const k = items.findIndex(x => x.id === i.id); k < 0 ? items.push(i) : items[k] = i; }

/* ---------- Vistas ---------- */
const thumb = i => `<span class="thumb">${i.photo?`<img src="${i.photo}" alt="">`:`<span class="ph">${esc(i.name.charAt(0).toUpperCase())}</span>`}</span>`;
function rowHTML(i){ const b = badge(i), c = cur(i), L = i.bought ? i.bought.p : landed(i);
  return `<button class="item" data-open="${esc(i.id)}">${thumb(i)}<span class="it-main"><span class="it-name">${esc(i.name)}</span><span class="it-meta">${i.store?`<span>${esc(i.store)}</span>`:''}${i.bought?'':`<span class="prio prio-${i.prio}">${PRIO[i.prio]}</span>`}</span>${b?`<span class="tag tag-${b.k}">${esc(b.t)}</span>`:''}</span><span class="it-price">${L!=null?`<b>${money(L)}</b>${!i.bought&&i.ship&&c!=null?'<small>con envío</small>':''}`:'<span class="none">Sin precio</span>'}</span></button>`; }
function listFor(f){ let l = items.filter(i => f === 'bought' ? i.bought : !i.bought);
  if (PRIO[f]) l = l.filter(i => i.prio === f);
  if (f === 'bought') return l.sort((a,b) => b.bought.d.localeCompare(a.bought.d));
  return l.sort((a,b) => (hit(b) - hit(a)) || PRIO_ORDER[a.prio] - PRIO_ORDER[b.prio] || b.updated - a.updated); }
function viewList(){
  const active = items.filter(i => !i.bought), bought = items.filter(i => i.bought);
  let h = `<header class="bar"><h1 class="title">Mi lista</h1><div class="bar-actions">${installEvt?'<button class="pill-btn" data-act="install">Instalar</button>':''}<button class="icon-btn" data-act="settings" aria-label="Ajustes">${ic('gear')}</button><button class="icon-btn icon-btn-solid" data-act="new" aria-label="Agregar deseo">${ic('plus')}</button></div></header>`;
  if (!items.length) return h + `<div class="empty"><div class="empty-mark">${ic('tag',30)}</div><h2>Empieza tu lista</h2><p>Guarda lo que quieres comprar, sigue su precio y entérate cuando baje a lo que estás dispuesta a pagar.</p><button class="btn btn-primary" data-act="new">Agregar mi primer deseo</button><p class="fine">También puedes compartir un producto desde Chrome o la app de la tienda y elegir Mi lista.</p></div>`;
  if (filter === 'bought'){ const spent = bought.reduce((s,i) => s + i.bought.p, 0), saved = bought.reduce((s,i) => { const hi = high(i); return s + (hi && hi > i.bought.p ? hi - i.bought.p : 0); }, 0);
    h += `<div class="summary"><div class="metric"><span>Gastado</span><b>${money(spent)}</b></div><div class="metric"><span>Ahorrado esperando</span><b class="good">${money(saved)}</b></div></div>`; }
  else { const need = active.filter(i => i.prio === 'need').reduce((s,i) => s + (landed(i) || 0), 0), hits = active.filter(hit).length;
    h += `<div class="summary"><div class="metric"><span>Lo que necesitas</span><b>${money(need)}</b></div><div class="metric"><span>En precio objetivo</span><b class="${hits?'good':''}">${hits}</b></div></div>`; }
  h += `<div class="chips">${FILTERS.map(([k,n]) => `<button class="chip ${filter===k?'on':''}" data-filter="${k}">${n}</button>`).join('')}</div>`;
  if (filter !== 'bought' && !cfg.rate && active.some(i => i.ship)) h += `<button class="note" data-act="settings">Configura la tarifa de tu casillero en Ajustes para ver el costo real con envío.</button>`;
  const l = listFor(filter);
  return h + (l.length ? `<div class="list">${l.map(rowHTML).join('')}</div>` : `<p class="empty-sm">${filter==='bought'?'Todavía no has marcado nada como comprado.':'No hay nada en esta categoría.'}</p>`); }
function spark(i){ const ps = i.prices; if (ps.length < 2) return '';
  const vals = ps.map(p => p.p).concat(i.target != null ? [i.target] : []), mn = Math.min(...vals), mx = Math.max(...vals), span = mx - mn || 1, W = 300, H = 90, P = 8;
  const x = k => P + k * (W - 2*P) / (ps.length - 1), y = v => H - P - (v - mn) / span * (H - 2*P);
  const pts = ps.map((p,k) => `${x(k).toFixed(1)},${y(p.p).toFixed(1)}`).join(' '), last = ps[ps.length-1];
  return `<div class="chart"><div class="chart-head"><span>Más bajo ${money(low(i))}</span><span>Más alto ${money(high(i))}</span></div><svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Historial de precio">${i.target!=null?`<line class="tg" x1="0" x2="${W}" y1="${y(i.target).toFixed(1)}" y2="${y(i.target).toFixed(1)}"/>`:''}<polyline class="ln" points="${pts}"/><circle class="pt" cx="${x(ps.length-1).toFixed(1)}" cy="${y(last.p).toFixed(1)}" r="3.5"/></svg></div>`; }
function viewDetail(){ const i = curItem(); if (!i){ view = {name:'list'}; return viewList(); }
  const c = cur(i), b = badge(i), e = extras(i, c), L = landed(i);
  let h = `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><div class="bar-actions">${i.url?`<a class="icon-btn" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir en la tienda">${ic('ext')}</a>`:''}<button class="icon-btn" data-act="edit" aria-label="Editar">${ic('edit')}</button></div></header>`;
  if (i.photo) h += `<button class="hero-photo" data-act="viewPhoto" aria-label="Ver foto en grande"><img src="${i.photo}" alt=""></button>`;
  h += `<h1 class="d-name">${esc(i.name)}</h1><div class="d-meta">${i.store?`<span>${esc(i.store)}</span>`:''}${i.bought?'':`<span class="prio prio-${i.prio}">${PRIO[i.prio]}</span>`}</div>`;
  if (i.bought){
    const hi = high(i), saved = hi && hi > i.bought.p ? hi - i.bought.p : 0;
    h += `<div class="price-row"><p class="price-big">${money(i.bought.p)}</p></div><p class="price-sub">Lo compraste el ${fmtD(i.bought.d)}${saved?`. Ahorraste ${money(saved)} frente al precio más alto que viste.`:'.'}</p>${spark(i)}<button class="btn btn-secondary" data-act="unbuy">Volver a la lista de deseos</button>`;
  } else {
    h += c != null ? `<div class="price-row"><p class="price-big">${money(c)}</p>${b&&b.k!=='muted'&&b.t!=='Precio objetivo alcanzado'?`<span class="tag tag-${b.k}">${esc(b.t)}</span>`:''}</div><p class="price-sub">Precio en la tienda, actualizado el ${fmtD(i.prices[i.prices.length-1].d)}.</p>` : `<p class="price-sub">Todavía no has anotado un precio.</p>`;
    if (i.ship && c != null) h += `<div class="box"><div class="row"><span>Precio</span><b>${money(c)}</b></div><div class="row"><span>Envío por casillero${i.lb?` (${i.lb} lb)`:''}</span><b>${cfg.rate?money(e.ship):'Sin configurar'}</b></div>${cfg.tax?`<div class="row"><span>Impuestos (${cfg.tax} %)</span><b>${money(e.tax)}</b></div>`:''}<div class="row total"><span>Puesto en tu casa</span><b>${money(L)}</b></div></div>`;
    if (i.target != null) h += hit(i) ? `<div class="target hit">Llegó a tu precio objetivo de ${money(i.target)}<small>Es buen momento para comprarlo.</small></div>` : `<div class="target">Tu precio objetivo es ${money(i.target)}${c!=null?`<small>Falta que baje ${money(c - i.target)}.</small>`:''}</div>`;
    h += spark(i);
    h += `<button class="btn btn-primary" data-act="updPrice">${ic('tag',20)} ${c!=null?'Actualizar precio':'Anotar precio'}</button>${i.url?`<a class="btn btn-secondary" href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">${ic('ext',20)} Abrir en la tienda</a>`:''}<button class="btn btn-secondary" data-act="buy">${ic('check',20)} Marcar como comprado</button>`;
  }
  if (i.prices.length) h += `<h2 class="section">Historial de precio</h2><div class="box">${[...i.prices].reverse().slice(0,8).map(p => `<div class="hist-row"><span>${fmtD(p.d)}</span><b>${money(p.p)}</b></div>`).join('')}</div>`;
  if (i.notes) h += `<h2 class="section">Notas</h2><div class="box"><p class="fine">${esc(i.notes)}</p></div>`;
  return h + `<button class="btn btn-danger-text mt" data-act="delete">Eliminar</button>`; }
function photoSlot(){ return `<div class="photo-slot" id="photoSlot">${draft.photo?`<img src="${draft.photo}" alt=""><button type="button" class="photo-x" data-act="rmPhoto" aria-label="Quitar foto">${ic('x',16)}</button>`:`<label class="photo-pick">${ic('camera')}<span>Agregar foto</span><input type="file" accept="image/*" id="f_photo" hidden></label>`}</div>`; }
function viewForm(){ const d = draft, c = d._new ? d._price : null;
  return `<header class="bar"><button class="icon-btn" data-act="cancelForm" aria-label="Cancelar">${ic('x')}</button><h1 class="title title-sm">${d._new?'Nuevo deseo':'Editar deseo'}</h1><button class="btn-save" data-act="save">Guardar</button></header>
  <label class="field"><span>Qué quieres</span><input id="f_name" value="${esc(d.name)}" placeholder="Audífonos inalámbricos" maxlength="160" ${NO_SPELL}><em class="err" id="e_name"></em></label>
  <label class="field"><span>Enlace del producto</span><input id="f_url" type="url" inputmode="url" value="${esc(d.url)}" placeholder="https://" ${NO_SPELL}><em class="err" id="e_url"></em></label>
  <label class="field"><span>Tienda</span><input id="f_store" value="${esc(d.store)}" placeholder="Se llena sola con el enlace" maxlength="60" ${NO_SPELL}></label>
  <div class="two">${d._new?`<label class="field"><span>Precio actual</span><div class="money"><input id="f_price" type="text" inputmode="decimal" value="${c!=null?c:''}" placeholder="0.00" ${NO_SPELL}></div></label>`:''}<label class="field"><span>Precio objetivo</span><div class="money"><input id="f_target" type="text" inputmode="decimal" value="${d.target!=null?d.target:''}" placeholder="Opcional" ${NO_SPELL}></div></label></div>
  <div class="field"><span>Prioridad</span><div class="seg">${Object.entries(PRIO).map(([k,n]) => `<button type="button" class="${d.prio===k?'on':''}" data-prio="${k}">${n}</button>`).join('')}</div></div>
  <label class="check"><input type="checkbox" id="f_ship" ${d.ship?'checked':''}> Viene por casillero</label>
  <label class="field" id="lbField" ${d.ship?'':'hidden'}><span>Peso aproximado (libras)</span><input id="f_lb" type="text" inputmode="decimal" value="${d.lb!=null?d.lb:''}" placeholder="1.5" ${NO_SPELL}><small>Si no sabes, busca el peso de envío en la página del producto.</small></label>
  <div class="field"><span>Foto</span>${photoSlot()}</div>
  <label class="field"><span>Notas</span><textarea id="f_notes" rows="3" placeholder="Color, talla, alternativa más barata" maxlength="2000" ${NO_SPELL}>${esc(d.notes)}</textarea></label>`; }
function viewSettings(){ const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return `<header class="bar"><button class="icon-btn" data-act="back" aria-label="Volver">${ic('back')}</button><h1 class="title title-sm">Ajustes</h1><span class="spacer"></span></header>
  <h2 class="section">Tu casillero</h2><div class="box">
  <label class="field"><span>Tarifa por libra</span><div class="money"><input id="c_rate" type="text" inputmode="decimal" value="${cfg.rate||''}" placeholder="0.00" ${NO_SPELL}></div></label>
  <label class="field"><span>Cargo fijo por paquete</span><div class="money"><input id="c_fee" type="text" inputmode="decimal" value="${cfg.fee||''}" placeholder="0.00" ${NO_SPELL}></div><small>Manejo, seguro u otro cargo que te cobren siempre. Déjalo vacío si no aplica.</small></label>
  <label class="field"><span>Impuestos (%)</span><input id="c_tax" type="text" inputmode="decimal" value="${cfg.tax||''}" placeholder="0" ${NO_SPELL}><small>Se calcula sobre el precio del producto. Déjalo vacío si no pagas impuestos.</small></label>
  <button class="btn btn-primary" data-act="saveCfg">Guardar tarifas</button></div>
  <h2 class="section">Instalación</h2><div class="box">${standalone?'<p class="fine">Ya estás usando la app instalada.</p>':installEvt?`<button class="set-row" data-act="install"><span>Instalar Mi lista en el celular<small>Queda como una app con su propio ícono</small></span><span class="chev">${ic('down',18)}</span></button>`:'<p class="fine">Chrome todavía no ofrece instalarla. Abre la app en Chrome con internet, espera unos segundos y vuelve a entrar aquí.</p>'}</div>
  <h2 class="section">Copia de seguridad</h2><div class="box">
  <button class="set-row" data-act="exportBk"><span>Descargar copia<small>Tu lista, precios y fotos en un archivo</small></span><span class="chev">${ic('down',18)}</span></button>
  <label class="set-row"><span>Restaurar una copia<small>Agrega lo que tenga el archivo a tu lista</small></span><span class="chev">${ic('up',18)}</span><input type="file" accept="application/json,.json" id="f_import" hidden></label></div>
  <button class="btn btn-danger-text mt" data-act="wipe">Borrar toda la lista</button><p class="ver">Versión ${APP_VERSION}</p>`; }
function render(){ main.innerHTML = ({list:viewList, detail:viewDetail, form:viewForm, settings:viewSettings}[view.name] || viewList)(); }

/* ---------- Imágenes ---------- */
function compress(file){ return new Promise((res, rej) => { if (file.size > 40e6) return rej(); const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { const m = 900, s = Math.min(1, m / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width*s); c.height = Math.round(img.height*s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', .82)); };
  img.onerror = () => { URL.revokeObjectURL(url); rej(); }; img.src = url; }); }

/* ---------- Acciones ---------- */
function newDraft(p){ return Object.assign({_new:true, id:uid(), name:'', store:'', url:'', photo:null, prio:'want', prices:[], target:null, ship:false, lb:null, notes:'', bought:null, _price:null}, p || {}); }
const A = {
  settings(){ go({name:'settings'}); },
  new(){ draft = newDraft(); go({name:'form'}); },
  edit(){ const i = curItem(); if (!i) return; draft = JSON.parse(JSON.stringify(i)); go({name:'form'}); },
  back(){ back(); },
  cancelForm(){ draft = null; back(); },
  rmPhoto(){ draft.photo = null; $('#photoSlot').outerHTML = photoSlot(); },
  async save(){
    const name = $('#f_name').value.trim(), rawUrl = $('#f_url').value.trim(), url = rawUrl ? safeUrl(/^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl) : '';
    if (!name){ $('#e_name').textContent = 'Escribe qué quieres comprar.'; $('#f_name').focus(); return; }
    if (rawUrl && !url){ $('#e_url').textContent = 'Ese enlace no parece válido.'; $('#f_url').focus(); return; }
    const it = clean({...draft, name, url, store:$('#f_store').value.trim() || (url ? storeFrom(url) : ''), target:$('#f_target').value.trim() ? num($('#f_target').value) : null, ship:$('#f_ship').checked, lb:$('#f_lb').value.trim() ? num($('#f_lb').value) : null, notes:$('#f_notes').value.trim()});
    if (draft._new){ const p = $('#f_price').value.trim() ? num($('#f_price').value) : null; if (p != null) it.prices = [{d:todayKey(), p}]; }
    try { await saveItem(it); } catch(e){ toast('No se pudo guardar. Puede que falte espacio en el celular.'); return; }
    const isNew = draft._new; draft = null; toast('Guardado');
    if (isNew){ view = {name:'detail', id:it.id}; render(); window.scrollTo(0,0); } else back(); },
  async updPrice(){ const i = curItem(); if (!i) return;
    const p = await priceSheet(cur(i) != null ? 'Precio de hoy' : 'Precio actual', 'Revisa el precio en la tienda y anótalo aquí.', cur(i), 'Guardar precio'); if (p == null) return;
    const d = todayKey(); if (i.prices.length && i.prices[i.prices.length-1].d === d) i.prices[i.prices.length-1].p = p; else i.prices.push({d, p});
    if (i.prices.length > 200) i.prices = i.prices.slice(-200);
    await saveItem(i); render(); toast(hit(i) ? 'Llegó a tu precio objetivo' : 'Precio actualizado'); },
  async buy(){ const i = curItem(); if (!i) return; const L = landed(i);
    const p = await priceSheet('¿Cuánto pagaste?', 'Anota el total que pagaste, con envío si aplica.', L != null ? Math.round(L*100)/100 : null, 'Marcar como comprado'); if (p == null) return;
    i.bought = {d:todayKey(), p}; await saveItem(i); render(); toast('Marcado como comprado'); },
  async unbuy(){ const i = curItem(); if (!i) return; i.bought = null; await saveItem(i); render(); toast('Volvió a tu lista de deseos'); },
  async delete(){ const i = curItem(); if (!i) return; if (!await confirmBox(`¿Eliminar ${i.name}?`, 'Se borra de tu lista junto con su historial de precio.', 'Eliminar')) return;
    await DB.del('items', i.id); items = items.filter(x => x.id !== i.id); hist = hist.filter(v => v.id !== i.id); toast('Eliminado'); back(); },
  viewPhoto(){ const i = curItem(); if (i && i.photo) openOverlay(`<img src="${i.photo}" alt="" data-act="closeViewer"><button class="viewer-close" data-act="closeViewer" aria-label="Cerrar">${ic('x')}</button>`, 'viewer'); },
  closeViewer(){ closeOverlay(); },
  sheetOk(){ closeOverlay(); if (sheetRes){ const r = sheetRes; sheetRes = null; r(true); } },
  sheetNo(){ closeOverlay(); if (sheetRes){ const r = sheetRes; sheetRes = null; r(null); } },
  sheetPrice(){ const v = num($('#sheetPrice').value); if (v == null || !$('#sheetPrice').value.trim()){ $('#sheetErr').textContent = 'Escribe un precio válido.'; return; } closeOverlay(); if (sheetRes){ const r = sheetRes; sheetRes = null; r(v); } },
  async saveCfg(){ cfg.rate = num($('#c_rate').value) || 0; cfg.fee = num($('#c_fee').value) || 0; cfg.tax = Math.min(100, num($('#c_tax').value) || 0); await DB.put('meta', cfg); toast('Tarifas guardadas'); render(); },
  async install(){ if (!installEvt) return; const e = installEvt; installEvt = null; try { await e.prompt(); await e.userChoice; } catch(err){} render(); },
  async exportBk(){ const data = {app:'mi-lista', v:1, created:new Date().toISOString(), cfg:{rate:cfg.rate, fee:cfg.fee, tax:cfg.tax}, items};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], {type:'application/json'})), a = document.createElement('a');
    a.href = url; a.download = `mi-lista-copia-${todayKey()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('Copia descargada'); },
  async wipe(){ if (!await confirmBox('¿Borrar toda la lista?', 'Se eliminan todos tus deseos, precios y fotos de este celular. No se puede deshacer.', 'Borrar todo')) return;
    await DB.clear('items'); items = []; view = {name:'list'}; hist = []; toast('Lista borrada'); render(); }
};
async function importBk(file){
  let data; try { if (file.size > 300e6) throw 0; data = JSON.parse(await file.text()); } catch(e){ return toast('Ese archivo no es una copia válida.'); }
  if (!data || data.app !== 'mi-lista' || !Array.isArray(data.items)) return toast('Ese archivo no es una copia válida.');
  let n = 0; for (const r of data.items){ const i = clean(r); if (!i) continue; try { await DB.put('items', i); const k = items.findIndex(x => x.id === i.id); k < 0 ? items.push(i) : items[k] = i; n++; } catch(e){} }
  if (data.cfg && !cfg.rate){ cfg.rate = num(data.cfg.rate) || 0; cfg.fee = num(data.cfg.fee) || 0; cfg.tax = Math.min(100, num(data.cfg.tax) || 0); try { await DB.put('meta', cfg); } catch(e){} }
  render(); toast(n ? `${n} producto${n>1?'s':''} restaurado${n>1?'s':''}` : 'No se pudo restaurar nada.'); }

/* ---------- Compartir desde otras apps ---------- */
function sharedDraft(){
  const q = new URLSearchParams(location.search); if (!q.has('title') && !q.has('text') && !q.has('url')) return null;
  history.replaceState(null, '', location.pathname);
  const text = q.get('text') || '', found = (q.get('url') || '').trim() || ((text.match(/https?:\/\/\S+/) || [''])[0]);
  const url = safeUrl(found);
  let name = (q.get('title') || text.replace(/https?:\/\/\S+/g, '')).replace(/^\s*(amazon\.com|amazon)\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
  if (name.length > 160) name = name.slice(0, 157) + '…';
  return newDraft({name, url, store: url ? storeFrom(url) : ''}); }

/* ---------- Eventos ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act],[data-open],[data-filter],[data-prio]'); if (!t) return;
  const ds = t.dataset;
  if (ds.open) return go({name:'detail', id:ds.open});
  if (ds.filter){ filter = ds.filter; return render(); }
  if (ds.prio){ draft.prio = ds.prio; document.querySelectorAll('[data-prio]').forEach(b => b.classList.toggle('on', b === t)); return; }
  if (ds.act && A[ds.act]) A[ds.act](t);
});
document.addEventListener('change', async e => { const t = e.target;
  if (t.id === 'f_photo'){ const f = t.files && t.files[0]; if (!f || !draft) return; try { draft.photo = await compress(f); $('#photoSlot').outerHTML = photoSlot(); } catch(err){ toast('No se pudo cargar la foto. Prueba con otra.'); } }
  if (t.id === 'f_import'){ const f = t.files && t.files[0]; t.value = ''; if (f) importBk(f); }
  if (t.id === 'f_ship') $('#lbField').hidden = !t.checked; });
document.addEventListener('input', e => { const t = e.target;
  if (t.id === 'f_name') $('#e_name').textContent = '';
  if (t.id === 'f_url'){ $('#e_url').textContent = ''; const st = $('#f_store'); const u = safeUrl(/^https?:\/\//i.test(t.value.trim()) ? t.value.trim() : 'https://' + t.value.trim()); if (st && !st.dataset.touched && u) st.value = storeFrom(u); }
  if (t.id === 'f_store') t.dataset.touched = '1';
  if (t.id === 'sheetPrice') $('#sheetErr').textContent = ''; });
document.addEventListener('keydown', e => {
  if (!ov.hidden){ if (e.key === 'Escape'){ if (sheetRes) A.sheetNo(); else closeOverlay(); } else if (e.key === 'Enter' && $('#sheetPrice')){ e.preventDefault(); A.sheetPrice(); } } });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (['list','settings'].includes(view.name)) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; toast('Mi lista instalada'); if (['list','settings'].includes(view.name)) render(); });

/* ---------- Inicio ---------- */
(async () => {
  if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(() => {});
  if (!window.indexedDB || !await DB.open()){ main.innerHTML = `<div class="empty"><h2>No se puede guardar</h2><p>Este navegador no permite guardar datos. Si estás en modo incógnito, abre la app en una pestaña normal.</p></div>`; return; }
  try { const c = await DB.get('meta', 'cfg'); if (c) cfg = {k:'cfg', rate:num(c.rate)||0, fee:num(c.fee)||0, tax:Math.min(100, num(c.tax)||0)}; } catch(e){}
  try { items = (await DB.all('items')).map(clean).filter(Boolean); } catch(e){ items = []; }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const shared = sharedDraft();
  if (shared){ draft = shared; hist = [{name:'list'}]; view = {name:'form'}; }
  render();
})();
})();
