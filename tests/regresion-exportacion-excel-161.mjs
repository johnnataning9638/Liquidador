import fs from 'node:fs';
for(const [name,s] of [['DIAN',fs.readFileSync('js/app.js','utf8')],['TDJ',fs.readFileSync('js/tdj-core-16.33.143.js','utf8')]]){
  if(!s.includes('valueCols=new Set')) throw new Error(name+' sin valueCols');
  if(!s.includes('const excelWidths=')) throw new Error(name+' sin excelWidths');
  if(!s.includes('Math.min(60')) throw new Error(name+' sin altura adaptativa');
  if(!s.includes('customHeight="1"')) throw new Error(name+' sin customHeight');
  if(!s.includes('16.33.161')) throw new Error(name+' sin version 161');
}
console.log('REGRESION EXCEL 16.33.161 OK — solo presentación XLSX');
