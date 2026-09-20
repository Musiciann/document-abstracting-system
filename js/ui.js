/* ======================= СОСТОЯНИЕ ======================= */

let documents = [];
let activeId = null;
let lastResult = null;

/* ======================= МЕЛКИЕ УТИЛИТЫ РЕНДЕРА ======================= */

function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }

const METHOD_LABELS = {
  tfidf: 'TF-IDF + позиция',
  textrank: 'TextRank',
  luhn: 'Luhn',
  ensemble: 'Ансамбль (среднее трёх методов)'
};

/* ======================= ДОКУМЕНТЫ ======================= */

function renderDocList(){
  const list = document.getElementById('docList');
  list.innerHTML='';
  document.getElementById('docCount').textContent = documents.length ? `(${documents.length})` : '';
  for(const d of documents){
    const item = el('div','doc-item'+(d.id===activeId?' active':''));
    const name = el('span','name', d.name);
    const rm = el('span','rm','✕');
    rm.onclick = (e)=>{ e.stopPropagation(); removeDoc(d.id); };
    item.appendChild(name); item.appendChild(rm);
    item.onclick = ()=>{ activeId=d.id; renderDocList(); updateRunAvailability(); };
    list.appendChild(item);
    if(d.id===activeId){
      const meta = el('div','doc-meta', `${d.struct.lang.toUpperCase()} · ${d.text.length.toLocaleString('ru-RU')} симв. · ${d.struct.paragraphs.length} абз.`);
      list.appendChild(meta);
    }
  }
  document.getElementById('runTestsBtn').disabled = documents.length===0;
}

function updateRunAvailability(){
  document.getElementById('runBtn').disabled = activeId===null;
}

function addDocument(name, text){
  if(!text || !text.trim()) return;
  const struct = buildDocStruct(text);
  const doc = {id:'d'+Date.now()+Math.random().toString(36).slice(2,6), name, text, struct};
  documents.push(doc);
  activeId = doc.id;
  renderDocList();
  updateRunAvailability();
  updateModeNote();
}

function removeDoc(id){
  documents = documents.filter(d=>d.id!==id);
  if(activeId===id) activeId = documents.length ? documents[documents.length-1].id : null;
  renderDocList();
  updateRunAvailability();
  updateModeNote();
}

function updateModeNote(){
  const note = document.getElementById('modeNote');
  note.textContent = documents.length>1
    ? `IDF терминов считается по коллекции из ${documents.length} документов (междокументные частоты).`
    : `IDF терминов считается по абзацам документа. Добавьте ещё документы, чтобы включить оценку по коллекции.`;
}

/* ======================= ДОКУМЕНТ С ПОДСВЕТКОЙ ======================= */

function weightToColor(w, maxW){
  const t = maxW>0 ? Math.min(w/maxW,1) : 0;
  return `rgba(214,164,74,${(0.12 + t*0.75).toFixed(2)})`;
}

function renderDocPanel(result){
  document.getElementById('docEmpty').style.display='none';
  document.getElementById('docContent').style.display='block';
  const wrap = document.getElementById('docRender');
  wrap.innerHTML='';
  const maxW = Math.max(...result.sentences.map(s=>s.weight), 0.0001);
  const byPara = {};
  for(const s of result.sentences){ (byPara[s.paraIdx] = byPara[s.paraIdx]||[]).push(s); }
  const rankedSet = new Set(result.ranked);
  Object.keys(byPara).sort((a,b)=>a-b).forEach(pIdx=>{
    const p = el('p');
    for(const s of byPara[pIdx]){
      const span = el('span','sent'+(rankedSet.has(s)?' picked':''), s.text+' ');
      span.style.background = weightToColor(s.weight, maxW);
      span.title = `вес=${s.weight.toFixed(4)}`;
      span.dataset.terms = [...new Set(s.tokensFiltered)].join(',');
      p.appendChild(span);
    }
    wrap.appendChild(p);
  });
}

