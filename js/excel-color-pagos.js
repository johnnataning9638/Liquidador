// Formato exclusivo del bloque de pagos. Conserva valores y formatos numéricos.
export function aplicarVerdePagosExcel(files){
 const sheetFile=files.find(f=>f.name==='xl/worksheets/sheet1.xml');
 const styleFile=files.find(f=>f.name==='xl/styles.xml');
 if(!sheetFile||!styleFile)return files;
 const parser=new DOMParser(),sheet=parser.parseFromString(sheetFile.data,'application/xml'),styles=parser.parseFromString(styleFile.data,'application/xml');
 if(sheet.querySelector('parsererror')||styles.querySelector('parsererror'))throw Error('No fue posible aplicar el formato de pagos al Excel.');
 const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const elements=(node,tag)=>[...node.getElementsByTagNameNS(ns,tag)];
 const rows=elements(sheet,'row'),selected=[];let active=false;
 for(const [i,row] of rows.entries()){
  const cells=elements(row,'c'),label=cells[0]?.textContent||'';
  const title=cells.some(c=>c.getAttribute('s')==='1');
  if(title)active=label==='PAGOS Y APLICACIÓN'||(label==='PAGOS REGISTRADOS — LIQUIDACIÓN NORMAL'&&(rows[i+1]?.textContent||'').includes('TOTAL APLICADO'));
  if(!cells.length)active=false;
  if(active)selected.push(...cells);
 }
 if(!selected.length)return files;
 const fonts=elements(styles,'fonts')[0],fills=elements(styles,'fills')[0],borders=elements(styles,'borders')[0],xfs=elements(styles,'cellXfs')[0];
 const append=(parent,node)=>{const id=parent.children.length;parent.appendChild(node);parent.setAttribute('count',parent.children.length);return id;};
 const colorFont=source=>{const font=fonts.children[source].cloneNode(true);for(const old of elements(font,'color'))old.remove();const color=styles.createElementNS(ns,'color');color.setAttribute('rgb','FF173F2B');font.appendChild(color);return append(fonts,font);};
 const fillIds=['A9D6B4','D9EEDD','F3FAF4'].map(rgb=>{
  const fill=styles.createElementNS(ns,'fill'),pattern=styles.createElementNS(ns,'patternFill'),color=styles.createElementNS(ns,'fgColor');
  pattern.setAttribute('patternType','solid');color.setAttribute('rgb','FF'+rgb);pattern.appendChild(color);fill.appendChild(pattern);return append(fills,fill);
 });
 const border=borders.children[1].cloneNode(true);for(const color of elements(border,'color'))color.setAttribute('rgb','FFA8C6AE');const borderId=append(borders,border);
 const titleFont=colorFont(1),headerFont=colorFont(2),mapping=new Map();
 for(const [id,source] of [...xfs.children].entries()){
  const clone=source.cloneNode(true);clone.setAttribute('fillId',fillIds[id===1?0:id===2?1:2]);clone.setAttribute('borderId',borderId);clone.setAttribute('applyFill','1');clone.setAttribute('applyBorder','1');
  if(id===1||id===2){clone.setAttribute('fontId',id===1?titleFont:headerFont);clone.setAttribute('applyFont','1');}
  mapping.set(id,append(xfs,clone));
 }
 for(const cell of selected)cell.setAttribute('s',mapping.get(Number(cell.getAttribute('s')||0)));
 const serializer=new XMLSerializer();
 return files.map(f=>f===sheetFile?{...f,data:serializer.serializeToString(sheet)}:f===styleFile?{...f,data:serializer.serializeToString(styles)}:f);
}
