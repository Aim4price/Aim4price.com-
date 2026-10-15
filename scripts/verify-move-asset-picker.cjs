const fs = require('fs');
const path = require('path');
const root = process.cwd();
const ts = require(root + '/node_modules/typescript');
const puppeteer = require(root + '/node_modules/puppeteer-core');
const chromium = require(root + '/node_modules/@sparticuz/chromium');
(async () => {
 fs.mkdirSync('.next/canvas-validation', { recursive: true });
 const js = ts.transpileModule(fs.readFileSync('components/asset-register/MoveAssetDestinationPicker.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 }}).outputText;
 const css = fs.readFileSync('components/asset-register/MoveAssetDestinationPicker.module.css','utf8');
 const browser = await puppeteer.launch({executablePath: process.env.CANVAS_BROWSER_PATH || await chromium.executablePath(),args:chromium.args,headless:true,pipe:true});
 try {
 const page = await browser.newPage();
 await page.setContent('<html><head><style>*{box-sizing:border-box}body{font-family:Arial;margin:0}'+css+'</style></head><body><div id="root"></div></body></html>');
 await page.addScriptTag({path: root+'/node_modules/react/umd/react.development.js'});
 await page.addScriptTag({path: root+'/node_modules/react-dom/umd/react-dom.development.js'});
 await page.addScriptTag({content: `const exports = {}; const require = name => name === 'react' ? React : { default: new Proxy({}, {get: (_, key) => key}) }; ${js};
 function Demo(){const [destination,setDestination]=React.useState('register');const [targetId,setTarget]=React.useState('');return React.createElement(exports.default,{assetName:'2000 Deutz 85kW Genset',sourceName:'Gre Kuyler Trust',destination,onDestinationChange:v=>{setDestination(v);setTarget('')},options:Array.from({length:12},(_,i)=>({value:String(i),label:(destination==='register'?'Asset register ':'Umbrella ')+(i+1),description:'8 assets · R 32 620 000 current value'})),targetId,onSelect:setTarget,canUseUmbrellas:true,loading:false,loadError:'',error:'',busy:false,managementHref:'#',onRetry:()=>{},onClose:()=>{},onMove:()=>window.moves=(window.moves||0)+1})} ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Demo));`});
 await page.waitForSelector('[role="dialog"]');
 await page.setViewport({width:1280,height:900});
 await page.screenshot({path:'.next/canvas-validation/move-picker-desktop.png'});
 await page.locator('input').fill('register 12');
 let count=await page.$$eval('.option',els=>els.length); if(count!==1)throw Error('Search failed '+count);
 await page.click('.option');
 await page.click('.primary');
 if(await page.evaluate(()=>window.moves)!==1)throw Error('Confirm failed');
 await page.click('.types button:nth-child(2)');
 if(!(await page.$eval('.primary',el=>el.disabled)))throw Error('Destination change retained selection');
 if((await page.$$eval('.option',els=>els.length))!==12)throw Error('Search not reset');
 await page.setViewport({width:390,height:844});
 await page.screenshot({path:'.next/canvas-validation/move-picker-mobile.png'});
 const fits=await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight});
 if(!fits)throw Error('Mobile modal overflows');
 await page.focus('.close');
 await page.keyboard.down('Shift'); await page.keyboard.press('Tab'); await page.keyboard.up('Shift');
 if(!(await page.$eval('.actions button:first-child',el=>el===document.activeElement)))throw Error('Focus escaped dialog');
 console.log('PASS: search, selection, confirmation, destination reset and mobile bounds');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exit(1)});
