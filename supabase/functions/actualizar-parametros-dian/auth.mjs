export async function tokenProgramadorValido(token,expected){
 if(typeof token!=='string'||token.length<32||token.length>256||!/^[a-f0-9]{64}$/.test(expected||''))return false;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 let diff=0;for(let i=0;i<64;i++)diff|=hash.charCodeAt(i)^expected.charCodeAt(i);return diff===0;
}
