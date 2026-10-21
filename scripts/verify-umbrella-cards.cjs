/* Populated Asset Register browser checks; all account and asset responses are local fixtures.
 * Run separately from verify-website-canvas.cjs because both own the temporary fixture route.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const root = path.resolve(__dirname, '..');
const output = process.env.CANVAS_OUTPUT_DIR || path.join(root, '.next/canvas-validation');
const user = { id:'canvas-fixture', name:'Canvas Test Owner', email:'canvas@example.invalid', accountType:'owner', accountSubtype:null };
const profile = { userId:user.id,name:user.name,displayName:user.name,email:user.email,accountType:'owner',accountSubtype:'',logoUrl:'',extraPhotoUrls:[],businessName:'Test farm',phone:'',province:'Gauteng',townCity:'Test town',addressLine1:'',addressLine2:'',websiteUrl:'',vatNumber:'',notes:'',marketplaceSellerName:'',marketplacePhone:'',marketplaceEmail:'',marketplaceLocation:'',partnerServices:'',partnerBrandFocus:'',partnerDescription:'',partnerDirectoryStatus:'inactive',partnerLatitude:null,partnerLongitude:null,partnerServiceRadiusKm:null,discoveryParticipationEnabled:false,partnerDirectoryEnabled:false,createdAtIso:null,updatedAtIso:null };
const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function check(browser, url) {
  const page=await browser.newPage(); page.on('framenavigated',frame=>{if(frame===page.mainFrame())console.log('PAGE',frame.url())}); page.on('console',m=>{if(/refresh|reload|CLICK_TARGET/i.test(m.text()))console.log('BROWSER',m.text())}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const make=(id,title,value,extra={})=>({id,userId:user.id,registerId:'canvas-register',title,kind:'tractor',value,selectedValueExVat:value,aim4priceValueExVat:value,replacementPriceExVat:500000,selectedMethod:'aim4price',specsJson:{},brandName:'New Holland',modelName:'TT4.90',equipmentFamilyKey:'tractor',equipmentFamilyLabel:'Tractors',yearModel:2022,hours:1276,condition:'good',note:'',serialNumber:'',marketplaceStatus:'draft',photos:[],documents:[],createdAtIso:'2026-09-13T00:00:00Z',updatedAtIso:'2026-09-13T00:00:00Z',...extra});
  const assets=[make('member','2018 Massey Ferguson 4708',194438),make('member2','Farm trailer',15000,{specsJson:{assetFlagged:true}}),make('normal','2022 New Holland TT4.90 4WD Openstation',327133,{latestIssueNoteStatus:{id:'issue-1',note:'Rear light needs checking',operatorName:'Test owner',createdAtIso:'2026-09-13T00:00:00Z'},latestMaintenanceStatus:{id:'maintenance-1',summary:'Changed engine oil',operatorName:'Test mechanic',createdAtIso:'2026-09-13T00:00:00Z',photoUrls:[]}}),make('live','Year Unknown Zimmatic 6-Tower + Overhang',459000,{marketplaceStatus:'live',isPublishedToMarketplace:true})];
  let groups=[{id:'umbrella',userId:user.id,registerId:'canvas-register',name:'Asset umbrella',valueMode:'separate',isFlagged:false,members:[{assetId:'member',role:'primary',relationship:'primary',countsTowardTotal:true,sortOrder:0},{assetId:'member2',role:'member',relationship:'works_with',countsTowardTotal:true,sortOrder:1}],createdAtIso:'2026-09-13T00:00:00Z',updatedAtIso:'2026-09-13T00:00:00Z'}];
  await page.evaluateOnNewDocument(()=>{Object.defineProperty(window,'outerWidth',{configurable:true,get:()=>innerWidth}); localStorage.setItem('aim4price.website-canvas.v2',JSON.stringify({mode:'auto'}));});
  // Locator clicks wait for a stable, enabled target after canvas scrolling.
  const click = async selector => { console.log('CLICK', selector); await page.locator(selector).click(); };
  await page.evaluateOnNewDocument(()=>document.addEventListener('click',event=>{const e=event.target;console.log('CLICK_TARGET',e?.tagName,e?.className,e?.closest('a')?.href,e?.textContent?.slice(0,90));},true));
  await page.setRequestInterception(true);
  page.on('request',request=>{
    const target=new URL(request.url());
    if(request.isNavigationRequest() && request.frame()===page.mainFrame())console.log('NAV_REQUEST',request.url(),JSON.stringify(request.initiator()));
    if(target.pathname.startsWith('/api/')) {
      if(target.pathname==='/api/asset-groups' && request.method()==='PATCH') {const data=JSON.parse(request.postData());groups=groups.map(g=>({...g,isFlagged:data.isFlagged}));}
      const body=target.pathname==='/api/asset-register/saleability'?{ok:true,items:[]}:target.pathname==='/api/me'?{ok:true,signedIn:true,user}:target.pathname==='/api/account-profile'?{ok:true,profile}:{ok:true,register:{id:'canvas-register',name:'Test farm'},items:assets,assets,groups,registers:[{id:'canvas-register',name:'Test farm'}],notifications:[],listings:[],storages:[],recentEvents:[],recentFuelSlips:[],requests:[],budgets:[],scanPin:{enabled:false,hasPin:false},enabled:false,hasPin:false};
      return request.respond({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(request.resourceType()==='media')return request.abort();return request.continue();
  });
  for(const width of [1440,430]) {
    await page.setViewport({width,height:1100,deviceScaleFactor:1});
    await page.goto(url+'/canvas-validation?page=register',{waitUntil:'networkidle2',timeout:120000});
    await page.waitForSelector('[data-asset-group-id="umbrella"]');
    // Smooth root scrolling can move a target between Puppeteer's hit test
    // and pointer dispatch, especially on slower CI runners.
    await page.addStyleTag({content:'html { scroll-behavior: auto !important; }'});
    await page.$eval('[data-asset-group-id="umbrella"]',e=>e.scrollIntoView({block:'start'}));
    await page.screenshot({path:path.join(output,`umbrella-design-${width}.png`)});
    const geometry=await page.evaluate(()=>[...document.querySelectorAll('[class*="assetGroupHeaderRow"], [class*="assetCardRow"]')].filter(e=>e.querySelector('h2')).map(row=>{
      const title=row.querySelector('h2'),panel=row.querySelector('[aria-label="Asset valuation"]'),price=row.querySelector(panel?'[aria-label="Asset valuation"] strong[aria-live="polite"]':'[class*="assetValueVatAmountRow"] strong'),rail=row.querySelector('[class*="assetSideActions"]');
      if(!price||!rail?.firstElementChild)throw new Error(`${title.textContent}: missing visible price or action rail`);
      const r=title.getBoundingClientRect(),p=price.getBoundingClientRect(),f=rail.firstElementChild.getBoundingClientRect(),v=panel?.getBoundingClientRect();
      const summary=row.querySelector('[class*="assetHeader_"]');
      const a=rail.getBoundingClientRect(),h=summary?.getBoundingClientRect();
      return {title:title.textContent,titleY:r.y+parseFloat(getComputedStyle(title).lineHeight)*(r.height/title.offsetHeight)/2,titleTop:r.top,priceY:p.y+p.height/2,priceWidth:p.width,priceHeight:p.height,panelTop:v?.top,flagY:f.y+f.height/2,actionCount:rail.children.length,railY:a.y+a.height/2,summaryY:h ? h.y+h.height/2 : null};
    }));console.log(width,JSON.stringify(geometry));
    for(const g of geometry) {
      assert.ok(g.priceWidth>0&&g.priceHeight>0,`${g.title}: visible price`);
      if(g.panelTop!==undefined)assert.ok(Math.abs(g.titleTop-g.panelTop)<8,`${g.title}: valuation panel alignment`);
      else assert.ok(Math.abs(g.titleY-g.priceY)<8,`${g.title}: umbrella price alignment`);
      if(g.summaryY!==null) {
        // Asset cards centre the complete summary against all available actions,
        // rather than pinning the first flag button to the title.
        assert.ok(Math.abs(g.summaryY-g.railY)<2,`${g.title}: ${g.actionCount}-button rail centred beside summary`);
      } else {
        assert.ok(Math.abs(g.titleY-g.flagY)<8,`${g.title}: umbrella flag alignment`);
      }
    }
    assert.ok(geometry.some(g=>g.summaryY!==null && g.actionCount===3),'three-action asset covered');
    assert.ok(geometry.some(g=>g.summaryY!==null && g.actionCount===4),'four-action asset covered');
    for (const selector of ['#asset-card-normal [class*="assetGroupButton"]', '[aria-label="Edit Asset umbrella"]']) {
      await page.$eval(selector,e=>e.scrollIntoView({block:'center',behavior:'instant'}));
      await page.mouse.move(2, 2);
      await delay(250);
      const resting = await page.$eval(selector,e=>getComputedStyle(e).backgroundColor);
      assert.notEqual(resting,'rgb(255, 246, 207)','umbrella control is not yellow at rest');
      await page.hover(selector);
      await page.waitForFunction(sel=>getComputedStyle(document.querySelector(sel)).backgroundColor==='rgb(255, 246, 207)',{},selector);
      await page.mouse.move(2, 2);
      await page.waitForFunction((sel,colour)=>getComputedStyle(document.querySelector(sel)).backgroundColor===colour,{},selector,resting);
    }
    assert.equal(await page.$eval('#asset-card-live [class*="marketplaceLiveStatus"]',e=>e.textContent),'Live on Marketplace');
    assert.equal(await page.$eval('[aria-label="Edit Asset umbrella"]',e=>e.getAttribute('data-tooltip')),'Edit umbrella');
    await click('[aria-label="Edit Asset umbrella"]');
    await page.waitForFunction(()=>document.querySelector('#asset-group-title')?.textContent.includes('Edit umbrella'));
    await click('[aria-label="Close umbrella manager"]');
    const flagSelector = `[aria-label="${groups[0].isFlagged?'Unflag':'Flag'} Asset umbrella"]`;
    await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
    await page.$eval(flagSelector,e=>e.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForFunction(selector=>{
      const button=document.querySelector(selector),r=button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    },{},flagSelector);
    const flagPoint=await page.$eval(flagSelector,e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    await page.mouse.click(flagPoint.x,flagPoint.y);
    await page.waitForFunction(()=>document.querySelector('[aria-label="Unflag Asset umbrella"]'));
    assert.equal(await page.$eval('#asset-card-normal [class*="assetGroupButton"]',e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)', 'standalone umbrella control stays neutral at rest');
    const groupDetails = '[class*="assetGroupHeaderRow"] [class*="cardViewDetailsButton"]';
    const details = id => `#asset-card-${id} [class*="cardViewDetailsButton"]`;
    const isOpen = async id => page.$eval(details(id), e => e.getAttribute('aria-expanded') === 'true');
    const outside = async () => {
      // Use an inert fixture target: viewport coordinates can hit a navigation
      // link after a card expansion changes the canvas scroll position.
      await page.evaluate(()=>{const target=document.createElement('div');target.id='outside-card-test-target';target.style.cssText='position:fixed;left:2px;bottom:2px;width:12px;height:12px;z-index:2147483647';document.body.append(target);});
      await click('#outside-card-test-target');
      await page.$eval('#outside-card-test-target',e=>e.remove());
      await delay(100);
    };
    const red = async selector => {
      await page.waitForFunction(sel => getComputedStyle(document.querySelector(sel)).borderTopColor === 'rgb(223, 67, 77)', {}, selector);
      return page.$eval(selector,e=>getComputedStyle(e).borderTopColor);
    };
    assert.equal(await red('[class*="assetGroupHeaderFlagged"]'),'rgb(223, 67, 77)');
    const umbrellaTitle = '[class*="assetGroupHeaderRow"] h2';
    assert.equal(await page.$eval(groupDetails,e=>e.getAttribute('data-tooltip')),'Open Umbrella');
    await page.$eval(umbrellaTitle,e=>e.scrollIntoView({block:'center'}));
    await page.hover(umbrellaTitle);
    await delay(180);
    const supportsHover = await page.evaluate(()=>matchMedia('(hover: hover) and (pointer: fine)').matches);
    assert.equal(await page.$eval('[class*="assetGroupHeader"] > [class*="cardToggleHint"]',e=>getComputedStyle(e,'::after').opacity),supportsHover?'1':'0','hover hints follow device pointer capabilities');
    await click(umbrellaTitle);
    await page.waitForSelector('#asset-card-member');
    assert.equal(await page.$eval(groupDetails,e=>e.getAttribute('data-tooltip')),'Close Umbrella');
    await click(umbrellaTitle);
    await page.waitForFunction(()=>!document.querySelector('#asset-card-member'));
    await click(umbrellaTitle);
    await page.waitForSelector('#asset-card-member');
    for (const id of ['member','member2']) {
      assert.equal(await page.$eval(`#asset-card-${id} [class*="assetFlagButton"]`, e=>e.getAttribute('aria-pressed')),'true');
      assert.equal(await red(`#asset-card-${id}`),'rgb(223, 67, 77)');
    }
    await click(details('member'));
    await page.waitForFunction(()=>document.querySelector('#asset-card-member [aria-expanded="true"]'));
    assert.equal(await red('#asset-card-member'),'rgb(223, 67, 77)');
    await click('#asset-card-member h2');
    assert.equal(await isOpen('member'),false,'card click closes member details');
    assert.equal(await page.$eval(details('member'),e=>e.getAttribute('data-tooltip')),'Open Asset');
    await click('#asset-card-member h2');
    assert.equal(await isOpen('member'),true,'card click opens member details');
    assert.equal(await page.$eval(details('member'),e=>e.getAttribute('data-tooltip')),'Close Asset');
    await page.screenshot({path:path.join(output,`umbrella-red-expanded-${width}.png`)});
    await outside();
    assert.equal(await isOpen('member'),false,'outside closes member details first');
    await outside();
    assert.equal(await page.$('#asset-card-member'),null,'next outside click closes umbrella');
    await click(groupDetails);
    await page.waitForSelector('#asset-card-member');
    assert.equal(await isOpen('member'),false,'reopening umbrella does not restore stale member details');
    await click(details('member'));
    // Muted cards intentionally ignore pointer events. Center the row away
    // from the sticky header before testing its outside-dismissal surface.
    await page.$eval('#asset-card-member2 h2',e=>e.scrollIntoView({block:'center',behavior:'instant'}));
    const mutedPoint=await page.$eval('#asset-card-member2 h2',e=>{const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
    assert.equal(await page.evaluate(({x,y})=>Boolean(document.elementFromPoint(x,y)?.closest('a, nav, header')),mutedPoint),false,'muted-card click is clear of navigation');
    await page.mouse.click(mutedPoint.x,mutedPoint.y);
    assert.equal(await isOpen('member'),false,'clicking a muted card dismisses the focused asset');
    await outside();
    await click(groupDetails);
    await page.waitForSelector('#asset-card-member');
    await click('#asset-card-member [class*="assetFlagButton"]');
    await page.waitForSelector('[aria-label="Flag Asset umbrella"]');
    assert.equal(await page.$eval('#asset-card-member [class*="assetFlagButton"]',e=>e.getAttribute('aria-pressed')),'false');
    assert.equal(await page.$eval('#asset-card-member2 [class*="assetFlagButton"]',e=>e.getAttribute('aria-pressed')),'true','unflagging umbrella preserves individual flags');
    await outside();
    const value = '#asset-card-normal [class*="assetValueVatAmountRow"] strong';
    const amount=()=>page.$eval(value,e=>Number(e.textContent.replace(/[^0-9]/g,'')));
    assert.equal(await amount(),327133,'stock asset value is displayed');
    assert.equal(await page.$('#asset-card-normal [aria-label="Value basis"]'),null,'stock card has no value selector');
    await click('#asset-card-normal button[aria-label="Show incl. VAT"]');
    assert.equal(await amount(),Math.round(327133*1.15),'VAT changes displayed value');
    await click('#asset-card-normal button[aria-label="Show excl. VAT"]');
    assert.equal(await amount(),327133,'VAT restores excluded value');
    assert.equal(await page.$eval(value,e=>e.hasAttribute('role')||e.hasAttribute('tabindex')),false,'displayed value is not an edit shortcut');
    await click(value);
    assert.equal(await page.$('[role="dialog"]'),null,'clicking the value does not open a value editor');
    await page.waitForFunction(()=>document.querySelector('#asset-card-normal [aria-expanded="true"]'));
    await click('#asset-card-normal h2');
    assert.equal(await isOpen('normal'),false,'card click closes standalone details');
    await click('#asset-card-normal h2');
    assert.equal(await isOpen('normal'),true,'card click opens standalone details');

    await page.waitForSelector('#asset-card-normal [aria-label="Estimated selling price"]');
    const detailOrder=await page.$eval('#asset-card-normal',card=>{
      const market=card.querySelector('[aria-label="Estimated selling price"]');
      const replacement=card.querySelector('[data-asset-return-action="detail-replacement"]');
      const documents=card.querySelector('[aria-label^="View documents for"]');
      return {afterReplacement:!!(replacement.compareDocumentPosition(market)&Node.DOCUMENT_POSITION_FOLLOWING),beforeDocuments:!!(market.compareDocumentPosition(documents)&Node.DOCUMENT_POSITION_FOLLOWING),calculate:market.textContent.includes('Calculate')};
    });
    assert.deepEqual(detailOrder,{afterReplacement:true,beforeDocuments:true,calculate:true});
    await click('#asset-card-normal [aria-label="Open saleability assessment"]');
    await page.waitForSelector('[aria-label="Close Saleability"]');
    await click('[aria-label="Close Saleability"]');
    await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));
    assert.equal(await isOpen('normal'),true,'closing saleability returns to expanded card, not a pricing menu');

    const layout = await page.$eval('#asset-card-normal',card=>{
      const details=card.querySelector('#asset-panel-normal');
      const notices=[...card.querySelectorAll('[class*="partnerNoteBanner"]')];
      return {count:notices.length,below:notices.every(n=>(details.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING)&&n.getBoundingClientRect().top>=details.getBoundingClientRect().bottom)};
    });
    assert.equal(layout.count,2,'issue and maintenance notices are present');
    assert.equal(layout.below,true,'expanded asset details precede every notice visually and in reading order');
    await page.screenshot({path:path.join(output,`asset-details-before-notices-${width}.png`)});
    const manageSelector='#asset-card-normal [class*="cardManageButton"]';
    await page.waitForSelector(manageSelector,{visible:true});
    await page.$eval(manageSelector,e=>e.scrollIntoView({block:'center',behavior:'instant'}));
    await page.waitForFunction(async selector=>{
      const button=document.querySelector(selector);
      if(!button)return false;
      const before=button.getBoundingClientRect();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const after=button.getBoundingClientRect();
      return Math.abs(before.x-after.x)<.1&&Math.abs(before.y-after.y)<.1
        &&button.contains(document.elementFromPoint(after.x+after.width/2,after.y+after.height/2));
    },{},manageSelector);
    await click(manageSelector);
    // Resolve and interact in one browser turn: canvas overlay mounting can
    // replace the node between separate waitForSelector and $eval calls.
    await page.waitForFunction(()=>{
      const dialog=document.querySelector('[role="dialog"][aria-labelledby="asset-manage-title"]');
      if(!dialog?.isConnected||!dialog.getBoundingClientRect().width)return false;
      dialog.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      return true;
    });
    assert.equal(await isOpen('normal'),true,'modal interaction preserves expanded asset');
    await page.keyboard.press('Escape');
    await outside();
    assert.equal(await isOpen('normal'),false,'outside closes standalone details');
    await click('[aria-label="Flag Asset umbrella"]');
    await page.waitForSelector('[aria-label="Unflag Asset umbrella"]');
    await page.screenshot({path:path.join(output,`umbrella-flagged-${width}.png`)});
    await page.reload({waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForSelector('[aria-label="Unflag Asset umbrella"]');
    groups[0].isFlagged=false;
  }
  assert.deepEqual(errors,[]);console.log('PASS card layout, inherited red flags, independent flag preservation, outside dismissal, card toggles, hover labels and modal preservation');await page.close();
}
async function main() {
  await fs.mkdir(output,{recursive:true});
  const external=process.env.CANVAS_TEST_URL;let server,browser;const fixture=path.join(root,'app/canvas-validation');
  try {
    if(!external) {
      await fs.mkdir(fixture);await fs.copyFile(path.join(root,'tests/fixtures/website-canvas-page.tsx'),path.join(fixture,'page.tsx'));
      server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','-p','3030'],{cwd:root,env:{...process.env,PGHOST:'127.0.0.1',PGPORT:'5432',PGUSER:'canvas_validation',PGPASSWORD:'local-validation-only',PGDATABASE:'canvas_validation',BETTER_AUTH_SECRET:'canvas-local-validation-secret-not-for-production'},stdio:['ignore','pipe','pipe']});
      await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Next startup timed out')),90000);server.stdout.on('data',data=>{if(data.toString().includes('Ready')){clearTimeout(timer);resolve()}});server.stderr.on('data',data=>process.stderr.write(data));server.once('exit',code=>{clearTimeout(timer);reject(Error(`Next exited ${code}`))})});
    }
    await fs.mkdir(output,{recursive:true});
    browser=await puppeteer.launch({executablePath:process.env.CANVAS_BROWSER_PATH||await chromium.executablePath(),args:process.env.CANVAS_BROWSER_PATH?['--no-sandbox','--disable-dev-shm-usage']:chromium.args,headless:true,pipe:true});
    await check(browser,external||'http://127.0.0.1:3030');
  } finally {
    if(browser) await browser.close();
    if(server) {
      // Remove only the files this runner owns, before stopping Next's worker.
      for(const file of [path.join(fixture,'page.tsx'),path.join(root,'.next/types/app/canvas-validation/page.ts')]) {
        await fs.unlink(file).catch(error=>{if(error.code!=='ENOENT')throw error});
      }
      await fs.rmdir(fixture).catch(error=>{if(error.code!=='ENOENT')throw error});
      server.kill();
    }
  }
}
main().catch(error=>{console.error(error);process.exitCode=1});

