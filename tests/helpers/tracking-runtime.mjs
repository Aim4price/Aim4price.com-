import {readFileSync} from 'node:fs';
import ts from 'typescript';
export function trackingRuntimeModule(name, databaseGlobal) {
  let source=readFileSync(new URL(`../../lib/${name}.ts`,import.meta.url),'utf8');
  source=source.replace(/import\s*\{\s*getDb\s*\}\s*from\s*['"]\.\/db['"];?/,`const getDb=()=>globalThis.${databaseGlobal};`);
  let compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  compiled=compiled.replace(/from ["']\.\/([^"']+)["']/g,(_,dependency)=>`from ${JSON.stringify(trackingRuntimeModule(dependency,databaseGlobal))}`);
  return 'data:text/javascript;base64,'+Buffer.from(compiled).toString('base64');
}