function highlightTerm(term){
  document.querySelectorAll('.sent').forEach(sp=>{
    const terms = (sp.dataset.terms||'').split(',');
    if(terms.includes(term)) sp.classList.add('term-hit');
    else sp.classList.add('dim');
  });
}
function clearHighlight(){
  document.querySelectorAll('.sent').forEach(sp=>{ sp.classList.remove('term-hit'); sp.classList.remove('dim'); });
}

/* ======================= РЕФЕРАТ ======================= */

function renderSummaryPanel(result){
  document.getElementById('summaryEmpty').style.display='none';
  document.getElementById('summaryContent').style.display='block';
  const wrap = document.getElementById('summaryRender');
  wrap.innerHTML='';
  const title = el('p','summary-title', 'Тема (авто): ' + result.autoTitle);
  wrap.appendChild(title);
  const p = el('p');
  result.summarySentences.forEach((s,i)=>{
    p.appendChild(el('span','n', (i+1)+'.'));
    p.appendChild(document.createTextNode(s.displayText+'  '));
  });
  wrap.appendChild(p);
}

/* ======================= КЛЮЧЕВЫЕ СЛОВА ======================= */

function renderKeywordsPanel(result){
  document.getElementById('kwEmpty').style.display='none';
  document.getElementById('kwContent').style.display='block';
  const tree = document.getElementById('kwTree');
  tree.innerHTML='';
  const kw = result.keywords;

  if(kw.method==='rake'){
    const maxScore = Math.max(...kw.phrases.map(p=>p.score), 0.0001);
    for(const p of kw.phrases){
      const row = el('div','kw-head');
      const bar = el('div','bar'); bar.style.width = (16+(p.score/maxScore)*90)+'px';
      row.appendChild(bar);
      row.appendChild(el('span','word', p.phrase));
      row.appendChild(el('span','val', p.score.toFixed(1)));
      tree.appendChild(row);
    }
    return;
  }

  const maxHeadW = Math.max(...kw.hierarchy.map(h=>h.w), 0.0001);
  for(const h of kw.hierarchy){
    const headRow = el('div','kw-head');
    const bar = el('div','bar'); bar.style.width = (16+(h.w/maxHeadW)*90)+'px';
    headRow.appendChild(bar);
    headRow.appendChild(el('span','word', h.head));
    headRow.appendChild(el('span','val', h.w.toFixed(2)));
    tree.appendChild(headRow);
    if(h.children.length){
      const kids = el('div','kw-children');
      const maxChildScore = Math.max(...h.children.map(c=>c.score),0.0001);
      for(const c of h.children){
        const row = el('div','kw-child');
        const bar2 = el('div','bar2'); bar2.style.width = (10+(c.score/maxChildScore)*60)+'px';
        row.appendChild(el('span','stem','↳'));
        row.appendChild(document.createTextNode(c.phrase));
        row.appendChild(bar2);
        kids.appendChild(row);
      }
      tree.appendChild(kids);
    }
  }
  if(kw.otherPhrases.length){
    const headRow = el('div','kw-head');
    headRow.appendChild(el('div','bar',''));
    headRow.appendChild(el('span','word','другие словосочетания'));
    tree.appendChild(headRow);
    const kids = el('div','kw-children');
    for(const c of kw.otherPhrases){
      const row = el('div','kw-child');
      row.appendChild(el('span','stem','↳'));
      row.appendChild(document.createTextNode(c.phrase));
      kids.appendChild(row);
    }
    tree.appendChild(kids);
  }
}

/* ======================= ГРАФ ПОНЯТИЙ ======================= */

