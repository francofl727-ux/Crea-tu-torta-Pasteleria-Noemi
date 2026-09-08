/*
  CONFIGURACIÓN:
  1) SHEET_ID: el ID de tu Google Sheet (se saca de la URL para compartir).
  2) La planilla debe estar publicada en la web:
     Archivo > Compartir > Publicar en la web > Documento completo > Publicar.
  3) Las pestañas deben llamarse EXACTO: CONFIGURACION, DISEÑOS, RELLENOS,
     MESA_DULCE, MESA_SALADA, CATEGORIAS.
*/
const SHEET_ID = "1iQirAqmJzyW4_lKcElqDCv3F-uPx_peCIIHxyNOnK_M";

// URL de tu Apps Script publicado como Aplicación web (termina en /exec).
// Dejalo vacío ("") si todavía no lo configuraste: la página sigue funcionando igual,
// simplemente no va a guardar copia del pedido en tu planilla admin.
const PEDIDOS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbw86S6tnVVT5KW_BkoPqUl5-4XAmBNCzaHaeMeqbEPxNszwbMr__b-BeDOHIyzpqOH4_Q/exec";
const STORAGE_KEY = "configuradorTortaOrder_v1";

const FALLBACK_DATA = {
  CONFIGURACION:[
    ["Campo","Valor","Descripción"],
    ["Nombre del emprendimiento","Mi Pastelería",""],
    ["WhatsApp","54911XXXXXXXX",""],
    ["Kg por personas","10",""],
    ["Cobertura","Crema",""],
    ["Mensaje kg/personas","Aproximadamente 1 kg de torta cada 10 personas.",""],
    ["Instagram","",""],
    ["Texto principal","Tortas hechas para tus momentos especiales",""],
    ["Texto secundario","Armá tu pedido paso a paso y recibí tu presupuesto por WhatsApp.",""]
  ],
  DISEÑOS:[
    ["ID","Activo","Nombre","Hashtag","Categoría","Imagen_URL","Orden"],
    ["001","SI","Mariposas","#tortamariposas","Cumpleaños","",1],
    ["002","SI","Drip","#tortadrip","Cumpleaños","",2],
    ["003","SI","Bautismo","#tortabautismo","Bautismo","",3]
  ],
  RELLENOS:[
    ["ID","Activo","Nombre","Descripción","Orden"],
    ["001","SI","Dulce de leche","","1"],
    ["002","SI","Oreo","","2"],
    ["003","SI","Chocotorta","","3"]
  ],
  MESA_DULCE:[
    ["ID","Activo","Producto","Categoría","Precio","Imagen_URL","Orden"],
    ["001","SI","Brownie","Brownies","8000","",1],
    ["002","SI","Lemon Pie","Tartas","14000","",2],
    ["003","SI","Tarta de frutilla","Tartas","15000","",3]
  ],
  MESA_SALADA:[
    ["ID","Activo","Producto","Categoría","Descripción","Imagen_URL","Orden"],
    ["001","SI","Chips","Sandwiches","","",1],
    ["002","SI","Pizzetas","Pizzetas","","",2],
    ["003","SI","Empanaditas","Salado","","",3]
  ],
  CATEGORIAS:[
    ["ID","Tipo","Nombre","Activo","Orden"],
    ["001","DISEÑO","Cumpleaños","SI",1],
    ["002","DISEÑO","Infantil","SI",2],
    ["003","DISEÑO","Bautismo","SI",3],
    ["004","DISEÑO","15 años","SI",4],
    ["005","DULCE","Tartas","SI",1],
    ["006","DULCE","Brownies","SI",2],
    ["007","SALADA","Sandwiches","SI",1]
  ]
};

let data = {};
let stepIndex = 0;
function freshOrder(){
  return { people:null, kg:null, mode:"people", design:null, designNote:"", fillings:[], fillingsExtra:"", box:null, custom:"", name:"", date:"", time:"", clientPhone:"", extra:"", sweet:[], salty:[], sweetExtra:"", saltyExtra:"" };
}
let order = freshOrder();
const steps = ["size","design","fillings","box","custom","details","sweet","salty","summary"];

function setField(key, value){ order[key] = value; saveProgress(); }

function saveProgress(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ order, stepIndex })); }catch(e){}
}

