import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(path, require = () => ({}), globals = {}) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS, jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports:{}};
  Function('module','exports','require',...Object.keys(globals),output)(module,module.exports,require,...Object.values(globals));
  return module.exports;
}
const {maintenanceLabel} = load('lib/maintenance-presentation.ts');
test('maintenance labels capitalise each display segment without damaging names or acronyms', () => {
  assert.equal(maintenanceLabel('equipment · manual'), 'Equipment · Manual');
  assert.equal(maintenanceLabel('property • manual value'), 'Property • Manual value');
  assert.equal(maintenanceLabel('TLB · John Deere'), 'TLB · John Deere');
  assert.equal(maintenanceLabel(null), '');
});
test('card surface toggles details but preserves actions, dialogs and selected text', () => {
  let selected = '', toggles = 0;
  class Element {constructor(interactive = false) {this.interactive = interactive;} closest() {return this.interactive;}}
  const jsx = (type, props) => ({type,props});
  const {default:Card} = load('components/MaintenanceDetailsCard.tsx', name => name === 'react/jsx-runtime' ? {jsx,jsxs:jsx} : {default:{}}, {Element,window:{getSelection:()=>({toString:()=>selected})}});
  const card = Card({expanded:false,onToggle:()=>toggles++,children:'Details'});
  card.props.onClick({target:new Element()});
  assert.equal(toggles,1);
  card.props.onClick({target:new Element(true)});
  selected = 'Copied serial';
  card.props.onClick({target:new Element()});
  assert.equal(toggles,1);
  assert.equal(card.props.children[0].props['data-tooltip'],'View details');
  assert.equal(Card({expanded:true,onToggle:()=>{}}).props.children[0].props['data-tooltip'],'Hide details');
});