function renderGraphPanel(result){
  document.getElementById('graphContent').style.display='block';
  const svg = document.getElementById('graphSvg');
  svg.innerHTML='';
  const W=820,H=480,cx=W/2,cy=H/2-10;
  const nodes = result.graphNodes;
  const R = Math.min(W,H)/2 - 100;
  const maxW = Math.max(...nodes.map(n=>n.w),0.0001);
  const pos = {};
  nodes.forEach((n,i)=>{
    const angle = (i/nodes.length)*Math.PI*2 - Math.PI/2;
    pos[n.id] = {x: cx + R*Math.cos(angle), y: cy + R*Math.sin(angle)};
  });
  const maxEdgeW = Math.max(...result.graphEdges.map(e=>e.weight),1);
  for(const e of result.graphEdges){
    if(!pos[e.a]||!pos[e.b]) continue;
    const line = document.createElementNS('http://www.w3.org/2000/svg','line');
    line.setAttribute('x1',pos[e.a].x); line.setAttribute('y1',pos[e.a].y);
    line.setAttribute('x2',pos[e.b].x); line.setAttribute('y2',pos[e.b].y);
    line.setAttribute('class','edge-line');
    const t = e.weight/maxEdgeW;
    line.setAttribute('stroke-width', 1 + t*4);
    line.setAttribute('stroke-opacity', 0.25 + t*0.5);
    svg.appendChild(line);
  }
  nodes.forEach(n=>{
    const p = pos[n.id];
    const rx = 26 + (n.w/maxW)*20, ry = rx*0.6;
    const ellipse = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
    ellipse.setAttribute('cx',p.x); ellipse.setAttribute('cy',p.y);
    ellipse.setAttribute('rx',rx); ellipse.setAttribute('ry',ry);
    ellipse.setAttribute('class','node-circle');
    ellipse.setAttribute('fill', (n.w/maxW)>0.66 ? 'var(--amber)' : 'var(--teal)');
    ellipse.addEventListener('mouseenter', ()=>highlightTerm(n.id));
    ellipse.addEventListener('mouseleave', ()=>clearHighlight());
    svg.appendChild(ellipse);

    const labelY = p.y + ry + 18;
    const approxW = Math.min(n.id.length*6.6+10, 150);
    const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('x', p.x-approxW/2); bg.setAttribute('y', labelY-12);
    bg.setAttribute('width', approxW); bg.setAttribute('height', 17); bg.setAttribute('rx', 4);
    bg.setAttribute('fill', 'rgba(20,33,31,0.85)');
    svg.appendChild(bg);

    const label = document.createElementNS('http://www.w3.org/2000/svg','text');
    label.setAttribute('x',p.x); label.setAttribute('y',labelY);
    label.setAttribute('text-anchor','middle');
    label.setAttribute('class','node-label');
    label.textContent = n.id;
    svg.appendChild(label);
  });

  const legend = document.getElementById('graphLegend');
  legend.innerHTML = '';
  const colConcepts = el('div','legend-col');
  colConcepts.appendChild(el('p','legend-title','Понятия (вес TF·IDF)'));
  nodes.slice().sort((a,b)=>b.w-a.w).forEach(n=>{
    const row = el('div','legend-row');
    const bar = el('div','legend-bar'); bar.style.width = (8+(n.w/maxW)*70)+'px';
    row.appendChild(el('span','legend-name', n.id));
    row.appendChild(bar);
    row.appendChild(el('span','legend-val', n.w.toFixed(2)));
    row.addEventListener('mouseenter', ()=>highlightTerm(n.id));
    row.addEventListener('mouseleave', ()=>clearHighlight());
    colConcepts.appendChild(row);
  });
  const colEdges = el('div','legend-col');
  colEdges.appendChild(el('p','legend-title','Совместная встречаемость'));
  const maxEw = Math.max(...result.graphEdges.map(e=>e.weight),1);
  result.graphEdges.forEach(e=>{
    const row = el('div','legend-row');
    const bar = el('div','legend-bar'); bar.style.width = (8+(e.weight/maxEw)*70)+'px';
    row.appendChild(el('span','legend-name', e.a+' — '+e.b));
    row.appendChild(bar);
    row.appendChild(el('span','legend-val', String(e.weight)));
    colEdges.appendChild(row);
  });
  legend.appendChild(colConcepts);
  legend.appendChild(colEdges);
}

/* ======================= СРАВНЕНИЕ МЕТОДОВ ======================= */

