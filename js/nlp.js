function detectLang(text){
  const cyr = (text.match(/[а-яёА-ЯЁ]/g)||[]).length;
  const lat = (text.match(/[a-zA-Z]/g)||[]).length;
  if(cyr === 0 && lat === 0) return 'unk';
  return cyr >= lat ? 'ru' : 'en';
}

function detectDomain(tokens){
  let med=0, art=0;
  const medSet = new Set(DOMAIN_TERMS.medicine);
  const artSet = new Set(DOMAIN_TERMS.art);
  for(const t of tokens){
    if(medSet.has(t)) med++;
    if(artSet.has(t)) art++;
  }
  if(med<2 && art<2) return {label:'общая тематика', med, art};
  if(med>=art*1.2) return {label:'медицина', med, art};
  if(art>=med*1.2) return {label:'искусствоведческая критика', med, art};
  return {label:'смешанная / неопределённая', med, art};
}

function splitParagraphs(text){
  return text.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
}

function splitSentences(paragraph){
  let raw = paragraph.split(/(?<=[.!?…])\s+(?=[A-ZА-ЯЁ0-9«"'(])/);
  let out = [];
  for(let i=0;i<raw.length;i++){
    let s = raw[i].trim();
    if(!s) continue;
    if(out.length){
      let prevWordMatch = out[out.length-1].match(/([a-zA-Zа-яёА-ЯЁ.]+)\.$/);
      if(prevWordMatch){
        let stem = prevWordMatch[1].replace(/\.$/,'').toLowerCase();
        if(ABBR_RU.has(stem) || ABBR_EN.has(stem)){
          out[out.length-1] = out[out.length-1] + ' ' + s;
          continue;
        }
      }
    }
    out.push(s);
  }
  return out.filter(s=>s.length>0);
}

function tokenize(sentence){
  return (sentence.toLowerCase().match(/[a-zа-яё]+(?:-[a-zа-яё]+)?/gi)||[]).map(w=>w.toLowerCase());
}

function isStop(word){ return STOP_RU.has(word) || STOP_EN.has(word); }

function scriptOf(word){
  const cyr = /[а-яё]/.test(word), lat = /[a-z]/.test(word);
  if(cyr && !lat) return 'ru';
  if(lat && !cyr) return 'en';
  return 'mix';
}

function filterTokens(tokens, docLang, crossScriptFilter){
  return tokens.filter(w=>{
    if(w.length<2) return false;
    if(isStop(w)) return false;
    if(crossScriptFilter && docLang!=='unk'){
      const s = scriptOf(w);
      if(s!=='mix' && s!==docLang) return false;
    }
    return true;
  });
}

function buildDocStruct(text){
  const paragraphs = splitParagraphs(text).map(p=>({
    text:p, sentences: splitSentences(p)
  }));
  const lang = detectLang(text);
  return {paragraphs, lang, rawLength:text.length};
}

function countTokens(tokens){
  const m = new Map();
  for(const t of tokens) m.set(t,(m.get(t)||0)+1);
  return m;
}

function trimDiscourseMarker(text){
  let out = text;
  for(const m of DISCOURSE_MARKERS){
    const escaped = m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re = new RegExp('^\\s*' + escaped + '\\s*,?\\s*', 'i');
    if(re.test(out)){
      out = out.replace(re,'');
      break;
    }
  }
  if(out.length>0) out = out.charAt(0).toUpperCase() + out.slice(1);
  return out;
}
