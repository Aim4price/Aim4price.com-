/* Browser-level palette regression: real shared CSS, isolated controls, no account writes. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const postcss = require('postcss');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const sheets = [fs.readFileSync('public/app-theme.css', 'utf8')];
let index = 0;
function css(file) {
  const classes = {}, prefix = `qa${index++}_`;
  const sheet = postcss.parse(fs.readFileSync(file, 'utf8'));
  sheet.walkRules(rule => {
    const globals = [];
    let selector = rule.selector;
    while (selector.includes(':global(')) {
      const start = selector.indexOf(':global(');
      let end = start + 8, depth = 1;
      for (; depth && end < selector.length; end++) {
        if (selector[end] === '(') depth++;
        if (selector[end] === ')') depth--;
      }
      const token = `GLOBALTOKEN${globals.length}`;
      globals.push(selector.slice(start + 8, end - 1));
      selector = selector.slice(0, start) + token + selector.slice(end);
    }
    selector = selector.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => {
      classes[name] = prefix + name;
      return '.' + classes[name];
    });
    globals.forEach((value, i) => { selector = selector.replace(`GLOBALTOKEN${i}`, value); });
    rule.selector = selector;
  });
  sheets.push(sheet.toString());
  return classes;
}
const asset = css('app/asset-register/page.module.css');
const account = css('components/AccountDialog.module.css');
const manage = css('components/leads/ManageActionGrid.module.css');
const workspace = css('components/WorkspacePrimitives.module.css');
const ledger = css('components/LedgerManageActions.module.css');
const item = css('components/ItemActionButton.module.css');
const details = css('components/AssetDetailChoiceField.module.css');
const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8M12 8v8"/></svg>';
const actions = [['details','Asset details'],['location','Asset location'],['addMaintenance','Maintenance'],['fuel','Fuel'],['budget','Costs and budgets'],['suggestValue','Pricing']];
const fixture = `<main><h1>Aim4price action colours</h1><section id="panel"><h2>Manage assets</h2><div class="${asset.managementAccountModal} ${asset.ownerCommandModal} ${account.surface}"><div class="${asset.ownerCommandGrid} ${asset.optionsGrid} ${asset.assetOptionsGrid} ${account.actions} ${manage.grid}" data-manage-actions>${actions.map(([key,label])=>`<button data-manage-action="${key}" class="${asset.optionActionButton} ${asset.ownerCommandAction}">${icon}<span><strong>${label}</strong><small>View and manage this asset.</small></span></button>`).join('')}</div></div></section><section><h2>Workspace actions</h2><div class="toolbar ${workspace.page}">${[['actionCopper','Share'],['actionBlue','Details'],['actionMint','Manage'],['actionDanger','Delete'],['actionGreen','Continue']].map(([key,label])=>`<button id="${key}" class="${workspace.actionButton} ${workspace[key]}">${label}</button>`).join('')}<button disabled id="disabled" class="${workspace.actionButton} ${workspace.actionBlue}">Unavailable</button></div></section><section><h2>Ledger management</h2><div class="${ledger.grid}"><button class="${ledger.primary}">${icon}<span class="${ledger.copy}"><span>Edit record</span><small>Update the recorded details.</small></span></button><button class="${ledger.danger}">${icon}<span class="${ledger.copy}"><span>Delete record</span><small>Remove this record.</small></span></button></div></section><section><h2>Details and row actions</h2><div class="${details.choices}"><button aria-pressed="true" class="${details.choice} ${details.selected}"><span class="${details.icon}" data-tone="amber">${icon}</span><span class="${details.copy}"><strong>Selected condition</strong><small>Selection stays clearly marked.</small></span><span class="${details.check}">✓</span></button></div><div class="toolbar"><button class="${item.iconAction}" data-action="edit" aria-label="Edit row">${icon}</button><button class="${item.iconAction}" data-action="delete" aria-label="Delete row">${icon}</button></div></section></main>`;
(async () => {
  const browser = await puppeteer.launch({executablePath: await chromium.executablePath(), args: chromium.args, headless: true});
  try {
    const page = await browser.newPage();
    const output = '.next/action-colour-validation';
    fs.mkdirSync(output, {recursive: true});
    const font = fs.readFileSync('public/fonts/montserrat-latin.woff').toString('base64');
    await page.setViewport({width:1440,height:1100});
    await page.setContent(`<style>@font-face{font-family:Montserrat;src:url(data:font/woff;base64,${font})}*{box-sizing:border-box}body{margin:0;font-family:Montserrat,Arial;background:#edf2ef;color:#12352d}main{max-width:1200px;margin:32px auto;padding:28px}h1{font-size:30px}h2{font-size:18px;margin:0 0 18px}section{background:var(--app-surface,#fff);border-radius:20px;padding:22px;margin:20px 0}.toolbar{display:flex;gap:12px;flex-wrap:wrap;margin-top:14px}button{font:inherit}svg{width:24px;height:24px} ${sheets.join('\n')} .toolbar{min-height:0;background:transparent;padding:0}.${asset.ownerCommandGrid}{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}@media(max-width:600px){main{padding:8px;margin:0}.${asset.ownerCommandGrid}{grid-template-columns:1fr}} </style>${fixture}`);
    await page.evaluate(() => document.fonts.ready);
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => document.documentElement.dataset.appTheme = theme, theme);
      const result = await page.evaluate(() => {
        const rgb = value => {
          const c = document.createElement('canvas'); c.width=c.height=1;
          const ctx=c.getContext('2d'); ctx.fillStyle=value; ctx.fillRect(0,0,1,1);
          return [...ctx.getImageData(0,0,1,1).data].slice(0,3);
        };
        const lum = a => a.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
        const cards = [...document.querySelectorAll('[data-manage-action]')].map(e=>{
          const s=getComputedStyle(e), ink=rgb(getComputedStyle(e.querySelector('small')).color), fill=rgb(s.getPropertyValue('--action-tint'));
          const a=lum(ink),b=lum(fill);
          return {border:s.borderTopWidth,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),background:s.backgroundImage};
        });
        return {cards,primary:getComputedStyle(document.getElementById('actionGreen')).color,disabled:getComputedStyle(document.getElementById('disabled')).opacity,panel:getComputedStyle(document.getElementById('panel')).backgroundColor,copper:getComputedStyle(document.getElementById('actionCopper')).backgroundImage,danger:getComputedStyle(document.getElementById('actionDanger')).backgroundImage};
      });
      assert(result.cards.every(c=>c.border==='2px'), `${theme}: legacy styles must not override card borders`);
      assert(result.cards.every(c=>c.contrast>=4.5), `${theme}: supporting text must pass WCAG AA`);
      assert.equal(new Set(result.cards.map(c=>c.background)).size,6, 'Categories remain visually distinct');
      assert.equal(result.primary,'rgb(255, 255, 255)','Filled primary action keeps white text');
      assert(Number(result.disabled)<.7,'Disabled actions remain visibly unavailable');
      assert.notEqual(result.copper,result.danger,'Sharing copper must not become deletion red');
      if(theme==='light') assert.equal(result.panel,'rgb(255, 255, 255)','Colour update does not tint dialog panels');
      await page.screenshot({path:path.join(output,`${theme}-desktop.png`),fullPage:true});
      await page.setViewport({width:390,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal phone overflow');
      await page.screenshot({path:path.join(output,`${theme}-phone.png`),fullPage:true});
      await page.setViewport({width:1440,height:1100});
    }
    await page.focus('[data-manage-action="details"]');
    assert.notEqual(await page.$eval('[data-manage-action="details"]',e=>getComputedStyle(e).outlineStyle),'none','Keyboard focus remains visible');
    console.log('PASS shared action colours: category identity, legacy cascade, text contrast, dark mode, disabled/primary controls, keyboard focus and phone layout');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
