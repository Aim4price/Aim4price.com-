import { assertNoWebsiteReflow } from './helpers/site-layout-audit.mjs';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage plays one slower timed tour, stays on its final feature, then follows scroll in both directions', async () => {
  const [page, hero, preview, roleSelector, styles, auth] = await Promise.all([
    read('app/page.tsx'),
    read('app/home-hero-experience.tsx'),
    read('app/home-asset-preview.tsx'),
    read('app/home-role-selector.tsx'),
    read('app/page.module.css'),
    read('app/auth/auth-client.tsx'),
  ]);

  assert.match(page, /<AppHeader active="home" brandAlignment="working-column" \/>/);
  assert.match(page, /import HomeHeroExperience from '\.\/home-hero-experience'/);
  assert.match(page, /<HomeHeroExperience \/>/);
  assert.doesNotMatch(page, /import HomeAssetPreview/);
  assert.match(page, /import HomeRoleSelector from '\.\/home-role-selector'/);
  assert.match(page, /<HomeRoleSelector \/>/);
  assert.ok(page.indexOf('<HomeHeroExperience />') < page.indexOf('<HomeRoleSelector />'));

  const heroStages = hero.slice(
    hero.indexOf('export const HERO_STAGES'),
    hero.indexOf('export const HERO_STORY_STEPS'),
  );
  const featureSteps = [...heroStages.matchAll(/^\s+'([^']+)',?$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(featureSteps, ['worth', 'have', 'manage', 'cost', 'attention']);

  const storySteps = hero.slice(
    hero.indexOf('export const HERO_STORY_STEPS'),
    hero.indexOf('type StoryStep'),
  );
  const openingSteps = [...storySteps.matchAll(/^\s+'([^']+)',?$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(openingSteps, ['brand', 'promise', 'preview']);
  assert.match(storySteps, /\.\.\.HERO_STAGES/);
  assert.equal(openingSteps.length + featureSteps.length, 8);

  assert.match(hero, /^'use client';/);
  assert.match(hero, /Aim4price\.com asset management software built for South Africa/);
  assert.match(hero, /<span>\s*Aim4price\.com\s*<span className=\{styles\.openingProgress\}/);
  assert.match(hero, /'Asset Management Software'/);
  assert.match(hero, /'built for South Africa\.'/);
  assert.match(hero, /Know what you have\./);
  assert.match(hero, /Know what it’s worth\./);
  assert.match(hero, /Know what it costs\./);
  assert.match(hero, /Manage your vehicles, machinery and equipment in one place/);
  assert.match(hero, /indicative estimate or enter a value you already have/);
  assert.match(hero, /documents, maintenance, budgets and costs connected/);

  assert.match(hero, /<a[\s\S]*?href="#choose-role"[\s\S]*?className=\{styles\.primaryCta\}[\s\S]*?onClick=\{handleRoleSkip\}[\s\S]*?Get started/);
  assert.match(hero, /<Link href="\/valuation" className=\{styles\.secondaryCta\}>[\s\S]*?Get a Free Estimate/);
  assert.doesNotMatch(hero, /heroAudienceCta|heroSectors|Choose how you’ll use Aim4price|Agriculture|Construction|Industrial|Motor/);
  assert.match(hero, /useState\(0\)/);
  assert.match(hero, /useState<QuestionKey>\('worth'\)/);
  assert.match(hero, /data-story-step=\{storyStep\}/);
  assert.match(hero, /data-story-mode=\{storyMode\}/);
  assert.match(hero, /data-active-question=\{activeQuestion\}/);
  assert.match(hero, /isAutoplaying && storyStepIndex >= FEATURE_START_INDEX/);
  assert.match(hero, /<HomeAssetPreview[\s\S]*?activeQuestion=\{activeQuestion\}[\s\S]*?onQuestionChange=\{handleQuestionChange\}/);

  assert.match(hero, /const FEATURE_START_INDEX = 3/);
  assert.match(hero, /HERO_FEATURE_DURATION_MS = 10000/);
  assert.match(hero, /brand: 5200,[\s\S]*?promise: 4800,[\s\S]*?preview: 3600/);
  for (const question of featureSteps) {
    assert.match(hero, new RegExp(`${question}: HERO_FEATURE_DURATION_MS`));
  }
  assert.match(hero, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.doesNotMatch(hero, /DESKTOP_STORY_QUERY/);
  assert.match(hero, /supportsStory = !reducedMotionMedia\.matches/);
  assert.match(hero, /reducedMotionMedia\.addEventListener\('change', syncStoryCapability\)/);
  assert.match(hero, /reducedMotionMedia\.addEventListener\('change', syncStoryCapability\)/);
  assert.match(hero, /if \(!supportsStory\) \{[\s\S]*?setIsAutoplaying\(false\)[\s\S]*?setIsManuallyControlled\(true\)[\s\S]*?updateStoryStep\(FEATURE_START_INDEX\)/);
  assert.match(hero, /const storyStep = HERO_STORY_STEPS\[storyStepIndex\]/);
  assert.match(hero, /window\.setTimeout\([\s\S]*?clockRef\.current\.remaining/);
  assert.match(hero, /const finishAutoplay = useCallback\(\(\) => \{[\s\S]*?autoplayFinishedRef\.current = true;[\s\S]*?setHasAutoplayFinished\(true\);[\s\S]*?setIsAutoplaying\(false\);[\s\S]*?setIsPaused\(false\);[\s\S]*?setIsTourFinished\(true\);[\s\S]*?setRemainingMs\(0\)/);
  assert.match(hero, /storyStepIndex >= HERO_STORY_STEPS\.length - 1[\s\S]*?finishAutoplay\(\)/);
  assert.match(hero, /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?if \(autoplayFinishedRef\.current\) return/);
  const terminalAutoplay = hero.slice(
    hero.indexOf('if (storyStepIndex >= HERO_STORY_STEPS.length - 1)'),
    hero.indexOf('updateStoryStep(storyStepIndex + 1)'),
  );
  assert.doesNotMatch(terminalAutoplay, /completeStory\(/);
  assert.match(hero, /updateStoryStep\(storyStepIndex \+ 1\)/);
  assert.match(hero, /window\.clearTimeout\(timer\)/);
  assert.match(hero, /window\.clearInterval\(countdown\)/);
  assert.match(hero, /data-feature-countdown/);
  assert.match(hero, /data-story-start aria-label="Start homepage animation" onClick=\{startStory\}/);
  assert.match(hero, /document\.addEventListener\('visibilitychange', syncVisibility\)/);
  assert.match(hero, /document\.removeEventListener\('visibilitychange', syncVisibility\)/);
  assert.match(hero, /if \(!section \|\| !\('IntersectionObserver' in window\)\) return undefined/);
  assert.match(hero, /new IntersectionObserver\([\s\S]*?setIsHeroVisible\(entry\?\.isIntersecting \?\? true\)[\s\S]*?threshold: 0\.12/);
  assert.match(hero, /observer\.observe\(section\)/);
  assert.match(hero, /return \(\) => observer\.disconnect\(\)/);
  assert.match(hero, /!canAutoplay \|\|[\s\S]*?!isPageVisible \|\|[\s\S]*?!isHeroVisible \|\|[\s\S]*?isPaused \|\|[\s\S]*?isManuallyControlled \|\|[\s\S]*?hasAutoplayFinished/);

  assert.match(hero, /window\.addEventListener\('scroll', handleScroll, \{ passive: true \}\)/);
  assert.match(hero, /window\.removeEventListener\('scroll', handleScroll\)/);
  assert.match(hero, /const scheduleStorySync = \(claimControl: boolean\) => \{/);
  assert.match(hero, /if \(claimControl\) autoplayFinishedRef\.current = true/);
  assert.match(hero, /scrollClaimRef\.current = scrollClaimRef\.current \|\| claimControl/);
  assert.match(hero, /scrollFrameRef\.current = window\.requestAnimationFrame\(\(\) => \{/);
  assert.match(hero, /currentScrollY = window\.scrollY/);
  assert.match(hero, /const sectionRect = section\.getBoundingClientRect\(\)/);
  assert.match(hero, /const stickyRect = sticky\.getBoundingClientRect\(\)/);
  assert.match(hero, /sectionTop = currentScrollY \+ sectionRect\.top/);
  assert.match(hero, /stickyTop =\s*\(Number\.parseFloat\(window\.getComputedStyle\(sticky\)\.top\) \|\| 0\) \* currentWebsiteScale\(\)/);
  assert.match(hero, /trackStart = sectionTop - stickyTop/);
  assert.match(hero, /trackTravel = Math\.max\([\s\S]*?1,[\s\S]*?sectionRect\.height - stickyRect\.height,[\s\S]*?\)/);
  assert.match(hero, /localScroll = Math\.max\([\s\S]*?0,[\s\S]*?Math\.min\(trackTravel, currentScrollY - trackStart\),[\s\S]*?\)/);
  assert.match(hero, /progress = localScroll \/ trackTravel/);
  assert.match(hero, /nextIndex = clampStoryIndex\([\s\S]*?Math\.floor\(progress \* HERO_STORY_STEPS\.length\),[\s\S]*?\)/);
  assert.match(hero, /if \(nextIndex !== storyStepRef\.current\) updateStoryStep\(nextIndex\)/);
  assert.match(hero, /if \(shouldClaimControl\) \{[\s\S]*?setHasAutoplayFinished\(true\);[\s\S]*?setIsManuallyControlled\(true\);[\s\S]*?setIsPaused\(false\);[\s\S]*?setIsAutoplaying\(false\)/);
  assert.match(hero, /const handleScroll = \(\) => \{[\s\S]*?alignedScrollRef[\s\S]*?scheduleStorySync\(true\)/);
  assert.match(hero, /window\.addEventListener\('resize', handleResize\)/);
  assert.match(hero, /window\.addEventListener\('pageshow', handlePageShow\)/);
  assert.match(hero, /if \(window\.scrollY > 4\) scheduleStorySync\(true\)/);
  assert.match(hero, /window\.removeEventListener\('resize', handleResize\)/);
  assert.match(hero, /window\.removeEventListener\('pageshow', handlePageShow\)/);
  const nativeScrollFlow = hero.slice(
    hero.indexOf('const scheduleStorySync = (claimControl: boolean)'),
    hero.indexOf('const storyGrid = storyGridRef.current'),
  );
  assert.doesNotMatch(nativeScrollFlow, /addEventListener\(['"](?:wheel|touchmove)|preventDefault|scrollTo\(|scrollIntoView\(|setInterval/);
  assert.doesNotMatch(hero, /PROMISE_STEP_INDEX|HERO_STORY_SCROLL_RATIO|data-story-complete|isStoryComplete|storyCompleteRef|completeStory|scrollAnchorRef|lastScrollYRef|storyHeightPx|setStoryHeightPx|isScrollDriven|alignRoleSection|getElementById\('choose-role'\)|scrollIntoView/);

  assert.match(hero, /const handleQuestionChange[\s\S]*?claimManualControl\(\);[\s\S]*?setActiveQuestion\(question\);[\s\S]*?updateStoryStep\(FEATURE_START_INDEX \+ index\)/);
  assert.match(hero, /const handlePreviewInteraction = \(source: 'pointer' \| 'focus'\)[\s\S]*?source === 'focus'[\s\S]*?claimManualControl\(\)/);
  assert.match(hero, /<HomeAssetPreview[\s\S]*?activeQuestion=\{activeQuestion\}[\s\S]*?onQuestionChange=\{handleQuestionChange\}[\s\S]*?onInteraction=\{handlePreviewInteraction\}/);
  assert.doesNotMatch(hero, /handlePlaybackToggle|onPlaybackToggle=|playbackId|setPlaybackId|key=\{playbackId\}/);
  assert.match(hero, /const handleRoleSkip = \(\) => \{[\s\S]*?claimManualControl\(\);[\s\S]*?\};/);
  const roleSkip = hero.slice(
    hero.indexOf('const handleRoleSkip = () => {'),
    hero.indexOf('const handleStoryFocus'),
  );
  assert.doesNotMatch(roleSkip, /updateStoryStep|scrollIntoView|completeStory/);
  assert.match(hero, /const handleStoryFocus = \(event: FocusEvent<HTMLDivElement>\)[\s\S]*?target\.closest\('\[data-story-pause-control\], \[data-story-start\], \[data-feature-playback\]'\)[\s\S]*?claimManualControl\(\)/);
  assert.match(hero, /className=\{styles\.storyHeroGrid\}[\s\S]*?onFocusCapture=\{handleStoryFocus\}/);

  assert.equal((hero.match(/className=\{styles\.storyHeroLogo\}/g) ?? []).length, 1);
  assert.match(hero, /className=\{styles\.storyHeroLogo\}[\s\S]*?src="\/brand\/aim4price-mark-black\.png"[\s\S]*?unoptimized[\s\S]*?className=\{styles\.storyHeroLogoImage\}/);
  assert.match(hero, /<div ref=\{assetMotionRef\} className=\{styles\.assetStageMotion\}>[\s\S]*?<HomeAssetPreview/);
  assert.doesNotMatch(hero, /shouldRenderPreview|\{shouldRenderPreview \?/);

  const featureStories = hero.slice(
    hero.indexOf('const FEATURE_STORIES'),
    hero.indexOf('const clampStoryIndex'),
  );
  for (const copy of [
    'Add your assets.',
    'Follow their changing value.',
    'Manage each asset in one place.',
    'Know what ownership costs.',
    'Keep maintenance on track.',
    'set budgets',
    'Get Estimate or manually',
    'Automatic depreciation',
    'updated usage',
    'equipment-specific checklists',
  ]) {
    assert.match(featureStories, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(featureStories, /[—–]/);
  assert.match(hero, /<aside[\s\S]*?className=\{styles\.featureNarrative\}[\s\S]*?aria-label="What Aim4price helps you do"/);
  assert.match(hero, /HERO_STAGES\.map\(\(question\) =>/);
  assert.match(hero, /data-active=\{isActive \? 'true' : 'false'\}/);
  assert.match(hero, /aria-hidden=\{!isActive \|\| storyMode !== 'features'\}/);
  assert.doesNotMatch(hero, /featureNarrativeEyebrow|feature\.eyebrow|eyebrow: string/);
  assert.match(hero, /<span>\/ 5<\/span>/);
  assert.match(hero, /aria-pressed=\{isPaused\}/);
  assert.match(hero, /\{isDesktopStory &&[\s\S]*?!isManuallyControlled &&[\s\S]*?!hasAutoplayFinished \? \(/);
  assert.match(hero, /data-story-pause-control/);
  assert.match(hero, /isPaused \? 'Continue animation' : 'Pause animation'/);

  assert.doesNotMatch(page, /<section[\s\S]*?id="choose-role"/);
  assert.match(roleSelector, /^'use client';/);
  assert.match(roleSelector, /<section[\s\S]*?id="choose-role"[\s\S]*?className=\{styles\.roleSection\}/);
  assert.match(roleSelector, /window\.location\.hash !== ROLE_SECTION_HASH/);
  assert.match(roleSelector, /addEventListener\('hashchange', focusHeadingWhenTargeted\)/);
  assert.match(roleSelector, /removeEventListener\('hashchange', focusHeadingWhenTargeted\)/);
  assert.doesNotMatch(roleSelector, /useState|return null|scrollIntoView/);
  assert.match(roleSelector, /id="choose-role-title"[\s\S]*?Which describes you best\?/);
  assert.match(roleSelector, /I own or manage assets/);
  assert.match(roleSelector, /I sell, service or support assets/);
  assert.equal((roleSelector.match(/<article\b/g) ?? []).length, 2);
  assert.doesNotMatch(roleSelector, /<Link\b|<a\b|<button\b|href=|onClick=|roleArrow|roleCta/);
  assert.match(roleSelector, /focus\(\{ preventScroll: true \}\)/);
  assert.match(auth, /accountType === "owner" \|\| accountType === "dealer"/);

  assert.deepEqual(
    [...preview.matchAll(/key: '([^']+)'/g)].map((match) => match[1]),
    ['worth', 'have', 'manage', 'cost', 'attention'],
  );
  assert.deepEqual(
    [...preview.matchAll(/label: '([^']+)'/g)].map((match) => match[1]),
    [
      'Add your assets',
      'Follow their changing value',
      'Manage each asset in one place',
      'Know what ownership costs',
      'Keep maintenance on track',
    ],
  );

  assert.match(preview, /role="tablist"[\s\S]*?aria-label="Explore the Aim4price asset record"/);
  assert.doesNotMatch(preview, /aria-orientation=/);
  assert.match(preview, /role="tab"/);
  assert.match(preview, /aria-selected=\{isActive\}/);
  assert.match(preview, /aria-controls="home-asset-preview"/);
  assert.match(preview, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(preview, /role=\{showRegister \? 'region' : 'tabpanel'\}/);
  assert.match(hero, /showRegister=\{storyStepIndex < FEATURE_START_INDEX\}/);
  assert.doesNotMatch(preview, /ExpandedPreview|openedQuestion|openPreview|aria-haspopup="dialog"|Click to open/);
  assert.match(preview, /case 'register':[\s\S]*?<RegisterPreview \/>/);
  assert.match(preview, /DEMO BUSINESS PTY LTD/);
  assert.doesNotMatch(preview, /visibility: 'hidden'/);
  assert.match(preview, /function RegisterActions/);
  assert.match(preview, /registerVat/);
  assert.match(preview, /registerRowFlags/);
  assert.match(preview, /<RegisterActions expanded\/>/);
  assert.match(preview, /Updated \{asset.updated\}/);
  assert.match(preview, /observer.disconnect\(\)/);

  assert.match(preview, /Register value[\s\S]*?R 359 550/);
  assert.match(preview, /tabIndex=\{0\}/);
  assert.match(preview, /className=\{styles\.assetHeroStage\}[\s\S]*?data-active-question=\{activeQuestion\}/);
  assert.match(preview, /aria-label=\{showRegister \? 'Asset Register preview' : undefined\}/);
  assert.match(preview, /aria-labelledby=\{showRegister \? undefined : `home-asset-question-/);
  assert.match(preview, /aria-label=\{question\.label\}/);
  assert.match(preview, /assetQuestionBubble} aria-hidden="true"/);
  assert.match(preview, /assetQuestionBubble[\s\S]*?question\.icon/);
  assert.doesNotMatch(preview, /styles\.assetQuestionLabel/);

  assert.doesNotMatch(preview, /assetActiveQuestion|assetStoryProgress|home-register-preview-label/);
  assert.doesNotMatch(preview, /assetStoryControls|assetPlaybackControl|feature animation|Show next feature/);
  assert.doesNotMatch(preview, /assetScrollCue|m7 9\.5 5 5 5-5/);
  assert.doesNotMatch(preview, /assetActiveQuestionAccent/);
  assert.match(preview, /ArrowRight[\s\S]*?ArrowDown/);
  assert.match(preview, /ArrowLeft[\s\S]*?ArrowUp/);
  assert.match(preview, /event\.key === 'Home'/);
  assert.match(preview, /event\.key === 'End'/);
  assert.match(preview, /type HomeAssetPreviewProps = \{[\s\S]*?activeQuestion: QuestionKey;[\s\S]*?onQuestionChange: \(question: QuestionKey, index: number\) => void;/);
  assert.match(preview, /onInteraction\?: \(source: 'pointer' \| 'focus'\) => void/);
  assert.doesNotMatch(preview, /canAutoplay|isAutoplaying|onPlaybackToggle|playbackLabel/);
  assert.match(preview, /export default function HomeAssetPreview\(\{[\s\S]*?activeQuestion,[\s\S]*?onQuestionChange,/);
  assert.match(preview, /onQuestionChange\(question\.key, index\)/);
  assert.match(preview, /onPointerEnter=\{\(\) => onInteraction\?\.\('pointer'\)\}/);
  assert.match(preview, /onFocusCapture=\{\(\) => onInteraction\?\.\('focus'\)\}/);
  assert.doesNotMatch(preview, /useState<QuestionKey>/);
  assert.doesNotMatch(preview, /setTimeout|setInterval|QUESTION_ROTATION|autoAdvance/);

  assert.match(preview, /switch \(activeQuestion\)/);
  assert.match(preview, /case 'worth':[\s\S]*?<WorthPreview \/>/);
  assert.match(preview, /case 'manage':[\s\S]*?<ManagePreview \/>/);
  assert.match(preview, /case 'cost':[\s\S]*?<CostPreview \/>/);
  assert.match(preview, /case 'attention':[\s\S]*?<AttentionPreview \/>/);
  assert.match(preview, /case 'have':[\s\S]*?<AssetCardPreview \/>/);

  // What do you have? — the approved Asset Register card, with the document column removed.
  assert.match(preview, /2023 Toyota Hilux Single Cab/);
  assert.match(preview, /R 237 150/);
  assert.match(preview, /R 450 000/);
  assert.match(preview, /113 677 km/);
  assert.match(preview, /\/brand\/home-asset-hilux-listing\.webp/);
  assert.match(preview, /alt="Left-side view of the white Toyota Hilux single-cab work vehicle"/);
  assert.match(preview, /width=\{1280\}[\s\S]*?height=\{960\}/);
  assert.doesNotMatch(preview, /assetDocumentsPanel|assetDocumentAction|0 Documents|View documents|\+ Add document/);
  assert.match(preview, /<AssetDetail label="Year" value="2023" \/>/);
  assert.match(preview, /<AssetDetail label="Licensed" value="✓" status \/>/);

  // Keep the valuation summary and use the exact supplied report screenshot.
  const worthPreview = preview.slice(
    preview.indexOf('function WorthPreview()'),
    preview.indexOf('function ManagePreview()'),
  );
  assert.doesNotMatch(worthPreview, /Aim4price estimate|Confidence: High|Updated 01 Sept 2026/);
  assert.match(worthPreview, /2023 Toyota Hilux Single&#160;Cab/);
  assert.match(worthPreview, /R 237 150/);
  assert.doesNotMatch(worthPreview, /R 239 454/);
  assert.match(worthPreview, /VAT excluded[\s\S]*?VAT included/);
  assert.match(worthPreview, /Estimate shown with VAT excluded\./);
  assert.match(worthPreview, /<MiniFact label="Replacement" value="R 450 000" \/>/);
  assert.doesNotMatch(worthPreview, /label="Replacement price"/);
  assert.match(worthPreview, /Asset Valuation Report preview/);
  assert.match(worthPreview, /src="\/brand\/home-asset-valuation-report\.png"/);
  assert.match(worthPreview, /width=\{786\}[\s\S]*?height=\{777\}[\s\S]*?unoptimized/);
  assert.doesNotMatch(worthPreview, /worthReportDetails|worthReportSummary|reportFrameRef/);
  assert.match(worthPreview, /Create Ad/);
  assert.match(worthPreview, /Save to Asset Register/);
  assert.match(worthPreview, /Download PDF/);

  // How can I manage it? — the same owner command set as the Asset Register.
  for (const action of [
    'Update asset',
    'Reports',
    'Add cost',
    'Add fuel',
    'Maintenance',
    'Asset map',
    'QR code',
    'Marketplace',
    'Add budget',
    'Manage pricing',
    'Dispose or remove asset',
  ]) {
    assert.match(preview, new RegExp(action));
  }
  assert.match(
    preview,
    /function ManagePreview\(\)[\s\S]*?Year Model: 2023 · Usage: 113 677 km · Condition: Good/,
  );
  assert.doesNotMatch(preview, /function ManagePreview\(\)[\s\S]*?Manage asset/);
  assert.doesNotMatch(preview, /function ManagePreview\(\)[\s\S]*?Choose what you want to do with this asset\./);

  // Reports use the actual asset report choices, not the Cost Ledger.
  const costPreview = preview.slice(
    preview.indexOf('function CostPreview()'),
    preview.indexOf('function AttentionPreview()'),
  );
  for (const label of ['Asset valuation', 'Maintenance report', 'Fuel report', 'Depreciation log', 'Cost of ownership', 'Asset map']) {
    assert.ok(costPreview.includes(label));
  }
  assert.match(costPreview, /AssetReportTypeIcon/);
  assert.match(costPreview, /Ownership costs and budgets/);
  assert.doesNotMatch(costPreview, /Cost tracking system|Invoice Drop|workspacePreview/);

  // Keep reported problems and completed work distinct on the same asset.
  const attentionPreview = preview.slice(
    preview.indexOf('function AttentionPreview()'),
    preview.indexOf('function MiniFact('),
  );
  assert.match(attentionPreview, /Year Model: 2023 · Usage: 113 677 km · Condition: Good/);
  assert.match(attentionPreview, /Maintenance serviced/);
  assert.match(attentionPreview, /Open issue reported/);
  assert.match(attentionPreview, /Maintenance has been done/);
  assert.match(attentionPreview, /issueCard/);
  assert.match(attentionPreview, /serviceCard/);
  assert.match(attentionPreview, /Reported by Demo operator/);
  assert.match(attentionPreview, /Serviced by Demo workshop/);
  assert.doesNotMatch(attentionPreview, /workspacePreview|Scheduled usage|Record service/);

  assert.doesNotMatch(preview, /assetConnectors|connectorPath|connectorDots|assetConnectorActive/);
  assert.match(preview, /role="status"/);
  assert.match(preview, /setFeedback\(QUESTION_FEEDBACK\[question\.key\]\)/);
  assert.match(preview, /\{feedback\}/);
  assert.doesNotMatch(preview, /assetActiveQuestion\} aria-live/);
  assert.match(preview, /aria-label=\{status \? \`\$\{label\}: yes\` : undefined\}/);

  const heroImages = await Promise.all(
    [
      'home-asset-hilux-listing.webp',
      'home-asset-hilux-thumb-side.webp',
      'home-asset-hilux-thumb-rear.webp',
      'home-asset-hilux-thumb-alt.webp',
    ].map((filename) => stat(new URL(`../public/brand/${filename}`, import.meta.url))),
  );
  assert.ok(heroImages[0].size > 80_000 && heroImages[0].size < 150_000);
  assert.ok(heroImages.slice(1).every(({ size }) => size > 15_000 && size < 50_000));

  const livingHeroStyles = styles.slice(
    styles.indexOf('/* === Living Asset Record homepage hero, September 2026 === */'),
  );
  const storyHeroStart = styles.indexOf(
    '/* === Timed and scroll-led Aim4price homepage story, September 2026 === */',
  );
  const storyHeroStyles = styles.slice(storyHeroStart);

  assert.ok(storyHeroStart >= 0);
  assert.match(livingHeroStyles, /\.assetPreviewActions \{[\s\S]*?pointer-events: none/);
  assert.doesNotMatch(livingHeroStyles, /\.assetDocumentsPanel|\.assetDocumentAction/);

  assert.match(storyHeroStyles, /\.heroStory \.heroMedia \.shell \{[\s\S]*?width: min\(calc\(100% - 3rem\), 1360px\)/);
  assert.doesNotMatch(storyHeroStyles, /\.heroStory \.heroMedia \.shell \{[^}]*100rem/s);
  assert.match(storyHeroStyles, /\.storyCopyLayer \{[\s\S]*?filter: blur\(2px\);[\s\S]*?opacity 820ms[\s\S]*?filter 820ms[\s\S]*?transform 820ms/);
  assert.match(storyHeroStyles, /\.heroBrandTitle > span,[\s\S]*?\.heroPromiseTitle span \{[\s\S]*?white-space: nowrap/);
  assert.match(storyHeroStyles, /\.heroBrandTitle \.openingProgress \{[\s\S]*?height: 2px[\s\S]*?linear-gradient\(90deg, #1ba677/);
  assert.match(storyHeroStyles, /\.storyHeroLogo \{[\s\S]*?filter: blur\(2px\);[\s\S]*?opacity 850ms[\s\S]*?filter 850ms/);
  assert.match(storyHeroStyles, /\.storyHeroLogo::before \{[\s\S]*?border-radius: 50%/);
  assert.match(storyHeroStyles, /\.storyHeroLogo::before \{[\s\S]*?radial-gradient\([\s\S]*?rgba\(89, 195, 155, 0\.22\)/);
  assert.doesNotMatch(storyHeroStyles, /\.storyHeroLogo::after/);
  assert.match(storyHeroStyles, /\.storyHeroLogoImage \{[\s\S]*?drop-shadow\(0 1\.2rem 0\.8rem rgba\(12, 67, 49, 0\.16\)\)/);
  assert.match(storyHeroStyles, /\.assetStageMotion \{[\s\S]*?filter: blur\(2px\);[\s\S]*?transform 760ms/);
  assert.match(storyHeroStyles, /\.featureNarrativeLayer \{[\s\S]*?filter: blur\(0\);[\s\S]*?opacity 180ms[\s\S]*?filter 180ms/);

  assert.match(storyHeroStyles, /\.heroSection\[data-story-step='brand'\] \.heroBrandCopy,[\s\S]*?\.heroSection\[data-story-step='preview'\] \.heroPromiseCopy \{[\s\S]*?filter: blur\(0\)/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-step='brand'\] \.storyHeroLogo \{[\s\S]*?filter: blur\(0\)[\s\S]*?scale\(1\)/);
  assert.match(storyHeroStyles, /\.heroPromiseTitle \{[\s\S]*?font-size: clamp\(3\.2rem, calc\(var\(--website-design-vw\) \* 3\.55\), 3\.55rem\);[\s\S]*?line-height: 1\.01/);
  assert.match(storyHeroStyles, /\.heroPromiseText \{[\s\S]*?max-width: 36rem;[\s\S]*?margin-top: 1\.85rem;[\s\S]*?line-height: 1\.6/);
  assert.match(styles, /\.heroStory \.heroActions \{[\s\S]*?gap: 1rem;[\s\S]*?margin-top: 1\.85rem/);
  assert.doesNotMatch(storyHeroStyles, /data-autoplay-finished='true'[^{]*\.storyHeroLogo/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-mode='preview'\] \.assetStageMotion,[\s\S]*?\.heroSection\[data-story-mode='features'\] \.assetStageMotion \{[\s\S]*?filter: blur\(0\)/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-mode='features'\] \.assetStageMotion \{[\s\S]*?translate3d\(var\(--asset-stage-shift-x\), 0, 0\)/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-mode='features'\] \.featureNarrative \{[\s\S]*?opacity: 1;[\s\S]*?filter: blur\(0\)/);
  assert.match(storyHeroStyles, /\.featureNarrativeCount \{[\s\S]*?position: relative;[\s\S]*?text-align: left/);

  const desktopStoryStyles = storyHeroStyles;
  assert.match(desktopStoryStyles, /\.heroStory \{[\s\S]*?min-height: calc\(var\(--website-design-vh\) \* 440\)/);
  assert.doesNotMatch(storyHeroStyles, /--hero-story-height|data-story-complete/);
  assert.match(desktopStoryStyles, /\.heroSticky \{[\s\S]*?position: sticky;[\s\S]*?top: 5\.75rem;[\s\S]*?height: calc\(calc\(var\(--website-design-vh\) \* 100\) - 5\.75rem\);[\s\S]*?overflow: hidden/);
  assert.match(desktopStoryStyles, /\.heroStory \.heroMedia \{[\s\S]*?min-height: 0;[\s\S]*?\}[\s\S]*?\.heroStory \.heroMedia\.heroSticky \{[\s\S]*?height: calc\(calc\(var\(--website-design-vh\) \* 100\) - 5\.75rem\)/);
  assert.doesNotMatch(desktopStoryStyles, /\.heroStory \.heroMedia \{[^}]*height: 100%/s);
  assert.match(desktopStoryStyles, /\.storyHeroGrid \{[\s\S]*?--hero-working-inset: clamp\(0px, calc\(\(100% - 1240px\) \/ 2\), 60px\);[\s\S]*?width: calc\(100% - var\(--hero-working-inset\)\);[\s\S]*?height: 100%;[\s\S]*?grid-template-columns: minmax\(446\.4px, 1fr\) minmax\(619\.2px, 49\.5rem\);[\s\S]*?gap: 40px/);
  assert.match(desktopStoryStyles, /\.heroCopyDeck \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 1/);
  assert.match(desktopStoryStyles, /\.storyHeroLogo,[\s\S]*?\.assetStageMotion,[\s\S]*?\.featureNarrative \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1/);
  assert.match(desktopStoryStyles, /\.assetStageMotion \{[\s\S]*?--asset-preview-center-inset: 2\.325rem;[\s\S]*?width: min\(45\.5rem, calc\(100% \+ 5rem\)\);[\s\S]*?justify-self: end/);
  assert.match(desktopStoryStyles, /\.featureNarrative \{[\s\S]*?--feature-copy-inset: 7\.75rem/);
  assert.match(desktopStoryStyles, /\.featureNarrativeLayer h2,[\s\S]*?\.featureNarrativeCopy,[\s\S]*?\.featureNarrativeCount \{[\s\S]*?inset-inline-start: calc\(0rem - var\(--feature-copy-inset\)\)/);
  assert.match(desktopStoryStyles, /\.heroStory \.assetQuestionGroup,[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?top: var\(--asset-preview-center-inset\);[\s\S]*?bottom: var\(--asset-preview-center-inset\)/);
  assert.match(desktopStoryStyles, /\.heroStory \.assetPreviewCard \{[\s\S]*?right: 3\.25rem;[\s\S]*?left: 5rem/);

  assert.match(hero, /<p>\{feature.body\}<\/p>[\s\S]*?<p>\{feature.detail\}<\/p>/);
  assert.match(styles, /\.featureNarrativeCopy p \+ p/);

  assertNoWebsiteReflow(storyHeroStyles);
  assert.doesNotMatch(storyHeroStyles, /@media[^\{]*(?:width|height)\s*:/);

  assert.doesNotMatch(storyHeroStyles, /scroll-snap|overscroll-behavior/);

  const reducedMotionStyles = storyHeroStyles.slice(
    storyHeroStyles.indexOf('@media (prefers-reduced-motion: reduce)'),
    storyHeroStyles.indexOf('@media (forced-colors: active)'),
  );
  assert.match(reducedMotionStyles, /\.storyCopyLayer,[\s\S]*?\.storyPauseControl \{[\s\S]*?animation: none !important;[\s\S]*?transition: none !important/);
  assert.match(reducedMotionStyles, /\.storyCopyLayer,[\s\S]*?\.featureNarrativeLayer \{[\s\S]*?filter: none !important/);
  assert.match(storyHeroStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroBrandCopy \{[\s\S]*?opacity: 1;[\s\S]*?\.storyHeroLogo \{[\s\S]*?opacity: 1;[\s\S]*?\.assetStageMotion \{[\s\S]*?transform: none !important;[\s\S]*?\.compactHeroActions \{[\s\S]*?display: flex/);
  assert.match(storyHeroStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.storyHeroLogo::before \{[\s\S]*?display: none/);
  assert.match(storyHeroStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroStory \.heroMedia\.heroSticky \{[\s\S]*?height: auto;[\s\S]*?overflow: hidden/);
  assert.match(storyHeroStyles, /@media \(forced-colors: active\)[\s\S]*?\.storyPauseControl \{[\s\S]*?border: 1px solid CanvasText/);
});