function renderComparisonPanel(result){
  document.getElementById('cmpEmpty').style.display='none';
  document.getElementById('cmpContent').style.display='block';
  const mc = result.methodComparison;
  const unionIdx = [...new Set([...mc.idxTfidf, ...mc.idxTextRank, ...mc.idxLuhn])].sort((a,b)=>a-b);

  const table = el('table','testtable');
  table.innerHTML = `<tr><th>#</th><th>TF-IDF</th><th>TextRank</th><th>Luhn</th><th>Предложение</th></tr>`;
  for(const i of unionIdx){
    const s = mc.sentences[i];
    const mark = (set)=> set.has(i) ? '●' : '';
    const tr = el('tr','', `<td>${i+1}</td><td style="text-align:center">${mark(mc.idxTfidf)}</td><td style="text-align:center">${mark(mc.idxTextRank)}</td><td style="text-align:center">${mark(mc.idxLuhn)}</td><td>${s.text.slice(0,110)}${s.text.length>110?'…':''}</td>`);
    table.appendChild(tr);
  }
  const wrap = document.getElementById('cmpTable');
  wrap.innerHTML = '';
  wrap.appendChild(table);

  const ov = mc.overlap;
  document.getElementById('cmpOverlap').innerHTML = `
    <div class="legend-row"><span class="legend-name">TF-IDF ↔ TextRank</span><div class="legend-bar" style="width:${8+ov.tfidf_textrank*70}px"></div><span class="legend-val">${(ov.tfidf_textrank*100).toFixed(0)}%</span></div>
    <div class="legend-row"><span class="legend-name">TF-IDF ↔ Luhn</span><div class="legend-bar" style="width:${8+ov.tfidf_luhn*70}px"></div><span class="legend-val">${(ov.tfidf_luhn*100).toFixed(0)}%</span></div>
    <div class="legend-row"><span class="legend-name">TextRank ↔ Luhn</span><div class="legend-bar" style="width:${8+ov.textrank_luhn*70}px"></div><span class="legend-val">${(ov.textrank_luhn*100).toFixed(0)}%</span></div>
  `;
}

/* ======================= СТАТИСТИКА ======================= */

function renderStats(result, doc){
  const words = doc.text.split(/\s+/).filter(Boolean).length;
  document.getElementById('statLen').innerHTML = `${result.totalSentences} <small>предл.</small> · ${words} <small>слов</small>`;
  document.getElementById('langBadges').innerHTML = `<span class="badge on">${doc.struct.lang==='ru'?'русский':doc.struct.lang==='en'?'английский':'не определён'}</span>`;
  document.getElementById('domainBadges').innerHTML = `<span class="badge on med">${result.domain.label}</span>`;
  const ratio = result.totalSentences ? (result.summarySentences.length/result.totalSentences*100) : 0;
  document.getElementById('statCompression').innerHTML = `${ratio.toFixed(0)}% <small>от ${result.totalSentences} предл.</small>`;
  document.getElementById('gaugeCompression').style.width = ratio.toFixed(0)+'%';
  const inf = result.informativeness*100;
  document.getElementById('statInform').innerHTML = `${inf.toFixed(0)}<small>%</small>`;
  document.getElementById('gaugeInform').style.width = inf.toFixed(0)+'%';
  document.getElementById('statTime').innerHTML = `${result.timeMs.toFixed(1)} <small>мс</small>`;
  document.getElementById('statIdfSrc').textContent = result.idfBase.mode==='corpus'
    ? `коллекция, |DB|=${result.idfBase.DB}`
    : `абзацы документа, |DB|=${result.idfBase.DB}`;
}

/* ======================= ЗАПУСК ======================= */

function getOpts(){
  return {
    length: parseInt(document.getElementById('lenSlider').value,10),
    method: document.getElementById('methodSelect').value,
    keywordMethod: document.getElementById('kwMethodSelect').value,
    usePosd: document.getElementById('usePosd').checked,
    usePosp: document.getElementById('usePosp').checked,
    crossScript: document.getElementById('crossScript').checked,
    useMMR: document.getElementById('useMMR').checked,
    trimDiscourse: document.getElementById('trimDiscourse').checked
  };
}