function loadProgress(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const saved = JSON.parse(raw);
    if(!saved || !saved.order) return false;
    order = Object.assign(freshOrder(), saved.order);
    stepIndex = Math.min(Math.max(saved.stepIndex || 0, 0), steps.length - 1);
    return true;
  }catch(e){ return false; }
}

function clearProgress(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}

function resetOrder(){
  if(!confirm("¿Seguro que querés empezar de nuevo? Se va a perder el progreso actual.")) return;
  order = freshOrder();
  stepIndex = 0;
  clearProgress();
  document.getElementById("wizard").classList.add("hidden");
  document.getElementById("gallerySection").classList.remove("hidden");
}

async function loadData(){
  data = JSON.parse(JSON.stringify(FALLBACK_DATA));

  if(!SHEET_ID || SHEET_ID.includes("PEGAR_")){
    console.warn("[configurador] No hay SHEET_ID configurado, se usan datos de ejemplo.");
    renderGallery();
    return;
  }

  console.log("[configurador] Cargando datos desde Google Sheets, SHEET_ID:", SHEET_ID);

  for(const sheet of Object.keys(FALLBACK_DATA)){
    try{
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
      const res = await fetch(url, { cache:"no-store" });
      if(!res.ok){
        console.warn(`[configurador] La pestaña "${sheet}" respondió con estado ${res.status}. Se usan datos de ejemplo para esa pestaña.`);
        continue;
      }
      const txt = await res.text();
      const parsed = parseCSV(txt);
      if(parsed.length < 2){
        console.warn(`[configurador] La pestaña "${sheet}" llegó vacía o con formato inesperado. Se usan datos de ejemplo para esa pestaña.`);
        continue;
      }
      data[sheet] = parsed;
      console.log(`[configurador] Pestaña "${sheet}" cargada correctamente: ${parsed.length - 1} filas.`);
    }catch(e){
      console.warn(`[configurador] Error al leer la pestaña "${sheet}":`, e);
    }
  }

  applyConfig();
  renderGallery();
  resumeIfSaved();
}

function resumeIfSaved(){
  if(loadProgress()){
    document.getElementById("gallerySection").classList.add("hidden");
    document.getElementById("wizard").classList.remove("hidden");
    renderStep();
  }
}

function parseCSV(s){
  const rows = [];
  let row = [], cell = "", q = false;
  for(let i=0;i<s.length;i++){
    const c = s[i], n = s[i+1];
    if(c=='"' && q && n=='"'){ cell+='"'; i++; continue; }
    if(c=='"'){ q=!q; continue; }
    if(c==',' && !q){ row.push(cell); cell=""; continue; }
    if((c=='\n'||c=='\r') && !q){
      if(c=='\r' && n=='\n') i++;
      row.push(cell); rows.push(row); row=[]; cell="";
      continue;
    }
    cell+=c;
  }
  if(cell.length || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ""));
}

function objects(sheet){
  const rows = data[sheet] || [];
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h,i) => [h, (r[i] ?? "").trim()])));
}

function active(sheet){
  return objects(sheet)
    .filter(x => (x.Activo || "SI").toUpperCase() === "SI")
    .sort((a,b) => (+a.Orden || 0) - (+b.Orden || 0));
}

function applyConfig(){
  const c = objects("CONFIGURACION");
  const get = k => (c.find(x => x.Campo === k) || {}).Valor || "";
  const nombre = get("Nombre del emprendimiento");
  document.title = nombre || "Armá tu torta";
  document.getElementById("bizName").textContent = nombre || "PASTELERÍA";
  document.getElementById("heroTitle").textContent = get("Texto principal") || "Tortas hechas para tus momentos especiales";
  document.getElementById("heroSubtitle").textContent = get("Texto secundario") || "Armá tu pedido paso a paso y recibí tu presupuesto por WhatsApp.";

  const ig = get("Instagram");
  const igEl = document.getElementById("igLink");
  if(ig){
    const url = ig.startsWith("http") ? ig : `https://${ig}`;
    igEl.href = url;
    igEl.classList.remove("hidden");
  }else{
    igEl.classList.add("hidden");
  }
}

function renderGallery(){
  const g = document.getElementById("gallery");
  g.innerHTML = "";
  active("DISEÑOS").forEach(d => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `${d.Imagen_URL ? `<img src="${esc(d.Imagen_URL)}" alt="">` : `<div style="aspect-ratio:1;background:#eee5e2"></div>`}<div class="card-body"><strong>${esc(d.Nombre)}</strong><div class="tag">${esc(d.Hashtag||"")}</div></div>`;
    el.onclick = () => { start(); order.design = d; renderStep(); };
    g.appendChild(el);
  });
}

