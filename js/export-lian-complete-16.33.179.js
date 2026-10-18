// LIAN/DIAN Excel v16.33.179 — CONTROL CANÓNICO DE TÍTULOS.
// Corrige exclusivamente la trazabilidad del XLSX generado por el Liquidador
// normal: el valor nominal de cada TDJ se reconstruye desde la captura visible
// (#tablaPagos), mientras los valores aplicados permanecen en las columnas de
// resultado. No modifica motores, fórmulas, distribución ni resultados.
(function(){
  "use strict";
  if(typeof window==="undefined"||typeof document==="undefined")return;
  if(window.__lianExcelComplete179)return;
  window.__lianExcelComplete179=true;
  // Este control solo opera en el Liquidador normal. El módulo TDJ posee su
  // propia tabla de títulos y sus propios controles XLSX.
  if(document.getElementById("tablaTitulos"))return;

  const enc=new TextEncoder(),dec=new TextDecoder();
  const u16=v=>new Uint8Array([v&255,(v>>>8)&255]);
  const u32=v=>new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
  const rd16=(a,p)=>a[p]|(a[p+1]<<8);
  const rd32=(a,p)=>(a[p]|(a[p+1]<<8)|(a[p+2]<<16)|(a[p+3]<<24))>>>0;
  const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—−]/g,"-").replace(/\s+/g," ").trim().toUpperCase();
  const num=v=>{const s=String(v??"").replace(/[^0-9.-]/g,"");const n=Number(s);return Number.isFinite(n)?Math.trunc(n):0;};
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  const col=n=>{let s="";while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};

  function crc32(bytes){let t=crc32.t;if(!t){t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}crc32.t=t;}let c=0xffffffff;for(const b of bytes)c=t[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}

  function unzip(buffer){
    const b=new Uint8Array(buffer),out={};let p=0;
    while(p+30<=b.length){
      if(rd32(b,p)!==0x04034b50)break;
      const method=rd16(b,p+8),size=rd32(b,p+18),nl=rd16(b,p+26),xl=rd16(b,p+28);
      const name=dec.decode(b.slice(p+30,p+30+nl)),start=p+30+nl+xl,raw=b.slice(start,start+size);
      if(method!==0)throw new Error("XLSX no compatible para el control LIAN 179");
      out[name]=raw;p=start+size;
    }
    return out;
  }

  function sharedStrings(files){
    const b=files["xl/sharedStrings.xml"];if(!b)return [];
    const xml=dec.decode(b);
    return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join("").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'"));
  }

  function parseRows(xml,sst){
    const doc=new DOMParser().parseFromString(xml,"application/xml");
    const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    return [...doc.getElementsByTagNameNS(ns,"row")].map(row=>{
      const values={};
      for(const c of row.getElementsByTagNameNS(ns,"c")){
        const ref=c.getAttribute("r")||"",m=ref.match(/^([A-Z]+)(\d+)$/);if(!m)continue;
        let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;
        const type=c.getAttribute("t")||"",v=c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"";
        let value=v;
        if(type==="s")value=sst[Number(v)]??v;
        else if(type==="inlineStr")value=c.getElementsByTagNameNS(ns,"t")[0]?.textContent||"";
        values[n]=value;
      }
      return {row,values};
    });
  }

  function domTitulos(){
    const rows=[...document.querySelectorAll("#tablaPagos tbody tr")],out=[];
    rows.forEach((tr,i)=>{
      const tdj=String(tr.querySelector('[data-k="tdj"]')?.value||"").trim();
      if(!tdj)return;
      const fecha=String(tr.querySelector(".fecha-campo")?.value||tr.querySelector(".fecha-native")?.value||"").trim();
      const valor=num(tr.querySelector('[data-k="valor"]')?.value||"");
      const tipo=String(tr.querySelector('[data-k="tipo"]')?.value||"TASA DIAN").trim()||"TASA DIAN";
      const obs=String(tr.querySelector('[data-k="observacion"]')?.value||"").trim();
      out.push({orden:out.length+1,tdj,fecha,valor,tipo,obs,domIndex:i});
    });
    return out;
  }

  function rowText(r){return Object.values(r.values).join(" | ");}
  function setCell(row,colIndex,value,numeric){
    const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const doc=row.ownerDocument;
    let c=[...row.getElementsByTagNameNS(ns,"c")].find(x=>{const m=(x.getAttribute("r")||"").match(/^([A-Z]+)(\d+)$/);if(!m)return false;let n=0;for(const ch of m[1])n=n*26+ch.charCodeAt(0)-64;return n===colIndex;});
    if(!c){c=doc.createElementNS(ns,"c");c.setAttribute("r",`${col(colIndex)}${row.getAttribute("r")}`);row.appendChild(c);}
    while(c.firstChild)c.removeChild(c.firstChild);
    if(numeric){c.setAttribute("t","n");const v=doc.createElementNS(ns,"v");v.textContent=String(num(value));c.appendChild(v);}
    else{c.setAttribute("t","inlineStr");const is=doc.createElementNS(ns,"is"),t=doc.createElementNS(ns,"t");t.setAttribute("xml:space","preserve");t.textContent=String(value??"");is.appendChild(t);c.appendChild(is);}
  }

  function addRow(doc,sheetData,n,values,numericCols=[]){
    const ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main",row=doc.createElementNS(ns,"row");row.setAttribute("r",String(n));
    values.forEach((v,i)=>{const c=doc.createElementNS(ns,"c");c.setAttribute("r",`${col(i+1)}${n}`);if(numericCols.includes(i+1)){c.setAttribute("t","n");const el=doc.createElementNS(ns,"v");el.textContent=String(num(v));c.appendChild(el);}else{c.setAttribute("t","inlineStr");const is=doc.createElementNS(ns,"is"),t=doc.createElementNS(ns,"t");t.setAttribute("xml:space","preserve");t.textContent=String(v??"");is.appendChild(t);c.appendChild(is);}row.appendChild(c);});
    sheetData.appendChild(row);return row;
  }

  function patchPaymentSection(xml,titulos){
    const doc=new DOMParser().parseFromString(xml,"application/xml"),ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const sheetData=doc.getElementsByTagNameNS(ns,"sheetData")[0];if(!sheetData)return xml;
    const rows=[...sheetData.getElementsByTagNameNS(ns,"row")];
    let start=-1,header=-1;
    for(let i=0;i<rows.length;i++){
      const s=norm(rowText(parseRows(new XMLSerializer().serializeToString(rows[i]),[])[0]||{values:{}}));
      const vals=[...rows[i].getElementsByTagNameNS(ns,"c")].map(c=>c.getElementsByTagNameNS(ns,"t")[0]?.textContent||c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"");
      const joined=norm(vals.join(" | "));
      if(joined.includes("PAGOS Y APLICACIÓN")||joined.includes("PAGOS Y APLICACION")){start=i;break;}
    }
    if(start<0)return xml;
    for(let i=start+1;i<rows.length;i++){
      const vals=[...rows[i].getElementsByTagNameNS(ns,"c")].map(c=>c.getElementsByTagNameNS(ns,"t")[0]?.textContent||c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"");
      const joined=norm(vals.join(" | "));
      if(joined.includes("TDJ Nº")&&joined.includes("VALOR PAGO")){header=i;break;}
    }
    if(header<0)return xml;
    const dataRows=[];let end=rows.length;
    for(let i=header+1;i<rows.length;i++){
      const vals=[...rows[i].getElementsByTagNameNS(ns,"c")].map(c=>c.getElementsByTagNameNS(ns,"t")[0]?.textContent||c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"");
      if(!vals.some(v=>String(v).trim())){end=i;break;}
      if(norm(vals.join(" | ")).startsWith("DETALLE DE INTERESES")){end=i;break;}
      dataRows.push(rows[i]);
    }
    const byTdj=new Map(titulos.map(t=>[norm(t.tdj),t]));
    const found=new Set();
    for(const row of dataRows){
      const cells=[...row.getElementsByTagNameNS(ns,"c")];
      const valueOf=n=>{const c=cells.find(c=>{const m=(c.getAttribute("r")||"").match(/^([A-Z]+)(\d+)$/);if(!m)return false;let x=0;for(const ch of m[1])x=x*26+ch.charCodeAt(0)-64;return x===n;});return c?.getElementsByTagNameNS(ns,"t")[0]?.textContent||c?.getElementsByTagNameNS(ns,"v")[0]?.textContent||"";};
      const tdj=String(valueOf(2)).trim();
      const t=byTdj.get(norm(tdj));
      if(!t)continue;
      found.add(norm(t.tdj));
      // VALOR PAGO is the nominal captured value, never the value after the
      // priority/reconciliation layer. Applied values remain in columns 9-14.
      setCell(row,4,t.fecha,false);
      setCell(row,5,t.valor,true);
      setCell(row,6,t.tipo,false);
      setCell(row,8,t.obs,false);
    }
    const maxRow=Math.max(0,...rows.map(r=>Number(r.getAttribute("r")||0)));
    let next=maxRow+1;
    // Si una captura TDJ no llegó al detalle calculado, se incorpora igualmente
    // como registro original para que el Excel y su posterior importación sean 1:1.
    for(const t of titulos){
      if(found.has(norm(t.tdj)))continue;
      addRow(doc,sheetData,next++,[titulos.indexOf(t)+1,t.tdj,"",t.fecha,t.valor,t.tipo,"",t.obs,0,0,0,0,0,0],[1,5,9,10,11,12,13,14]);
    }
    return new XMLSerializer().serializeToString(doc);
  }

  function replaceCanonicalSection(xml,titulos){
    const doc=new DOMParser().parseFromString(xml,"application/xml"),ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    const sheetData=doc.getElementsByTagNameNS(ns,"sheetData")[0];if(!sheetData)return xml;
    const rows=[...sheetData.getElementsByTagNameNS(ns,"row")];
    let start=-1,end=-1;
    for(let i=0;i<rows.length;i++){
      const vals=[...rows[i].getElementsByTagNameNS(ns,"c")].map(c=>c.getElementsByTagNameNS(ns,"t")[0]?.textContent||c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"");
      const s=norm(vals.join(" | "));
      if(s.includes("TÍTULOS / TDJ — TÍTULOS REGISTRADOS")||s.includes("TITULOS / TDJ - TITULOS REGISTRADOS")){start=i;break;}
    }
    if(start<0)return xml;
    for(let i=start+1;i<rows.length;i++){
      const vals=[...rows[i].getElementsByTagNameNS(ns,"c")].map(c=>c.getElementsByTagNameNS(ns,"t")[0]?.textContent||c.getElementsByTagNameNS(ns,"v")[0]?.textContent||"");
      const s=norm(vals.join(" | "));
      if(!s||s.includes("RECUPERACIÓN COMPLETA")||s.includes("RECUPERACION COMPLETA")){end=i;break;}
    }
    if(end<0)end=start+1;
    const old=rows.slice(start,end);old.forEach(r=>r.remove());
    const current=[...sheetData.getElementsByTagNameNS(ns,"row")];let next=Math.max(0,...current.map(r=>Number(r.getAttribute("r")||0)))+1;
    addRow(doc,sheetData,next++,["TÍTULOS / TDJ — TÍTULOS REGISTRADOS"]);
    addRow(doc,sheetData,next++,["Nº","TDJ","FECHA","VALOR ORIGINAL","TIPO","OBSERVACIÓN"]);
    titulos.forEach((t,i)=>addRow(doc,sheetData,next++,[i+1,t.tdj,t.fecha,t.valor,t.tipo,t.obs],[1,4]));
    addRow(doc,sheetData,next++,["TOTAL TÍTULOS",titulos.length,"",titulos.reduce((a,t)=>a+Math.max(0,t.valor),0),"",""] ,[2,4]);
    return new XMLSerializer().serializeToString(doc);
  }

  function patch(buffer){
    const files=unzip(buffer),sheet=files["xl/worksheets/sheet1.xml"];
    if(!sheet)return null;
    const titulos=domTitulos();
    if(!titulos.length)return null;
    const xml=dec.decode(sheet);
    const p1=patchPaymentSection(xml,titulos);
    const p2=replaceCanonicalSection(p1,titulos);
    files["xl/worksheets/sheet1.xml"]=enc.encode(p2);
    return rebuild(files);
  }

  function rebuild(files){
    const chunks=[],central=[];let offset=0;
    for(const [name,data] of Object.entries(files)){
      const nb=enc.encode(name),crc=crc32(data),h=new Uint8Array(30+nb.length+data.length);let p=0;
      h.set([80,75,3,4],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(crc),p);p+=4;h.set(u32(data.length),p);p+=4;h.set(u32(data.length),p);p+=4;h.set(u16(nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(nb,p);p+=nb.length;h.set(data,p);chunks.push(h);central.push({nb,crc,size:data.length,offset});offset+=h.length;
    }
    const cd=central.map(f=>{const h=new Uint8Array(46+f.nb.length);let p=0;h.set([80,75,1,2],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(f.crc),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u16(f.nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(0),p);p+=4;h.set(u32(f.offset),p);p+=4;h.set(f.nb,p);return h;});
    const cdSize=cd.reduce((a,x)=>a+x.length,0),end=new Uint8Array(22);let p=0;end.set([80,75,5,6],p);p+=4;end.set(u16(0),p);p+=2;end.set(u16(0),p);p+=2;end.set(u16(Object.keys(files).length),p);p+=2;end.set(u16(Object.keys(files).length),p);p+=2;end.set(u32(cdSize),p);p+=4;end.set(u32(offset),p);p+=4;end.set(u16(0),p);
    const out=new Uint8Array(offset+cdSize+22);let q=0;for(const x of [...chunks,...cd,end]){out.set(x,q);q+=x.length;}return new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  const originalCreate=URL.createObjectURL.bind(URL),originalRevoke=URL.revokeObjectURL.bind(URL),blobs=new Map();
  URL.createObjectURL=function(blob){const u=originalCreate(blob);blobs.set(u,blob);return u;};
  URL.revokeObjectURL=function(u){blobs.delete(u);return originalRevoke(u);};
  const originalClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    const a=this,url=a.href||"";
    if(!a.download||!/\.xlsx$/i.test(a.download)||!blobs.has(url)||document.getElementById("tablaTitulos"))return originalClick.call(a);
    const blob=blobs.get(url);
    void blob.arrayBuffer().then(buffer=>{
      try{
        const fixed=patch(buffer);
        if(!fixed)return originalClick.call(a);
        const nu=originalCreate(fixed);a.href=nu;originalClick.call(a);setTimeout(()=>originalRevoke(nu),3000);
      }catch(e){console.warn("Control Excel LIAN 179:",e);originalClick.call(a);}
    }).catch(()=>originalClick.call(a));
  };
})();
