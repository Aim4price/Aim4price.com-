/* Synthetic advert fixtures only. No live accounts, uploads or messages. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('typescript'),puppeteer=require('puppeteer-core'),chromium=require('@sparticuz/chromium');
const root=path.resolve(__dirname,'..');
const sources={};
for(const name of ['asset-saleability','selling-price','marketplace','ad-studio','marketplace-ad-renderer'])sources['./'+name]=ts.transpileModule(fs.readFileSync(path.join(root,'lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
sources['./tractor-data']='exports.listings=[];exports.tractors=[];';
(async()=>{
 const browser=await puppeteer.launch({executablePath:await chromium.executablePath(),args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
  const page=await browser.newPage();await page.setViewport({width:1600,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const font=fs.readFileSync(path.join(root,'public/field-manager/montserrat-latin.woff')).toString('base64');
  await page.setContent(`<style>@font-face{font-family:Montserrat;src:url(data:font/woff;base64,${font})}body{margin:0}canvas{max-width:100%}</style><canvas id="ad"></canvas>`);
  await page.addScriptTag({content:`const sources=${JSON.stringify(sources)},cache={};function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;new Function('require','exports','module',sources[name])(require,module.exports,module);return module.exports;}window.renderer=require('./marketplace-ad-renderer');`});
  await page.evaluate(()=>{
   const photo=document.createElement('canvas');photo.width=900;photo.height=600;const c=photo.getContext('2d');c.fillStyle='#aec4b4';c.fillRect(0,0,900,600);c.fillStyle='#335c49';c.font='50px Arial';c.fillText('Asset photo',260,320);
   window.fixture={title:'2024 Landini Super 110',year:'2024',usage:'439 hours',condition:'Good',familyLabel:'Tractor',askingPriceExVat:475000,aim4priceValueExVat:600000,realisticSellingPriceExVat:500000,showDealRating:true,sellerName:'Example seller',sellerCompany:'Example Farm',sellerPhone:'082 000 0000',location:'Free State',imageUrls:Array(4).fill(photo.toDataURL()),brand:{name:'Example',templateId:'showcase',primaryColor:'#165340',secondaryColor:'#0d3329',accentColor:'#f2b84b',businessName:'Example Farm',contactName:'Example seller',phone:'082 000 0000',email:'example@example.test',website:'',logoUrl:'',vatLabel:'plus-vat',language:'en',logoBackground:true}};
   window.text=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,...args){window.text.push(String(text));return fill.call(this,text,...args);};
  });
  for(const design of ['aim4price-marketplace','saved-brand']){
   await page.evaluate(async design=>{window.text=[];await window.renderer.renderMarketplaceAdCanvas(document.querySelector('canvas'),{...window.fixture,design},{useBestPhotoFit:false});},design);
   assert(await page.evaluate(()=>window.text.some(text=>text.includes('5% below realistic selling price'))));
   await (await page.$('canvas')).screenshot({path:`/tmp/selling-price-${design}.png`});
   await page.evaluate(async design=>{window.text=[];await window.renderer.renderMarketplaceAdCanvas(document.querySelector('canvas'),{...window.fixture,design,showDealRating:false},{useBestPhotoFit:false});},design);
   assert.equal(await page.evaluate(()=>window.text.some(text=>text.includes('selling price'))),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS optional realistic value strip in standard and branded adverts; hidden strip removed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
