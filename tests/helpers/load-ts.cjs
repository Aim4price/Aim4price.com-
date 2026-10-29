const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
module.exports=function loadTs(file, overrides={}) {
 const cache={};
 function load(filename){
  if(cache[filename])return cache[filename].exports;
  const module={exports:{}};cache[filename]=module;
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','exports','module',code)(name=>Object.hasOwn(overrides,name)?overrides[name]:name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts')):require(name),module.exports,module);
  return module.exports;
 }
 return load(path.resolve(file));
};
