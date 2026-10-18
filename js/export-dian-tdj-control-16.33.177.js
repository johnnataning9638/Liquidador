// DIAN Excel v16.33.177 — CONTROL FINAL TDJ.
// Capa exclusiva de exportación. No modifica motores, fórmulas ni resultados.
// Lee el XLSX ya generado por app.js: títulos originales desde el bloque
// canónico y aplicación desde PAGOS Y APLICACIÓN. Así evita depender del DOM
// después de la liquidación y conserva el valor nominal completo.
(function(){
  "use strict";
  if(window.__dianExcelTdjControl177)return;
  window.__dianExcelTdjControl177=true;

  const enc=new TextEncoder(),dec=new TextDecoder();
  const u16=v=>new Uint8Array([v&255,(v>>>8)&255]);
  const u32=v=>new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
  const rd16=(a,p)=>a[p]|(a[p+1]<<8);
  const rd32=(a,p)=>(a[p]|(a[p+1]<<8)|(a[p+2]<<16)|(a[p+3]<<24))>>>0;
  const norm=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[–—−]/g,"-").replace(/\s+/g," ").trim().toUpperCase();
  const num=v=>{const s=String(v??"").trim();if(!s)return 0;const n=Number(s.replace(/[^0-9.-]/g,""));return Number.isFinite(n)?Math.trunc(n):0;};
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/'/g,"&apos;");
  const col=n=>{let s="";while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};

  function crc32(bytes){let t=crc32.t;if(!t){t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}crc32.t=t;}let c=0xffffffff;for(const b of bytes)c=t[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}

  function unzipStored(buffer){
    const b=new Uint8Array(buffer),out={};let p=0;
    while(p+30<=b.length){
      if(rd32(b,p)!==0x04034b50)break;
      const method=rd16(b,p+8),size=rd32(b,p+18),nl=rd16(b,p+26),xl=rd16(b,p+28),name=dec.decode(b.slice(p+30,p+30+nl));
      if(method!==0)throw new Error("XLSX comprimido no compatible en control 177");
      const start=p+30+nl+xl;out[name]=b.slice(start,start+size);p=start+size;
    }
    return out;
  }

  function parseXmlRows(xml){
    const rows=[];
    for(const rm of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
      const values={};
      for(const cm of rm[2].matchAll(/<c\b[^>]*r="([A-Z]+)(\d+)"[^>]*?(?:t="([^"]+)")?[^>]*>([\s\S]*?)<\/c>/g)){
        let n=0;for(const ch of cm[1])n=n*26+ch.charCodeAt(0)-64;
        const body=cm[4],type=cm[3]||"";
        let v="";
        if(type==="inlineStr")v=(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1]||"";
        else v=(body.match(/<v[^>]*>([\s\S]*?)<\/v>/)||[])[1]||"";
        values[n]=v.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
      }
      rows.push({n:Number(rm[1]),values});
    }
    return rows;
  }
  const rowText=r=>Object.values(r.values).join(" | ");

  function titlesAndApplied(xml){
    const rows=parseXmlRows(xml);let titles=[];let paymentHeader=-1,payCols=null;
    for(let i=0;i<rows.length;i++){
      const vals=rows[i].values,all=Object.values(vals).map(norm);
      if(all.some(x=>x.includes("TÍTULOS / TDJ")&&x.includes("REGISTRADOS"))){
        const h=rows[i+1]?.values||{};const keys=Object.keys(h);
        const tdj=keys.find(k=>norm(h[k])==="TDJ");const fecha=keys.find(k=>norm(h[k])==="FECHA");const valor=keys.find(k=>norm(h[k])==="VALOR");const tipo=keys.find(k=>norm(h[k])==="TIPO");const tasa=keys.find(k=>norm(h[k])==="TASA");const obs=keys.find(k=>norm(h[k]).includes("OBSERVACIÓN"));
        if(tdj&&fecha&&valor){
          for(let j=i+2;j<rows.length;j++){
            const r=rows[j].values,s=norm(rowText(rows[j]));
            if(!String(r[tdj]??"").trim()||s.startsWith("FIN RECUPERACIÓN")||s.startsWith("TÍTULOS TDJ")||s.startsWith("PAGOS"))break;
            const nominal=num(r[valor]);if(nominal<0)continue;
            titles.push({tdj:String(r[tdj]??"").trim(),fecha:String(r[fecha]??"").trim(),nominal,tipo:String(r[tipo]??"TASA DIAN").trim()||"TASA DIAN",tasa:String(r[tasa]??"").trim(),obs:String(r[obs]??"").trim()});
          }
        }
      }
      if(all.includes("PAGOS Y APLICACIÓN")){
        const h=rows[i+1]?.values||{};const keys=Object.keys(h);const tdj=keys.find(k=>norm(h[k])==="TDJ Nº");const valor=keys.find(k=>norm(h[k])==="VALOR PAGO");
        if(tdj&&valor){paymentHeader=i+1;payCols={tdj,valor};}
      }
    }
    const applied=new Map();
    if(paymentHeader>=0&&payCols){
      for(let i=paymentHeader+1;i<rows.length;i++){
        const r=rows[i].values,tdj=String(r[payCols.tdj]??"").trim();
        if(!tdj)continue;
        applied.set(norm(tdj),(applied.get(norm(tdj))||0)+Math.max(0,num(r[payCols.valor])));
      }
    }
    return titles.map(t=>({...t,aplicado:Math.min(t.nominal,applied.get(norm(t.tdj))||0)}));
  }

  function cell(ref,value,number=false){return number?`<c r="${ref}" t="n"><v>${num(value)}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;}
  function addControl(xml,titulos){
    if(!titulos.length)return xml;
    const m=[...xml.matchAll(/<row\b[^>]*r="(\d+)"/g)];let n=Math.max(0,...m.map(x=>Number(x[1])))+2;
    const rows=[];
    rows.push(`<row r="${n}">${cell(`A${n}`,"TÍTULOS / TDJ — CONTROL FINAL")}</row>`);n++;
    const headers=["Nº","TDJ","FECHA","VALOR ORIGINAL","TIPO","TASA","OBSERVACIÓN","APLICADO","SOBRANTE / ENDOSO","DESTINO"];
    rows.push(`<row r="${n}">${headers.map((v,i)=>cell(`${col(i+1)}${n}`,v)).join("")}</row>`);n++;
    let totalOriginal=0,totalAplicado=0,totalEndoso=0;
    titulos.forEach((t,i)=>{const end=Math.max(0,t.nominal-t.aplicado);totalOriginal+=t.nominal;totalAplicado+=t.aplicado;totalEndoso+=end;const vals=[i+1,t.tdj,t.fecha,t.nominal,t.tipo,t.tasa,t.obs,t.aplicado,end,end>0?"ENDOSO":"APLICADO"];rows.push(`<row r="${n}">${vals.map((v,j)=>cell(`${col(j+1)}${n}`,v,[0,3,7,8].includes(j))).join("")}</row>`);n++;});
    const tot=["TOTAL","","",totalOriginal,"","","",totalAplicado,totalEndoso,totalEndoso>0?"ENDOSO":"SIN SOBRANTE"];
    rows.push(`<row r="${n}">${tot.map((v,j)=>cell(`${col(j+1)}${n}`,v,[3,7,8].includes(j))).join("")}</row>`);
    const insert=rows.join("");
    let out=xml.replace(/<\/sheetData>/,insert+"</sheetData>");
    out=out.replace(/(<dimension\b[^>]*ref=")[^"]+("[^>]*>)/,`$1A1:${col(10)}${n}$2`);
    return out;
  }

  function rebuild(files,xml){
    const updated={...files,"xl/worksheets/sheet1.xml":enc.encode(xml)};const chunks=[],central=[];let offset=0;
    for(const [name,data] of Object.entries(updated)){const nb=enc.encode(name),crc=crc32(data),h=new Uint8Array(30+nb.length+data.length);let p=0;h.set([80,75,3,4],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(crc),p);p+=4;h.set(u32(data.length),p);p+=4;h.set(u32(data.length),p);p+=4;h.set(u16(nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(nb,p);p+=nb.length;h.set(data,p);chunks.push(h);central.push({nb,crc,size:data.length,offset});offset+=h.length;}
    const cds=central.map(f=>{const h=new Uint8Array(46+f.nb.length);let p=0;h.set([80,75,1,2],p);p+=4;h.set(u16(20),p);p+=2;h.set(u16(20),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(f.crc),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u32(f.size),p);p+=4;h.set(u16(f.nb.length),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u16(0),p);p+=2;h.set(u32(0),p);p+=4;h.set(u32(f.offset),p);p+=4;h.set(f.nb,p);return h;});
    const cdSize=cds.reduce((s,x)=>s+x.length,0),end=new Uint8Array(22);let p=0;end.set([80,75,5,6],p);p+=4;end.set(u16(0),p);p+=2;end.set(u16(0),p);p+=2;end.set(u16(central.length),p);p+=2;end.set(u16(central.length),p);p+=2;end.set(u32(cdSize),p);p+=4;end.set(u32(offset),p);p+=4;end.set(u16(0),p);
    const out=new Uint8Array(offset+cdSize+22);let q=0;for(const x of [...chunks,...cds,end]){out.set(x,q);q+=x.length;}return new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  }

  const make=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),blobs=new Map();
  URL.createObjectURL=function(blob){const u=make(blob);blobs.set(u,blob);return u};
  URL.revokeObjectURL=function(u){blobs.delete(u);return revoke(u)};
  const originalClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){const a=this,url=a.href||"";if(!a.download||!/\.xlsx$/i.test(a.download)||!blobs.has(url))return originalClick.call(a);void blobs.get(url).arrayBuffer().then(buffer=>{const files=unzipStored(buffer),xml=dec.decode(files["xl/worksheets/sheet1.xml"]||new Uint8Array());const titulos=titlesAndApplied(xml);if(!titulos.length)return originalClick.call(a);const nuevo=rebuild(files,addControl(xml,titulos)),nu=make(nuevo);a.href=nu;originalClick.call(a);setTimeout(()=>revoke(nu),2000);a.href=url}).catch(()=>originalClick.call(a));};
})();