function start(){
  document.getElementById("gallerySection").classList.add("hidden");
  document.getElementById("wizard").classList.remove("hidden");
  stepIndex = 0;
  renderStep();
  window.scrollTo({ top: document.getElementById("wizard").offsetTop - 20, behavior:"smooth" });
}

function next(){
  if(!validate()) return;
  if(stepIndex < steps.length - 1){ stepIndex++; renderStep(); }
  else sendWhatsApp();
}

function back(){
  if(stepIndex > 0){ stepIndex--; renderStep(); }
  else{
    document.getElementById("wizard").classList.add("hidden");
    document.getElementById("gallerySection").classList.remove("hidden");
  }
}

function validate(){
  const s = steps[stepIndex];
  if(s=="size" && !order.mode) return toast("Elegí personas o kilos.");
  if(s=="size" && ((order.mode=="people" && !order.people) || (order.mode=="kg" && !order.kg))) return toast("Completá el tamaño.");
  if(s=="design" && !order.design) return toast("Elegí un diseño o contanos que tenés otra idea.");
  if(s=="fillings" && order.fillings.length==0) return toast("Elegí al menos un relleno o indicá que querés consultar otro.");
  if(s=="details" && (!order.name || !order.clientPhone || !order.date || !order.time)) return toast("Completá nombre, WhatsApp, fecha y hora aproximada.");
  return true;
}

function renderStep(){
  const s = steps[stepIndex], el = document.getElementById("step");
  saveProgress();
  document.getElementById("progressBar").style.width = (stepIndex/(steps.length-1)*100) + "%";
  document.getElementById("backBtn").style.visibility = stepIndex ? "visible" : "hidden";
  document.getElementById("nextBtn").textContent = s=="summary" ? "📲 Enviar pedido por WhatsApp" : "Continuar →";
  if(s=="size") return el.innerHTML = sizeHTML();
  if(s=="design") return el.innerHTML = designHTML();
  if(s=="fillings") return el.innerHTML = fillingsHTML();
  if(s=="box") return el.innerHTML = boxHTML();
  if(s=="custom") return el.innerHTML = customHTML();
  if(s=="details") return el.innerHTML = detailsHTML();
  if(s=="sweet") return el.innerHTML = sweetHTML();
  if(s=="salty") return el.innerHTML = saltyHTML();
  if(s=="summary") return el.innerHTML = summaryHTML();
}

function sizeHTML(){
  return `<h2 class="step-title">¿Para cuántas personas o cuántos kilos?</h2><p class="hint">Elegí una sola forma de indicar el tamaño. Te mostraremos la otra como referencia.</p><div class="choice-grid"><div class="choice ${order.mode=="people"?"selected":""}" onclick="chooseMode('people')">👥<br><b>Por personas</b></div><div class="choice ${order.mode=="kg"?"selected":""}" onclick="chooseMode('kg')">⚖️<br><b>Por kilos</b></div></div>${order.mode=="people"?`<div class="choice-grid">${[10,20,30,40,50,60,70,80,90,100].map(n=>`<div class="choice ${order.people==n?"selected":""}" onclick="order.people=${n};renderStep()">${n} personas</div>`).join("")}<div class="choice ${order.people=="other"?"selected":""}" onclick="order.people='other';renderStep()">Otra cantidad</div></div>${order.people=="other"?`<input class="input" type="number" min="1" placeholder="Cantidad de personas" onchange="setField('people', +this.value)">`:""}<p class="muted">💡 ${configMsg()}</p>${order.people&&order.people!="other"?`<p class="ref">Referencia aproximada: ${Math.round(order.people/10)} kg</p>`:""}`
  :`<div class="choice-grid">${Array.from({length:10},(_,i)=>i+1).map(n=>`<div class="choice ${order.kg==n?"selected":""}" onclick="order.kg=${n};renderStep()">${n} kg</div>`).join("")}</div><p class="muted">💡 ${configMsg()}</p>${order.kg?`<p class="ref">Referencia aproximada: ${order.kg*10} personas</p>`:""}`}`;
}

function chooseMode(m){ order.mode=m; order.people=null; order.kg=null; renderStep(); }

