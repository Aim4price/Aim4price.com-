import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function files(directory) {
  return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(directory,entry.name);
    return entry.isDirectory()?files(file):file.endsWith('.tsx')?[file]:[];
  });
}
const sources=files('app').concat(files('components')).map(file=>ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX));
function walk(node,visit) {visit(node);ts.forEachChild(node,child=>walk(child,visit));}
function props(open) {return new Map(open.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(),a.initializer?.getText()||'']));}

test('every declared dialog supplies the standard exit directly or through its shared close component',()=>{
  const missing=[];
  for(const source of sources)walk(source,node=>{
    if(!ts.isJsxElement(node))return;
    const open=node.openingElement,attributes=props(open);
    if(open.tagName.getText()!=='dialog'&&!['"dialog"','"alertdialog"'].includes(attributes.get('role')))return;
    if(!/data-modal-close|ShareModalCloseButton|LeadActionDialog/.test(node.getText()))missing.push(`${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1}`);
  });
  assert.deepEqual(missing,[],'Add the standard close control to new dialogs');
});

test('standard exits have an accessible name and never target backdrop or removal controls',()=>{
  const invalid=[];
  for(const source of sources)walk(source,node=>{
    const open=ts.isJsxElement(node)?node.openingElement:ts.isJsxSelfClosingElement(node)?node:null;
    if(!open)return;
    const attributes=props(open);
    if(!attributes.has('data-modal-close'))return;
    if(open.tagName.getText()!=='button'||!attributes.has('aria-label')||/backdrop|scrim|removeButton|deleteButton/i.test(attributes.get('className')||''))invalid.push(`${source.fileName}:${source.getLineAndCharacterOfPosition(node.getStart()).line+1}`);
  });
  assert.deepEqual(invalid,[]);
});

test('the root layout loads the standard for all app routes',()=>{
  assert.match(fs.readFileSync('app/layout.tsx','utf8'),/import ['"]\.\/modal-close\.css['"]/);
});
