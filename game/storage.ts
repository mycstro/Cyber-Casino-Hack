export function readStorage(key:string):string|null {try{return localStorage.getItem(key);}catch{return null;}}
export function writeStorage(key:string,value:unknown) {try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
