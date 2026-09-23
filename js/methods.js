function buildIdfBase(activeDoc, allDocsForCorpus, crossScriptFilter){
  if(allDocsForCorpus && allDocsForCorpus.length>1){
    const df = new Map();
    for(const doc of allDocsForCorpus){
      const seen = new Set();
      for(const para of doc.struct.paragraphs){
        for(const sent of para.sentences){
          for(const tok of filterTokens(tokenize(sent), doc.struct.lang, crossScriptFilter)){
            seen.add(tok);
          }
        }
      }
      for(const term of seen) df.set(term,(df.get(term)||0)+1);
    }
    return {df, DB: allDocsForCorpus.length, mode:'corpus'};
  }
  const df = new Map();
  const paras = activeDoc.struct.paragraphs;
  for(const para of paras){
    const seen = new Set();
    for(const sent of para.sentences){
      for(const tok of filterTokens(tokenize(sent), activeDoc.struct.lang, crossScriptFilter)){
        seen.add(tok);
      }
    }
    for(const term of seen) df.set(term,(df.get(term)||0)+1);
  }
  return {df, DB: Math.max(paras.length,1), mode:'paragraph'};
}

function methodTfidfPosition(sentences, wTD, D_total, opts){
  return sentences.map(s=>{
    const posd = 1 - (s.charBeforeGlobal / D_total);
    const posp = 1 - (s.charBeforeInPara / Math.max(s.paraLen,1));
    const tfSi = countTokens(s.tokensFiltered);
    let score = 0;
    for(const [t,c] of tfSi.entries()) score += c * wTD(t);
    let weight = score;
    if(opts.usePosd) weight *= posd;
    if(opts.usePosp) weight *= posp;
    s.posd = posd; s.posp = posp; s.score = score;
    return weight;
  });
}

function methodTextRank(sentences){
  const n = sentences.length;
  if(n===0) return [];
  if(n===1) return [1];
  const sets = sentences.map(s=>new Set(s.tokensFiltered));
  const sim = Array.from({length:n},()=>new Array(n).fill(0));
  for(let i=0;i<n;i++){
    for(let j=i+1;j<n;j++){
      let common=0;
      for(const w of sets[i]) if(sets[j].has(w)) common++;
      const denom = Math.log(Math.max(sets[i].size,2)) + Math.log(Math.max(sets[j].size,2));
      const s = denom>0 ? common/denom : 0;
      sim[i][j]=s; sim[j][i]=s;
    }
  }
  const outSum = sim.map(row=>row.reduce((a,b)=>a+b,0));
  let scores = new Array(n).fill(1/n);
  const d = 0.85;
  for(let iter=0; iter<40; iter++){
    const next = new Array(n).fill((1-d)/n);
    for(let i=0;i<n;i++){
      let acc = 0;
      for(let j=0;j<n;j++){
        if(j===i || sim[i][j]===0 || outSum[j]===0) continue;
        acc += (sim[i][j]/outSum[j]) * scores[j];
      }
      next[i] += d*acc;
    }
    scores = next;
  }
  return scores;
}

function methodLuhn(sentences, tfD){
  const freqs = [...tfD.entries()].sort((a,b)=>b[1]-a[1]);
  const topCount = Math.max(4, Math.round(freqs.length*0.2));
  const significant = new Set(freqs.slice(0, topCount).map(([w])=>w));
  const maxGap = 4;
  return sentences.map(s=>{
    const toks = s.tokensRaw;
    let best = 0, clusterStart = -1, sigCount = 0, lastSigIdx = -1;
    const closeCluster = ()=>{
      const len = lastSigIdx - clusterStart + 1;
      const score = len>0 ? (sigCount*sigCount)/len : 0;
      if(score>best) best = score;
    };
    for(let i=0;i<toks.length;i++){
      if(significant.has(toks[i])){
        if(clusterStart===-1){ clusterStart=i; sigCount=1; }
        else if(i-lastSigIdx-1 <= maxGap){ sigCount++; }
        else { closeCluster(); clusterStart=i; sigCount=1; }
        lastSigIdx = i;
      }
    }
    if(clusterStart!==-1) closeCluster();
    return best;
  });
}

function minMaxNormalize(arr){
  const min = Math.min(...arr), max = Math.max(...arr);
  if(max-min < 1e-12) return arr.map(()=>0);
  return arr.map(v=>(v-min)/(max-min));
}

