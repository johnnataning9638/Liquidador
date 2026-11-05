// PDF.js usa este método al leer destinos internos de algunos PDF de Chromium.
if(typeof Map.prototype.getOrInsert!=='function'){
  Object.defineProperty(Map.prototype,'getOrInsert',{
    configurable:true,writable:true,
    value:function(clave,valor){
      if(!this.has(clave))this.set(clave,valor);
      return this.get(clave);
    }
  });
}
export const {WorkerMessageHandler}=await import('../../vendor/pdfjs/pdf.worker.mjs');
