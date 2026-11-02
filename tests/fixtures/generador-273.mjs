// Generador sintético sin datos personales. Columnas del formulario oficial 1116.
export function generadorPDF({soloSancion=false,mixto=false}={}){
 const common=[[87.5,616.4,6,'18. Numero de identificacion'],[239.5,616.4,6,'6.DV'],[87.5,602.5,8,'900123456'],[42.5,591.4,6,'11. Razon social'],[42,580.5,8,'PRUEBA S.A.S.'],[27.5,555.4,6,'24. Concepto'],[191.2,556.4,6,'Cod.'],[220.5,558.5,6,'25. Ano'],[259.5,555.4,6,'26. Periodo'],[298.5,555.4,6,'27.'],[470.5,555.4,6,'29. Obligacion'],[27,545.5,7,'RENTA'],[196.2,545.5,8,'1001'],[235.2,544.5,8,'2024'],[287.6,544.5,8,'1'],[523.3,544.5,8,'100100000000001'],[455.6,710.5,8,'111600000000001'],[40,690,12,'Documento generador de cuotas']];
 const headers=[[27.5,555.9,6,'30. Documento fuente'],[176.5,555.9,6,'31. Repeticion'],[112.2,544.5,8,'2100000000001'],[47,519.9,6,'34. Codigo'],[95.1,519.9,6,'35. Concepto'],[200.3,522.5,6,'36. Cuota'],[234.5,522.5,6,'37. Naturaleza'],[283.2,519.9,6,'38. Vencimiento'],[382.7,519.9,6,'39. Valor pesos'],[490.7,519.9,6,'40. Valor UVT']];
 const fila=(y,c,n,fecha,valor)=>[[73.7,y,8,c],[93,y,8,c==='300'?'SANCION':'IMPUESTO'],[220.6,y,8,String(n)],[231,y,8,'Debito'],[280.4,y-1,8,fecha],[442.1,y,8,valor]];
 const rows=soloSancion?fila(508.5,'300',1,'20260930','524,000'):[...fila(508.5,'100',1,'20250919','200,000'),...fila(496.5,'100',2,'20251019','300,000'),...(mixto?fila(484.5,'300',1,'20250918','524,000'):[])];
 const pages=[common,[...common.filter(i=>i[1]>570),...headers,...rows]];
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>'];
 for(let i=0;i<2;i++){
  const stream=pages[i].map(([x,y,size,text])=>`BT /F1 ${size} Tf ${x} ${y} Td (${text.replace(/[()\\]/g,'\\$&')}) Tj ET`).join('\n');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents ${i?6:4} 0 R >>`,`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
 }
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}
 const start=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
 return Buffer.from(pdf);
}