function mmrSelect(sentences, baseScores, N, lambda){
  const n = sentences.length;
  const selected = [];
  const remaining = new Set(sentences.map((_,i)=>i));
  function jaccard(i,j){
    const a = sentences[i]._tokenSet || (sentences[i]._tokenSet = new Set(sentences[i].tokensFiltered));
    const b = sentences[j]._tokenSet || (sentences[j]._tokenSet = new Set(sentences[j].tokensFiltered));
    if(a.size===0 || b.size===0) return 0;
    let inter=0; for(const w of a) if(b.has(w)) inter++;
    const uni = a.size + b.size - inter;
    return uni>0 ? inter/uni : 0;
  }
  while(selected.length<N && remaining.size>0){
    let bestIdx=-1, bestVal=-Infinity;
    for(const i of remaining){
      const maxSim = selected.length ? Math.max(...selected.map(j=>jaccard(i,j))) : 0;
      const val = lambda*baseScores[i] - (1-lambda)*maxSim;
      if(val>bestVal){ bestVal=val; bestIdx=i; }
    }
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }
  return selected.sort((a,b)=>a-b);
}

function topNByScore(baseScores, N){
  return baseScores
    .map((score,idx)=>({score,idx}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,N)
    .map(x=>x.idx)
    .sort((a,b)=>a-b);
}

function extractKeywordsTfidf(sentences, wTD, tfD){
  const termWeights = [];
  for(const term of tfD.keys()) termWeights.push({term, w:wTD(term), tf:tfD.get(term)});
  termWeights.sort((a,b)=>b.w-a.w);
  const topTerms = termWeights.slice(0, 14);

  const phraseCounts = new Map();
  for(const s of sentences){
    const toks = s.tokensFiltered;
    for(let n=2;n<=3;n++){
      for(let i=0;i+n<=toks.length;i++){
        const key = toks.slice(i,i+n).join(' ');
        phraseCounts.set(key, (phraseCounts.get(key)||0)+1);
      }
    }
  }
  const phraseScored = [];
  for(const [phrase,count] of phraseCounts.entries()){
    if(count<2) continue;
    const parts = phrase.split(' ');
    let sw = 0; for(const p of parts) sw += wTD(p);
    phraseScored.push({phrase, count, score: sw*count, parts});
  }
  phraseScored.sort((a,b)=>b.score-a.score);
  const topPhrases = phraseScored.slice(0,16);

  const hierarchy = topTerms.slice(0,8).map(h=>({
    head:h.term, w:h.w,
    children: topPhrases.filter(p=>p.parts.includes(h.term)).slice(0,5)
  }));
  const usedPhrases = new Set(hierarchy.flatMap(h=>h.children.map(c=>c.phrase)));
  const otherPhrases = topPhrases.filter(p=>!usedPhrases.has(p.phrase)).slice(0,6);

  return {method:'tfidf', topTerms, hierarchy, otherPhrases};
}

function extractKeywordsRake(sentences){
  const phraseFreq = new Map();
  const wordFreq = new Map();
  const wordDegree = new Map();
  for(const s of sentences){
    let current = [];
    const flush = ()=>{
      if(current.length){
        const phrase = current.join(' ');
        phraseFreq.set(phrase, (phraseFreq.get(phrase)||0)+1);
        for(const w of current){
          wordFreq.set(w,(wordFreq.get(w)||0)+1);
          wordDegree.set(w,(wordDegree.get(w)||0)+current.length);
        }
      }
      current = [];
    };
    for(const t of s.tokensRaw){
      if(isStop(t) || t.length<2) flush();
      else current.push(t);
    }
    flush();
  }
  const wordScore = new Map();
  for(const [w,freq] of wordFreq.entries()) wordScore.set(w, wordDegree.get(w)/freq);
  const phrases = [...phraseFreq.entries()]
    .filter(([phrase])=>phrase.length>1)
    .map(([phrase,count])=>{
      const words = phrase.split(' ');
      const score = words.reduce((sum,w)=>sum+(wordScore.get(w)||0),0);
      return {phrase, count, score};
    });
  phrases.sort((a,b)=>b.score-a.score);
  return {method:'rake', phrases: phrases.slice(0,18)};
}


function buildSentenceList(struct, crossScriptFilter){
  let sentences = [];
  for(let pIdx=0; pIdx<struct.paragraphs.length; pIdx++){
    const para = struct.paragraphs[pIdx];
    let charBeforeInPara = 0;
    for(let sIdx=0; sIdx<para.sentences.length; sIdx++){
      const sText = para.sentences[sIdx];
      const rawTok = tokenize(sText);
      const filtTok = filterTokens(rawTok, struct.lang, crossScriptFilter);
      sentences.push({
        text:sText, paraIdx:pIdx, idxInPara:sIdx,
        paraLen: para.text.length, charBeforeInPara,
        tokensRaw: rawTok, tokensFiltered: filtTok
      });
      charBeforeInPara += sText.length + 1;
    }
  }
  let charBefore = 0;
  for(const s of sentences){ s.charBeforeGlobal = charBefore; charBefore += s.text.length + 1; }
  return {sentences, D_total: Math.max(charBefore,1)};
}

function runSummarization(doc, opts, documents, corpusMode){
  const t0 = performance.now();
  const struct = doc.struct;
  const {sentences, D_total} = buildSentenceList(struct, opts.crossScript);

  const allFilteredTokens = sentences.flatMap(s=>s.tokensFiltered);
  const tfD = countTokens(allFilteredTokens);
  let tfMaxD = 0;
  for(const v of tfD.values()) if(v>tfMaxD) tfMaxD = v;
  tfMaxD = Math.max(tfMaxD,1);

  const corpusDocs = corpusMode ? documents.filter(d=>d.struct) : null;
  const idfBase = buildIdfBase(doc, corpusDocs, opts.crossScript);
  function wTD(term){
    const tf = tfD.get(term)||0;
    const df = idfBase.df.get(term) || 1;
    const DB = idfBase.DB;
    return 0.5*(1+tf/tfMaxD) * Math.log((DB+1)/df);
  }

  const rawTfidf = methodTfidfPosition(sentences, wTD, D_total, opts);
  const rawTextRank = methodTextRank(sentences);
  const rawLuhn = methodLuhn(sentences, tfD);

  let baseScores;
  if(opts.method==='textrank') baseScores = rawTextRank;
  else if(opts.method==='luhn') baseScores = rawLuhn;
  else if(opts.method==='ensemble'){
    const a = minMaxNormalize(rawTfidf), b = minMaxNormalize(rawTextRank), c = minMaxNormalize(rawLuhn);
    baseScores = sentences.map((_,i)=>(a[i]+b[i]+c[i])/3);
  } else baseScores = rawTfidf; // 'tfidf'
  sentences.forEach((s,i)=>{ s.weight = baseScores[i]; });

  const N = Math.min(opts.length, sentences.length);
  const selectedIdx = opts.useMMR ? mmrSelect(sentences, baseScores, N, 0.7) : topNByScore(baseScores, N);
  const selectedSet = new Set(selectedIdx);
  const ranked = sentences.filter((_,i)=>selectedSet.has(i));
  const summarySentences = ranked.map(s=>({
    ...s,
    displayText: opts.trimDiscourse ? trimDiscourseMarker(s.text) : s.text
  }));

  const idxTfidf = new Set(topNByScore(rawTfidf, N));
  const idxTextRank = new Set(topNByScore(rawTextRank, N));
  const idxLuhn = new Set(topNByScore(rawLuhn, N));
  function jaccardSets(a,b){
    let inter=0; for(const x of a) if(b.has(x)) inter++;
    const uni = new Set([...a,...b]).size;
    return uni>0 ? inter/uni : 0;
  }
  const methodComparison = {
    sentences, N,
    idxTfidf, idxTextRank, idxLuhn,
    overlap: {
      tfidf_textrank: jaccardSets(idxTfidf, idxTextRank),
      tfidf_luhn: jaccardSets(idxTfidf, idxLuhn),
      textrank_luhn: jaccardSets(idxTextRank, idxLuhn)
    }
  };

  const keywords = opts.keywordMethod==='rake'
    ? extractKeywordsRake(sentences)
    : extractKeywordsTfidf(sentences, wTD, tfD);

  const tfidfTermsForGraph = [...tfD.keys()].map(term=>({term, w:wTD(term)})).sort((a,b)=>b.w-a.w);
  const graphNodes = tfidfTermsForGraph.slice(0,8).map(t=>({id:t.term, w:t.w}));
  const nodeIdSet = new Set(graphNodes.map(n=>n.id));
  const edgeMap = new Map();
  for(const s of sentences){
    const present = [...new Set(s.tokensFiltered)].filter(t=>nodeIdSet.has(t));
    for(let i=0;i<present.length;i++){
      for(let j=i+1;j<present.length;j++){
        const a=present[i], b=present[j];
        const key = a<b ? a+'|'+b : b+'|'+a;
        edgeMap.set(key,(edgeMap.get(key)||0)+1);
      }
    }
  }
  const graphEdges = [...edgeMap.entries()]
    .map(([k,v])=>{ const [a,b]=k.split('|'); return {a,b,weight:v}; })
    .sort((a,b)=>b.weight-a.weight).slice(0,12);

  const autoTitle = [...tfD.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([term])=>term).join(' · ');

  const topByFreq = [...tfD.entries()].sort((a,b)=>b[1]-a[1]).slice(0,14).map(([term])=>term);
  const vecDoc = topByFreq.map(t=>tfD.get(t)||0);
  const tfSummary = countTokens(summarySentences.flatMap(s=>s.tokensFiltered));
  const vecSum = topByFreq.map(t=>tfSummary.get(t)||0);
  function cosine(a,b){
    let dot=0,na=0,nb=0;
    for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    if(na===0||nb===0) return 0;
    return dot/(Math.sqrt(na)*Math.sqrt(nb));
  }
  const informativeness = cosine(vecDoc, vecSum);
  const domain = detectDomain(allFilteredTokens);
  const t1 = performance.now();

  return {
    sentences, summarySentences, ranked,
    keywords, graphNodes, graphEdges, autoTitle,
    idfBase, informativeness, domain, methodComparison,
    totalChars: D_total, totalSentences: sentences.length,
    timeMs: (t1-t0)
  };
}