function designHTML(){
  return `<h2 class="step-title">¿Qué diseño estás buscando?</h2><p class="hint">Podés elegir una torta de referencia o contarnos una idea propia.</p><div class="products">${active("DISEÑOS").map(d=>`<div class="product ${order.design?.ID==d.ID?"selected":""}" onclick='selectDesign(${j(d)})'>${d.Imagen_URL?`<img src="${esc(d.Imagen_URL)}">`:""}<b>${esc(d.Nombre)}</b><div class="tag">${esc(d.Hashtag||"")}</div></div>`).join("")}</div><div class="choice ${order.design?.custom?"selected":""}" style="margin-top:18px" onclick="selectCustomDesign()">✨ Tengo otra idea</div>${order.design?.custom?`<textarea class="textarea" placeholder="Contanos tu idea: colores, tema, referencias, etc." onchange="setField('designNote', this.value)">${esc(order.designNote)}</textarea><p class="muted">📷 Si tenés una foto de referencia, mandala directo por este mismo chat de WhatsApp apenas se abra.</p>`:""}`;
}

function selectDesign(d){ order.design=d; renderStep(); }
function selectCustomDesign(){ order.design={custom:true,Nombre:"Diseño personalizado"}; renderStep(); }

function fillingsHTML(){
  return `<h2 class="step-title">Elegí los rellenos</h2><p class="hint">Seleccioná los sabores que te gustan. La cantidad de rellenos dependerá del tamaño y formato de la torta; nuestro equipo definirá la distribución adecuada.</p><div class="choice-grid">${active("RELLENOS").map(r=>`<div class="choice ${order.fillings.includes(r.Nombre)?"selected":""}" onclick='toggleFill(${j(r.Nombre)})'>${esc(r.Nombre)}</div>`).join("")}</div><div class="choice ${order.fillings.includes("CONSULTAR_OTRO")?"selected":""}" onclick='toggleFill("CONSULTAR_OTRO")'>➕ Consultar por otro relleno</div>${order.fillings.includes("CONSULTAR_OTRO")?`<textarea class="textarea" placeholder="Contanos qué relleno te gustaría consultar" onchange="setField('fillingsExtra', this.value)">${esc(order.fillingsExtra||"")}</textarea>`:""}`;
}

function toggleFill(v){ const i=order.fillings.indexOf(v); i>=0?order.fillings.splice(i,1):order.fillings.push(v); renderStep(); }

function boxHTML(){
  return `<h2 class="step-title">¿Querés la torta con caja?</h2><div class="choice-grid"><div class="choice ${order.box===true?"selected":""}" onclick="order.box=true;renderStep()">📦 Sí</div><div class="choice ${order.box===false?"selected":""}" onclick="order.box=false;renderStep()">Sin caja</div></div><p class="muted">El tipo y tamaño de caja se define según las características de la torta.</p>`;
}

function customHTML(){
  return `<h2 class="step-title">✨ Personalizá tu torta</h2><p class="hint">Contanos cualquier detalle que quieras agregar.</p><div class="muted">Por ejemplo:</div><ul><li>"Quiero que diga Martina"</li><li>"Me gustaría que sea rosa y blanco"</li><li>"Es para un cumpleaños de 15"</li><li>"Quiero mariposas doradas"</li><li>"Me gustaría agregar el número 18"</li><li>"Quiero algo parecido a una torta que vi en Instagram"</li></ul><textarea class="textarea" placeholder="Contanos qué tenés en mente..." onchange="setField('custom', this.value)">${esc(order.custom)}</textarea>`;
}

function detailsHTML(){
  return `<h2 class="step-title">Datos del pedido</h2><label>Nombre</label><input class="input" value="${esc(order.name)}" onchange="setField('name', this.value)" placeholder="Tu nombre"><label>Tu WhatsApp</label><input class="input" type="tel" value="${esc(order.clientPhone)}" onchange="setField('clientPhone', this.value)" placeholder="Ej: 1122334455"><label>Fecha de retiro</label><input class="input" type="date" value="${esc(order.date)}" onchange="setField('date', this.value)"><label>Hora aproximada</label><input class="input" type="time" value="${esc(order.time)}" onchange="setField('time', this.value)"><label>¿Algo más que debamos saber?</label><textarea class="textarea" onchange="setField('extra', this.value)" placeholder="Opcional">${esc(order.extra||"")}</textarea>`;
}