function runActive(){
  if(activeId===null) return;
  const doc = documents.find(d=>d.id===activeId);
  const result = runSummarization(doc, getOpts(), documents, documents.length>1);
  lastResult = result;
  renderDocPanel(result);
  renderSummaryPanel(result);
  renderKeywordsPanel(result);
  renderGraphPanel(result);
  renderComparisonPanel(result);
  renderStats(result, doc);
}

function runTestCollection(){
  const container = document.getElementById('testResults');
  container.innerHTML = '<p class="hint-text">Выполняется…</p>';
  const opts = getOpts();
  const rows = documents.map(doc=>({doc, res: runSummarization(doc, opts, documents, documents.length>1)}));
  const table = el('table','testtable');
  table.innerHTML = `<tr><th>Документ</th><th>Язык</th><th>Область</th><th>Метод</th><th>Предл.</th><th>В реферате</th><th>Информативность</th><th>Время, мс</th></tr>`;
  for(const r of rows){
    const tr = el('tr','', `<td>${r.doc.name}</td><td>${r.doc.struct.lang}</td><td>${r.res.domain.label}</td><td>${METHOD_LABELS[opts.method]}</td><td>${r.res.totalSentences}</td><td>${r.res.summarySentences.length}</td><td>${(r.res.informativeness*100).toFixed(0)}%</td><td>${r.res.timeMs.toFixed(2)}</td>`);
    table.appendChild(tr);
  }
  container.innerHTML='';
  container.appendChild(table);
  switchTab('panelAnalysis');
  document.getElementById('analysisTestBtn').click();
}

function switchTab(panelId){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.panel===panelId));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active', p.id===panelId));
}

/* ======================= СОБЫТИЯ ======================= */

document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click', ()=>switchTab(tab.dataset.panel));
});

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
dropzone.addEventListener('click', ()=>fileInput.click());
['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev, e=>{e.preventDefault(); dropzone.classList.add('drag');}));
['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev, e=>{e.preventDefault(); dropzone.classList.remove('drag');}));
dropzone.addEventListener('drop', e=>{ [...e.dataTransfer.files].forEach(readFile); });
fileInput.addEventListener('change', e=>{ [...e.target.files].forEach(readFile); fileInput.value=''; });
function readFile(file){
  const reader = new FileReader();
  reader.onload = ()=> addDocument(file.name, reader.result);
  reader.readAsText(file, 'utf-8');
}

document.getElementById('addPasted').addEventListener('click', ()=>{
  const box = document.getElementById('pasteBox');
  if(box.value.trim()){
    addDocument('вставленный текст #'+(documents.length+1)+'.txt', box.value);
    box.value='';
  }
});
document.getElementById('loadSamples').addEventListener('click', ()=>{
  SAMPLES.forEach(s=>addDocument(s.name, s.text));
});

document.getElementById('analysisCompareBtn').addEventListener('click', ()=>{
  document.getElementById('analysisCompareBtn').classList.add('on');
  document.getElementById('analysisTestBtn').classList.remove('on');
  document.getElementById('analysisCompareView').style.display='block';
  document.getElementById('analysisTestView').style.display='none';
});
document.getElementById('analysisTestBtn').addEventListener('click', ()=>{
  document.getElementById('analysisTestBtn').classList.add('on');
  document.getElementById('analysisCompareBtn').classList.remove('on');
  document.getElementById('analysisTestView').style.display='block';
  document.getElementById('analysisCompareView').style.display='none';
});

document.getElementById('lenSlider').addEventListener('input', e=>{
  document.getElementById('lenVal').textContent = e.target.value + ' предл.';
});

document.getElementById('runBtn').addEventListener('click', runActive);
document.getElementById('runTestsBtn').addEventListener('click', runTestCollection);

renderDocList();
updateModeNote();
