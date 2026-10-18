// DIAN Excel v16.33.174 — CONTROL CANÓNICO DE TDJ.
// No toca motores ni resultados. Intercepta únicamente el XLSX ya generado
// por app.js y agrega un bloque de recuperación con TODOS los TDJ originales,
// separando valor nominal, aplicado, endoso y destino. Mantiene una sola hoja
// y la estructura que el importador DIAN ya reconoce.
(function(){
  "use strict";
  if(window.__dianExcelTdjRecovery174)return;
  window.__dianExcelTdjRecovery174=true;

  const originalCreateObjectURL=URL.createObjectURL.bind(URL);
  const originalRevokeObjectURL=URL.revokeObjectURL.bind(URL);
  const blobs=new Map();
  URL.createObjectURL=function(blob){const u=originalCreateObjectURL(blob);blobs.set(u,blob);return u;};
  URL.revokeObjectURL=function(u){blobs.delete(u);return originalRevokeObjectURL(u);};

  const enc=new TextEncoder(),dec=new TextDecoder();
  const u16=v=>new Uint8Array([v&255,(v>>>8)&255]);
  const u32=v=>new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
  const rd16=(a,p)=>a[p]|(a[p+1]<<8);
  const rd32=(a,p)=>(a[p]|(a[p+1]<<8)|(a[p+2]<<16)|(a[p+3]<<24))>>>0;
  const xmlEsc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  const col=n=>{let s="";while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};
  const num=v=>{const s=String(v??"").trim();if(!s)return 0;const n=Number(s.replace(/[^0-9.-]/g,""));return Number.isFinite(n)?Math.trunc(n):0;};
  const fecha=v=>{const s=String(v??"").trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!m)return s;let y=m[3];if(y.length===2)y=Number(y)>=70?`19${y}`:`20${y}`;return `${y}-${String(m[2]).padStart(2,"0")}-${String(m[1]).padStart(2,"0")}`;};

  function capturaTitulos(){
    return [...document.querySelectorAll('#tablaPagos tbody tr')].map((tr,i)=>{
      const tdj=String(tr.querySelector('[data-k="tdj"]')?.value||"").trim();
      const f=fecha(tr.querySelector('.fecha-campo')?.value||tr.querySelector('.fecha-native')?.value||"");
      const valor=num(tr.querySelector('[data-k="valor"]')?.value||"");
      const tipo=String(tr.querySelector('[data-k="tipo"]')?.value||"TASA DIAN").trim().toUpperCase()||"TASA DIAN";
      const obs=String(tr.querySelector('[data-k="observacion"]')?.value||"").trim().toUpperCase();
      return {orden:i+1,tdj,fecha:f,nominal:valor,tipo,obs};
    }).filter(x=>x.tdj&&x.fecha&&x.nominal>=0);
  }

  function localName(node){return String(node?.localName||node?.nodeName||"").replace(/^.*:/,"");}
  function cellValue(c){
    const inline=c.querySelector?.("is t");
    if(inline)return inline.textContent||"";
    const v=c.querySelector?.("v");
    return v?.textContent||"";
  }
  function parseSheet(xml){
    const parser=new DOMParser();
    const doc=parser.parseFromString(xml,"application/xml");
    const sheet=doc.documentElement;
    const rows=[...sheet.querySelectorAll("row")].map(row=>{
      const out={};
      for(const c of row.querySelectorAll("c")){
        const ref=c.getAttribute("r")||"";
        const m=ref.match(/^([A-Z]+)\d+$/);if(!m)continue;
        let n=0;for(const ch of m[1])n=n*26+(ch.charCodeAt(0)-64);
        out[n]=cellValue(c);
      }
      return {row,values:out};
    });
    return {doc,sheet,rows};
  }
  function normal(s){return String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[–—]/g,"-").replace(/\s+/g," ").trim();}
  function extraerAplicados(xml,titulos){
    const {rows}=parseSheet(xml);
    let header=null;
    for(let i=0;i<rows.length;i++){
      const s=normal(Object.values(rows[i].values).join(" | "));
      if(s.includes("Nº")||s.includes("NO")){/* continue */}
      const vals=Object.values(rows[i].values).map(normal);
      if(vals.includes("TDJ Nº")&&vals.includes("TOTAL APLICADO")){header={i,values:rows[i].values};break;}
    }
    if(!header)return titulos.map(t=>({...t,aplicado:0}));
    const idx=header.values;
    const tdjCol=Object.keys(idx).find(k=>normal(idx[k])==="TDJ Nº");
    const appCol=Object.keys(idx).find(k=>normal(idx[k])==="TOTAL APLICADO");
    if(!tdjCol||!appCol)return titulos.map(t=>({...t,aplicado:0}));
    const map=new Map();
    for(let i=header.i+1;i<rows.length;i++){
      const r=rows[i].values,s=normal(Object.values(r).join(" | "));
      if(!s)continue;
      const tdj=String(r[tdjCol]??"").trim();
      if(!tdj)continue;
      const applied=num(r[appCol]);
      map.set(normal(tdj),applied);
    }
    return titulos.map(t=>({...t,aplicado:Math.max(0,map.get(normal(t.tdj))||0)}));
  }

  function rowXml(rowNumber,values,styles={}){
    return `<row r="${rowNumber}" ht="20" customHeight="1">${values.map((v,i)=>{
      const c=i+1,ref=col(c)+rowNumber,style=styles[i+1]??0;
      if(typeof v==="number"&&Number.isFinite(v))return `<c r="${ref}" s="${style}" t="n"><v>${String(v)}</v></c>`;
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
    }).join("")}</row>`;
  }

  function addSection(xml,titulos){
    if(!titulos.length)return xml;
    const parsed=parseSheet(xml),sheet=parsed.sheet;
    const sheetData=sheet.querySelector("sheetData");
    if(!sheetData)return xml;
    let maxRow=0;
    for(const r of parsed.rows)maxRow=Math.max(maxRow,Number(r.row.getAttribute("r")||0));
    let n=maxRow+2;
    const rows=[];
    rows.push(rowXml(n,["TÍTULOS / TDJ — TÍTULOS REGISTRADOS","","","","","","",""],{1:1}));n++;
    rows.push(rowXml(n,["Nº","TDJ","FECHA","VALOR ORIGINAL","APLICADO","ENDOSO","DESTINO","TIPO","OBSERVACIÓN"],{1:2,2:2,3:2,4:2,5:2,6:2,7:2,8:2,9:2}));n++;
    let totalOriginal=0,totalAplicado=0,totalEndoso=0;
    for(const t of titulos){
      const aplicado=Math.min(Math.max(0,t.nominal),Math.max(0,t.aplicado));
      const endoso=Math.max(0,t.nominal-aplicado);
      const destino=endoso>0?"DISPONIBLE PARA SIGUIENTE OBLIGACIÓN / ENDOSO":"APLICADO A OBLIGACIÓN 1";
      totalOriginal+=t.nominal;totalAplicado+=aplicado;totalEndoso+=endoso;
      rows.push(rowXml(n,[t.orden,t.tdj,t.fecha,t.nominal,aplicado,endoso,destino,t.tipo,t.obs],{1:0,4:3,5:3,6:3}));n++;
    }
    rows.push(rowXml(n,["TOTAL TÍTULOS","","",totalOriginal,totalAplicado,totalEndoso,"","",""] ,{1:1,4:3,5:3,6:3}));n++;
    const frag=sheet.ownerDocument.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","tbody");
    // Importante: no se agregan nodos nuevos fuera de sheetData; se conserva
    // exactamente el esquema OOXML del libro generado por app.js.
    const holder=sheet.ownerDocument.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","sheetData");
    for(const text of rows){const d=sheet.ownerDocument.createElementNS("http://schemas.openxmlformats.org/spreadsheetml/2006/main","row-holder");d.innerHTML=text;const r=d.firstElementChild;holder.appendChild(r);}
    while(holder.firstChild)sheetData.appendChild(holder.firstChild);
    const dim=sheet.querySelector("dimension");if(dim)dim.setAttribute("ref",`A1:${col(14)}${n}`);
    return new XMLSerializer().serializeToString(parsed.doc);
  }

  function crc32(bytes){let table=crc32.t;if(!table){table=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}crc32.t=table;}let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
  function rebuildZip(buffer,xml){
    const bytes=new Uint8Array(buffer),nameNeed="xl/worksheets/sheet1.xml",xmlBytes=enc.encode(xml);let pos=0,files=[];
    while(pos+30<=bytes.length){
      if(rd32(bytes,pos)!==0x04034b50)break;
      const nameLen=rd16(bytes,pos+26),extraLen=rd16(bytes,pos+28),size=rd32(bytes,pos+18),name=dec.decode(bytes.slice(pos+30,pos+30+nameLen));
      const dataStart=pos+30+nameLen+extraLen;let data=bytes.slice(dataStart,dataStart+size);
      if(name===nameNeed)data=xmlBytes;
      files.push({name,data});pos=dataStart+size;
    }
    if(!files.length)return new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const chunks=[],central=[];let offset=0;
    for(const f of files){const nb=enc.encode(f.name),crc=crc32(f.data),h=new Uint8Array(30+nb.length+f.data.length);let p=0;h.set([80,75,3,4],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(crc),p);p+=4;h.set(u32(f.data.length),p);p+=4;h.set(u32(f.data.length),p);p+=4;h.set(u16(nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(nb,p);p+=nb.length;h.set(f.data,p);chunks.push(h);central.push({name:nb,crc,size:f.data.length,offset});offset+=h.length;}
    const cd=central.map(f=>{const h=new Uint8Array(46+f.name.length);let p=0;h.set([80,75,1,2],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(f.crc),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u16(f.name.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(0),p);p+=4;h.set(u32(f.offset),p);p+=4;h.set(f.name,p);return h;});
    const cdSize=cd.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22);let p=0;end.set([80,75,5,6],p);p+=4;end.set(u16(0),p);p+=2;end.set(u16(0),p);p+=2;end.set(u16(files.length),p);p+=2;end.set(u16(files.length),p);p+=2;end.set(u32(cdSize),p);p+=4;end.set(u32(offset),p);p+=4;end.set(u16(0),p);
    const out=new Uint8Array(offset+cdSize+22),parts=[...chunks,...cd,end];let q=0;for(const x of parts){out.set(x,q);q+=x.length;}return new Blob([out.buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  async function patchBlob(blob){
    const buffer=await blob.arrayBuffer();const bytes=new Uint8Array(buffer);let pos=0,xml="";
    while(pos+30<=bytes.length){if(rd32(bytes,pos)!==0x04034b50)break;const nameLen=rd16(bytes,pos+26),extraLen=rd16(bytes,pos+28),size=rd32(bytes,pos+18),name=dec.decode(bytes.slice(pos+30,pos+30+nameLen));const start=pos+30+nameLen+extraLen;if(name==="xl/worksheets/sheet1.xml"){xml=dec.decode(bytes.slice(start,start+size));break;}pos=start+size;}
    if(!xml)return blob;
    const titulos=capturaTitulos();if(!titulos.length)return blob;
    const conAplicados=extraerAplicados(xml,titulos);const nuevoXml=addSection(xml,conAplicados);return rebuildZip(buffer,nuevoXml);
  }

  const anchorClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    const a=this,url=this.href||"";
    if(!a.download||!/\.xlsx$/i.test(a.download)||!url.startsWith("blob:")||!blobs.has(url))return anchorClick.call(this);
    const originalHref=url;
    void patchBlob(blobs.get(url)).then(blob=>{
      const nuevo=originalCreateObjectURL(blob);a.href=nuevo;anchorClick.call(a);setTimeout(()=>originalRevokeObjectURL(nuevo),1500);a.href=originalHref;
    }).catch(()=>anchorClick.call(a));
  };
})();