function sweetHTML(){
  return `<h2 class="step-title">🍰 Mesa dulce</h2><p class="hint">Estos productos tienen precios fijos.</p><div class="products">${active("MESA_DULCE").map(p=>productHTML(p,true)).join("")}</div><label style="margin-top:18px;display:block">➕ ¿Buscás otra tarta o producto que no está en la lista?</label><textarea class="textarea" placeholder="Contanos qué te gustaría consultar" onchange="setField('sweetExtra', this.value)">${esc(order.sweetExtra||"")}</textarea>`;
}

function saltyHTML(){
  return `<h2 class="step-title">🥪 Mesa salada</h2><p class="hint">Los productos de mesa salada se cotizan según el pedido.</p><div class="products">${active("MESA_SALADA").map(p=>productHTML(p,false)).join("")}</div><label style="margin-top:18px;display:block">➕ ¿Buscás otra opción que no está en la lista?</label><textarea class="textarea" placeholder="Contanos qué te gustaría consultar" onchange="setField('saltyExtra', this.value)">${esc(order.saltyExtra||"")}</textarea>`;
}

function productHTML(p, price){
  const arr = price ? order.sweet : order.salty;
  const found = arr.find(x => x.ID == p.ID);
  const qty = found?.qty || 0;
  return `<div class="product">${p.Imagen_URL?`<img src="${esc(p.Imagen_URL)}">`:""}<b>${esc(p.Producto)}</b>${price?`<div>$ ${money(p.Precio)}</div>`:`<div class="muted">A cotizar</div>`}<div class="qty"><button onclick='changeProduct(${j(p)},${price},-1)'>−</button><b>${qty}</b><button onclick='changeProduct(${j(p)},${price},1)'>+</button></div></div>`;
}

function changeProduct(p, isSweet, d){
  const arr = isSweet ? order.sweet : order.salty;
  let x = arr.find(x => x.ID == p.ID);
  if(!x && d>0){ x = {...p, qty:0}; arr.push(x); }
  if(x){ x.qty += d; if(x.qty<=0) arr.splice(arr.indexOf(x),1); }
  renderStep();
}

function summaryHTML(){
  const sweetTotal = order.sweet.reduce((a,x)=>a+(+x.Precio||0)*x.qty,0);
  return `<h2 class="step-title">Tu pedido</h2><div class="summary"><h3>🎂 Torta</h3><div class="summary-row"><span>Tamaño</span><b>${order.mode=="people"?order.people+" personas (≈ "+Math.round(order.people/10)+" kg)":order.kg+" kg (≈ "+order.kg*10+" personas)"}</b></div><div class="summary-row"><span>Diseño</span><b>${esc(order.design?.Hashtag||order.design?.Nombre||"Personalizado")}</b></div>${order.designNote?`<p><b>Idea de diseño:</b> ${esc(order.designNote)}</p>`:""}<div class="summary-row"><span>Rellenos</span><b>${order.fillings.map(x=>x=="CONSULTAR_OTRO"?"Consultar otro relleno":x).join(", ")}</b></div>${order.fillingsExtra?`<p><b>Consulta de relleno:</b> ${esc(order.fillingsExtra)}</p>`:""}<div class="summary-row"><span>Cobertura</span><b>Crema</b></div><div class="summary-row"><span>Caja</span><b>${order.box?"Sí":"No"}</b></div>${order.custom?`<h3>✨ Personalización</h3><p>${esc(order.custom)}</p>`:""}<h3>📅 Retiro</h3><p>${esc(order.name)} — ${esc(order.clientPhone)} — ${esc(order.date)} — ${esc(order.time)} aprox.</p>${order.extra?`<p>${esc(order.extra)}</p>`:""}<h3>🍰 Mesa dulce</h3>${order.sweet.length?order.sweet.map(x=>`<div class="summary-row"><span>${x.qty} × ${esc(x.Producto)}</span><b>$ ${money((+x.Precio||0)*x.qty)}</b></div>`).join(""):"<p class='muted'>Sin mesa dulce</p>"}<div class="summary-row"><span><b>Subtotal mesa dulce</b></span><b>$ ${money(sweetTotal)}</b></div>${order.sweetExtra?`<p><b>Consulta:</b> ${esc(order.sweetExtra)}</p>`:""}<h3>🥪 Mesa salada</h3>${order.salty.length?order.salty.map(x=>`<div class="summary-row"><span>${x.qty} × ${esc(x.Producto)}</span><b>A cotizar</b></div>`).join(""):"<p class='muted'>Sin mesa salada</p>"}${order.saltyExtra?`<p><b>Consulta:</b> ${esc(order.saltyExtra)}</p>`:""}<p class="muted">Las tortas y opciones saladas requieren cotización. El pedido será revisado por nuestro equipo.</p></div>`;
}

