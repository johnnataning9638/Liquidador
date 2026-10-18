// DIAN Excel v16.33.178 — CONTROL CANÓNICO TDJ.
// Solo corrige la presentación/reconstrucción del XLSX. No toca motores,
// fórmulas ni resultados. La fuente de títulos es el bloque de recuperación
// canónico que el propio exportador genera con los valores nominales originales.
(function(){
  "use strict";
  if(window.__dianExcelTdjControl178)return;
  window.__dianExcelTdjControl178=true;

  const enc=new TextEncoder(),dec=new TextDecoder();
  const u16=v=>new Uint8Array([v&255,(v>>>8)&255]);
  const u32=v=>new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
  const rd16=(a,p)=>a[p]|(a[p+1]<<8);
  const rd32=(a,p)=>(a[p]|(a[p+1]<<8)|(a[p+2]<<16)|(a[p+3]<<24))>>>0;
  const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—−]/g,"-").replace(/\s+/g," ").trim().toUpperCase();
  const num=v=>{const n=Number(String(v??"").replace(/[^0-9.-]/g,""));return Number.isFinite(n)?Math.trunc(n):0;};
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  const col=n=>{let s="";while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};

  function crc32(bytes){let t=crc32.t;if(!t){t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}crc32.t=t;}let c=0xffffffff;for(const b of bytes)c=t[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}

  function unzip(buffer){
    const b=new Uint8Array(buffer),out={};let p=0;
    while(p+30<=b.length){
      if(rd32(b,p)!==0x04034b50)break;
      const method=rd16(b,p+8),size=rd32(b,p+18),nl=rd16(b,p+26),xl=rd16(b,p+28),name=dec.decode(b.slice(p+30,p+30+nl));
      const start=p+30+nl+xl,raw=b.slice(start,start+size);
      if(method!==0)throw new Error("XLSX no compatible para el control TDJ 178");
      out[name]=raw;p=start+size;
    }
    return out;
  }
  function sharedStrings(files){
    const b=files["xl/sharedStrings.xml"];if(!b)return [];
    const xml=dec.decode(b);return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join("").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'"));
  }
  function parseRows(xml,sst){
    const doc=new DOMParser().parseFromString(xml,"application/xml");
    return [...doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","row")].map(row=>{
      const values={};
      for(const c of row.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","c")){
        const ref=c.getAttribute("r")||"",m=ref.match(/^([A-Z]+)(\d+)$/);if(!m)continue;
        let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;
        const type=c.getAttribute("t")||"",v=c.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","v")[0]?.textContent||"";
        let value=v;
        if(type==="s")value=sst[Number(v)]??v;
        else if(type==="inlineStr")value=c.getElementsByTagNameNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","t")[0]?.textContent||"";
        values[n]=value;
      }
      return {row,values};
    });
  }
  const text=r=>Object.values(r.values).join(" | ");

  function extraerTitulos(rows){
    for(let i=0;i<rows.length;i++){
      if(norm(rows[i].values[1])!=="TÍTULOS TDJ")continue;
      const h=rows[i].values;
      const cN=Object.keys(h).find(k=>norm(h[k])==="Nº")||2;
      const cT=Object.keys(h).find(k=>norm(h[k])==="TDJ")||3;
      const cF=Object.keys(h).find(k=>norm(h[k])==="FECHA")||4;
      const cV=Object.keys(h).find(k=>norm(h[k])==="VALOR")||5;
      const cTy=Object.keys(h).find(k=>norm(h[k])==="TIPO")||6;
      const cO=Object.keys(h).find(k=>norm(h[k])==="OBSERVACIÓN")||7;
      const out=[];
      for(let j=i+1;j<rows.length;j++){
        const r=rows[j].values,first=norm(r[1]);
        if(first==="FIN RECUPERACIÓN COMPLETA")break;
        const tdj=String(r[cT]??"").trim(),fecha=String(r[cF]??"").trim(),nominal=num(r[cV]);
        if(!tdj||!fecha)continue;
        out.push({orden:num(r[cN])||out.length+1,tdj,fecha,nominal,tipo:String(r[cTy]??"TASA DIAN"),obs:String(r[cO]??"")});
      }
      if(out.length)return out;
    }
    return [];
  }

  function extraerAplicados(rows){
    const map=new Map();
    for(let i=0;i<rows.length;i++){
      const vals=Object.values(rows[i].values).map(norm);
      if(!vals.includes("TDJ Nº")||!vals.includes("TOTAL APLICADO"))continue;
      const h=rows[i].values,tdjCol=Object.keys(h).find(k=>norm(h[k])==="TDJ Nº"),appCol=Object.keys(h).find(k=>norm(h[k])==="TOTAL APLICADO");
      for(let j=i+1;j<rows.length;j++){
        const r=rows[j].values,s=norm(text(rows[j]));
        if(s.includes("DETALLE DE INTERESES")||s.includes("TÍTULOS / TDJ")||s.includes("RECUPERACIÓN COMPLETA"))break;
        const tdj=String(r[tdjCol]??"").trim();if(!tdj)continue;
        map.set(norm(tdj),(map.get(norm(tdj))||0)+Math.max(0,num(r[appCol])));
      }
      break;
    }
    return map;
  }

  function rowXml(n,values,numericCols=[]){return `<row r="${n}">${values.map((v,i)=>numericCols.includes(i+1)?`<c r="${col(i+1)}${n}" t="n"><v>${num(v)}</v></c>`:`<c r="${col(i+1)}${n}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`).join("")}</row>`;}

  function addCanonicalControl(xml,titulos,aplicados){
    const doc=new DOMParser().parseFromString(xml,"application/xml"),ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const sheetData=doc.getElementsByTagNameNS(ns,"sheetData")[0];if(!sheetData)return xml;
    const rows=[...sheetData.getElementsByTagNameNS(ns,"row")];
    const remove=[];for(let i=0;i<rows.length;i++){
      const vals=[...rows[i].getElementsByTagNameNS(ns,"c")].map(c=>c.getElementsByTagNameNS(ns,"t")[0]?.textContent||c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"");
      if(vals.some(v=>norm(v)==="TÍTULOS / TDJ — TÍTULOS REGISTRADOS")){
        let j=i;while(j<rows.length){remove.push(rows[j]);const tx=[...rows[j].getElementsByTagNameNS(ns,"c")].map(c=>norm(c.getElementsByTagNameNS(ns,"t")[0]?.textContent||""));j++;if(tx.some(v=>v==="TOTAL TÍTULOS"))break;}i=j-1;
      }
    }
    remove.forEach(r=>r.remove());
    const current=[...sheetData.getElementsByTagNameNS(ns,"row")];let n=Math.max(0,...current.map(r=>Number(r.getAttribute("r")||0)))+2;
    const frag=doc.createDocumentFragment();
    const append=(vals,numCols=[])=>{const holder=doc.createElementNS(ns,"row-holder");holder.innerHTML=rowXml(n,vals,numCols);const row=holder.firstElementChild;row.setAttribute("r",String(n));for(const c of [...row.children])c.setAttribute("r",`${c.getAttribute("r")}`);frag.appendChild(row);n++;};
    append(["TÍTULOS / TDJ — CONTROL FINAL 178"]);
    append(["Nº","TDJ","FECHA","VALOR ORIGINAL","APLICADO","ENDOSO","DESTINO","TIPO","OBSERVACIÓN"]);
    let totalO=0,totalA=0,totalE=0;
    titulos.forEach((t,i)=>{const a=Math.min(Math.max(0,t.nominal),Math.max(0,aplicados.get(norm(t.tdj))||0));const e=Math.max(0,t.nominal-a);totalO+=t.nominal;totalA+=a;totalE+=e;append([t.orden||i+1,t.tdj,t.fecha,t.nominal,a,e,e>0?"DISPONIBLE PARA SIGUIENTE OBLIGACIÓN / ENDOSO":"APLICADO A OBLIGACIÓN 1",t.tipo,t.obs],[1,4,5,6]);});
    append(["TOTAL TÍTULOS","","",totalO,totalA,totalE,"","",""] ,[4,5,6]);
    sheetData.appendChild(frag);
    const dim=doc.getElementsByTagNameNS(ns,"dimension")[0];if(dim)dim.setAttribute("ref",`A1:${col(14)}${n}`);
    return new XMLSerializer().serializeToString(doc);
  }

  function rebuild(files,xml){
    const updated={...files,"xl/worksheets/sheet1.xml":enc.encode(xml)},chunks=[],central=[];let offset=0;
    for(const [name,data] of Object.entries(updated)){const nb=enc.encode(name),crc=crc32(data),h=new Uint8Array(30+nb.length+data.length);let p=0;h.set([80,75,3,4],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(crc),p);p+=4;h.set(u32(data.length),p);p+=4;h.set(u32(data.length),p);p+=4;h.set(u16(nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(nb,p);p+=nb.length;h.set(data,p);chunks.push(h);central.push({nb,crc,size:data.length,offset});offset+=h.length;}
    const cd=central.map(f=>{const h=new Uint8Array(46+f.nb.length);let p=0;h.set([80,75,1,2],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(f.crc),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u16(f.nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(0),p);p+=4;h.set(u32(f.offset),p);p+=4;h.set(f.nb,p);return h;});
    const cdSize=cd.reduce((a,x)=>a+x.length,0),end=new Uint8Array(22);let p=0;end.set([80,75,5,6],p);p+=4;end.set(u16(0),p);p+=2;end.set(u16(0),p);p+=2;end.set(u16(Object.keys(updated).length),p);p+=2;end.set(u16(Object.keys(updated).length),p);p+=2;end.set(u32(cdSize),p);p+=4;end.set(u32(offset),p);p+=4;end.set(u16(0),p);
    const out=new Uint8Array(offset+cdSize+22);let q=0;for(const x of [...chunks,...cd,end]){out.set(x,q);q+=x.length;}return new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  const make=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),blobs=new Map();
  URL.createObjectURL=function(blob){const u=make(blob);blobs.set(u,blob);return u};URL.revokeObjectURL=function(u){blobs.delete(u);return revoke(u)};
  HTMLAnchorElement.prototype.click=function(){const a=this,url=a.href||"";if(!a.download||!/\.xlsx$/i.test(a.download)||!blobs.has(url))return HTMLElement.prototype.click.call(this);void blobs.get(url).arrayBuffer().then(buffer=>{const files=unzip(buffer),xml=dec.decode(files["xl/worksheets/sheet1.xml"]||new Uint8Array()),sst=sharedStrings(files),rows=parseRows(xml,sst),titulos=extraerTitulos(rows);if(!titulos.length)return HTMLElement.prototype.click.call(a);const nuevo=rebuild(files,addCanonicalControl(xml,titulos,extraerAplicados(rows))),nu=make(nuevo);a.href=nu;HTMLElement.prototype.click.call(a);setTimeout(()=>revoke(nu),2000);a.href=url}).catch(()=>HTMLElement.prototype.click.call(a));};
})();