function sendWhatsApp(){
  const c = objects("CONFIGURACION");
  const wa = (c.find(x => x.Campo === "WhatsApp") || {}).Valor || "";
  if(!wa || wa.toUpperCase().includes("X")) return toast("Configurá el número de WhatsApp en Google Sheets.");

  const sweetTotal = order.sweet.reduce((a,x)=>a+(+x.Precio||0)*x.qty,0);
  const lines = [
    "Hola! 👋 Quiero solicitar un presupuesto.",
    "",
    "🎂 TORTA",
    `• Tamaño: ${order.mode=="people"?order.people+" personas (≈ "+Math.round(order.people/10)+" kg)":order.kg+" kg (≈ "+order.kg*10+" personas)"}`,
    `• Diseño: ${order.design?.Hashtag||order.design?.Nombre||"Personalizado"}`,
    ...(order.designNote ? [`• Idea de diseño: ${order.designNote}`] : []),
    ...(order.design?.custom ? [`• (Te mando una foto de referencia a continuación en este mismo chat)`] : []),
    `• Rellenos: ${order.fillings.map(x=>x=="CONSULTAR_OTRO"?"Consultar otro":x).join(", ")}`,
    ...(order.fillingsExtra ? [`• Consulta de relleno: ${order.fillingsExtra}`] : []),
    "• Cobertura: Crema",
    `• Caja: ${order.box?"Sí":"No"}`,
    ...(order.custom ? [`• Personalización: ${order.custom}`] : []),
    "",
    "📅 RETIRO",
    `• Nombre: ${order.name}`,
    `• Fecha: ${order.date}`,
    `• Hora aproximada: ${order.time}`,
    ...(order.extra ? [`• Extra: ${order.extra}`] : []),
    "",
    "🍰 MESA DULCE",
    ...(order.sweet.length ? order.sweet.map(x=>`• ${x.qty} × ${x.Producto} — $${money((+x.Precio||0)*x.qty)}`) : ["• Sin mesa dulce"]),
    `• Subtotal mesa dulce: $${money(sweetTotal)}`,
    ...(order.sweetExtra ? [`• Consulta: ${order.sweetExtra}`] : []),
    "",
    "🥪 MESA SALADA",
    ...(order.salty.length ? order.salty.map(x=>`• ${x.qty} × ${x.Producto} — A cotizar`) : ["• Sin mesa salada"]),
    ...(order.saltyExtra ? [`• Consulta: ${order.saltyExtra}`] : []),
    "",
    "Quedo a la espera del presupuesto final. ¡Gracias!"
  ];
  const msg = lines.join("\n");
  enviarAAdmin(msg);
  clearProgress();
  window.open(`https://wa.me/${wa.replace(/\D/g,"")}?text=${encodeURIComponent(msg)}`, "_blank");
}

function enviarAAdmin(resumen){
  if(!PEDIDOS_WEBHOOK_URL) return; // todavía no configuraste el webhook, no pasa nada
  try{
    fetch(PEDIDOS_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        cliente: order.name,
        clientePhone: order.clientPhone,
        fechaRetiro: order.date,
        horaRetiro: order.time,
        resumen
      })
    });
  }catch(e){
    console.warn("[configurador] No se pudo guardar copia en la planilla admin:", e);
  }
}

function configMsg(){
  const c = objects("CONFIGURACION");
  return (c.find(x => x.Campo === "Mensaje kg/personas") || {}).Valor || "Aproximadamente 1 kg de torta cada 10 personas.";
}

function money(v){ return Number(v||0).toLocaleString("es-AR"); }
function esc(s){ return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m])); }
function j(o){ return JSON.stringify(o).replace(/'/g,"&#39;"); }
function toast(t){ const x=document.getElementById("toast"); x.textContent=t; x.style.display="block"; setTimeout(()=>x.style.display="none",2800); }

loadData();
