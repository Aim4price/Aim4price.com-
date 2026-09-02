import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage plays one slower timed tour, returns to its brand frame, then follows scroll in both directions', async () => {
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
  assert.deepEqual(featureSteps, ['have', 'worth', 'cost', 'manage', 'attention']);

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
  assert.match(hero, /<span>Aim4price\.com<\/span>/);
  assert.match(hero, /<span>Asset Management Software<\/span>/);
  assert.match(hero, /<span>built for South Africa\.<\/span>/);
  assert.match(hero, /Know what you have\./);
  assert.match(hero, /Know what it’s worth\./);
  assert.match(hero, /Know what it really costs\./);
  assert.match(hero, /every important asset one living record, connecting its/);
  assert.match(hero, /indicative value/);
  assert.match(hero, /documents, maintenance, fuel and ownership costs/);

  assert.match(hero, /<a[\s\S]*?href="#choose-role"[\s\S]*?className=\{styles\.primaryCta\}[\s\S]*?onClick=\{handleRoleSkip\}[\s\S]*?See Aim4price in Action/);
  assert.match(hero, /<Link href="\/valuation" className=\{styles\.secondaryCta\}>[\s\S]*?Get a Free Estimate/);
  assert.doesNotMatch(hero, /heroAudienceCta|heroSectors|Choose how you’ll use Aim4price|Agriculture|Construction|Industrial|Motor/);
  assert.match(hero, /useState\(0\)/);
  assert.match(hero, /useState<QuestionKey>\('have'\)/);
  assert.match(hero, /data-story-step=\{storyStep\}/);
  assert.match(hero, /data-story-mode=\{storyMode\}/);
  assert.match(hero, /data-active-question=\{activeQuestion\}/);
  assert.match(hero, /isAutoplaying && storyStepIndex >= FEATURE_START_INDEX/);
  assert.match(hero, /<HomeAssetPreview[\s\S]*?activeQuestion=\{activeQuestion\}[\s\S]*?onQuestionChange=\{handleQuestionChange\}/);

  assert.match(hero, /const FEATURE_START_INDEX = 3/);
  assert.match(hero, /HERO_FEATURE_DURATION_MS = 4800/);
  assert.match(hero, /brand: 3800,[\s\S]*?promise: 4800,[\s\S]*?preview: 3600/);
  for (const question of featureSteps) {
    assert.match(hero, new RegExp(`${question}: HERO_FEATURE_DURATION_MS`));
  }
  assert.match(hero, /window\.matchMedia\(REDUCED_MOTION_QUERY\)/);
  assert.match(hero, /window\.matchMedia\(CINEMATIC_STORY_QUERY\)/);
  assert.match(hero, /CINEMATIC_STORY_QUERY = '\(min-width: 1181px\) and \(min-height: 640px\)'/);
  assert.match(hero, /cinematicStoryMedia\.matches && !reducedMotionMedia\.matches/);
  assert.match(hero, /const \[isCinematicStory, setIsCinematicStory\] = useState\(false\)/);
  assert.match(hero, /data-story-capability=\{isCinematicStory \? 'cinematic' : 'static'\}/);
  assert.match(hero, /reducedMotionMedia\.addEventListener\('change', syncStoryCapability\)/);
  assert.match(hero, /cinematicStoryMedia\.addEventListener\('change', syncStoryCapability\)/);
  assert.match(hero, /if \(!supportsStory\) \{[\s\S]*?setIsAutoplaying\(false\)[\s\S]*?setIsManuallyControlled\(true\)[\s\S]*?updateStoryStep\(FEATURE_START_INDEX\)/);
  assert.match(hero, /const storyStep = HERO_STORY_STEPS\[storyStepIndex\]/);
  assert.match(hero, /window\.setTimeout\([\s\S]*?STORY_DURATIONS\[storyStep\]/);
  assert.match(hero, /const finishAutoplay = useCallback\(\(\) => \{[\s\S]*?autoplayFinishedRef\.current = true;[\s\S]*?setHasAutoplayFinished\(true\);[\s\S]*?setIsAutoplaying\(false\);[\s\S]*?setIsPaused\(false\);[\s\S]*?updateStoryStep\(0\)/);
  assert.match(hero, /storyStepIndex >= HERO_STORY_STEPS\.length - 1[\s\S]*?finishAutoplay\(\)/);
  assert.match(hero, /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?if \(autoplayFinishedRef\.current\) return/);
  const terminalAutoplay = hero.slice(
    hero.indexOf('if (storyStepIndex >= HERO_STORY_STEPS.length - 1)'),
    hero.indexOf('updateStoryStep(storyStepIndex + 1)'),
  );
  assert.doesNotMatch(terminalAutoplay, /completeStory\(/);
  assert.match(hero, /updateStoryStep\(storyStepIndex \+ 1\)/);
  assert.match(hero, /window\.clearTimeout\(timer\)/);
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
  assert.match(hero, /sectionTop = currentScrollY \+ section\.getBoundingClientRect\(\)\.top/);
  assert.match(hero, /stickyTop =\s*Number\.parseFloat\(window\.getComputedStyle\(sticky\)\.top\) \|\| 0/);
  assert.match(hero, /trackStart = sectionTop - stickyTop/);
  assert.match(hero, /trackTravel = Math\.max\([\s\S]*?1,[\s\S]*?section\.offsetHeight - sticky\.offsetHeight,[\s\S]*?\)/);
  assert.match(hero, /localScroll = Math\.max\([\s\S]*?0,[\s\S]*?Math\.min\(trackTravel, currentScrollY - trackStart\),[\s\S]*?\)/);
  assert.match(hero, /progress = localScroll \/ trackTravel/);
  assert.match(hero, /nextIndex = clampStoryIndex\([\s\S]*?Math\.floor\(progress \* HERO_STORY_STEPS\.length\),[\s\S]*?\)/);
  assert.match(hero, /if \(nextIndex !== storyStepRef\.current\) updateStoryStep\(nextIndex\)/);
  assert.match(hero, /if \(shouldClaimControl\) \{[\s\S]*?setHasAutoplayFinished\(true\);[\s\S]*?setIsManuallyControlled\(true\);[\s\S]*?setIsPaused\(false\);[\s\S]*?setIsAutoplaying\(false\)/);
  assert.match(hero, /const handleScroll = \(\) => scheduleStorySync\(true\)/);
  assert.match(hero, /window\.addEventListener\('resize', handleResize\)/);
  assert.match(hero, /window\.addEventListener\('pageshow', handlePageShow\)/);
  assert.match(hero, /if \(window\.scrollY > 4\) scheduleStorySync\(true\)/);
  assert.match(hero, /window\.removeEventListener\('resize', handleResize\)/);
  assert.match(hero, /window\.removeEventListener\('pageshow', handlePageShow\)/);
  assert.match(hero, /new ResizeObserver\(syncHeaderHeight\)/);
  assert.match(hero, /--home-header-height/);
  assert.match(hero, /new ResizeObserver\(scheduleMeasurement\)/);
  assert.match(hero, /observer\?\.observe\(storyGrid\)/);
  assert.match(hero, /observer\?\.observe\(assetMotion\)/);
  assert.match(hero, /if \(!isCinematicStory\) \{[\s\S]*?removeProperty\('--asset-stage-shift-x'\)/);
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
  assert.match(hero, /const handleStoryFocus = \(event: FocusEvent<HTMLDivElement>\)[\s\S]*?target\.closest\('\[data-story-pause-control\]'\)[\s\S]*?claimManualControl\(\)/);
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
    'One complete record for every asset.',
    'Understand what it’s worth.',
    'See what it really costs.',
    'Manage its entire working life.',
    'Bring the next action forward.',
    'serial or VIN',
    'valuation changes and depreciation history',
    'invoices, repairs, parts, fuel and recurring commitments',
    'listing, disposal or transfer',
    'overdue maintenance, licence and document dates',
  ]) {
    assert.match(featureStories, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(hero, /<aside[\s\S]*?className=\{styles\.featureNarrative\}[\s\S]*?aria-label="What Aim4price helps you do"/);
  assert.match(hero, /HERO_STAGES\.map\(\(question\) =>/);
  assert.match(hero, /data-active=\{isActive \? 'true' : 'false'\}/);
  assert.match(hero, /aria-hidden=\{!isActive \|\| storyMode !== 'features'\}/);
  assert.doesNotMatch(hero, /featureNarrativeEyebrow|feature\.eyebrow|eyebrow: string/);
  assert.match(hero, /<span>\/ 05<\/span>/);
  assert.match(hero, /aria-pressed=\{isPaused\}/);
  assert.match(hero, /\{isCinematicStory &&[\s\S]*?!isManuallyControlled &&[\s\S]*?!hasAutoplayFinished \? \(/);
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
  assert.match(roleSelector, /href="\/auth\?accountType=owner#signup"/);
  assert.match(roleSelector, /href="\/auth\?accountType=dealer#signup"/);
  assert.match(roleSelector, /focus\(\{ preventScroll: true \}\)/);
  assert.match(auth, /accountType === "owner" \|\| accountType === "dealer"/);

  assert.deepEqual(
    [...preview.matchAll(/key: '([^']+)'/g)].map((match) => match[1]),
    ['have', 'worth', 'cost', 'manage', 'attention'],
  );
  assert.deepEqual(
    [...preview.matchAll(/label: '([^']+)'/g)].map((match) => match[1]),
    [
      'Know what you have',
      'Know what it’s worth',
      'Know what it really costs',
      'Manage its working life',
      'See what needs attention',
    ],
  );

  assert.match(preview, /role="tablist"[\s\S]*?aria-label="Explore the Aim4price asset record"/);
  assert.doesNotMatch(preview, /aria-orientation=/);
  assert.match(preview, /role="tab"/);
  assert.match(preview, /aria-selected=\{isActive\}/);
  assert.match(preview, /aria-controls="home-asset-preview"/);
  assert.match(preview, /tabIndex=\{isActive \? 0 : -1\}/);
  assert.match(preview, /role="tabpanel"/);
  assert.match(preview, /tabIndex=\{0\}/);
  assert.match(preview, /className=\{styles\.assetHeroStage\}[\s\S]*?data-active-question=\{activeQuestion\}/);
  assert.match(preview, /aria-labelledby=\{\`home-asset-question-/);
  assert.match(preview, /aria-label=\{question\.label\}/);
  assert.match(preview, /assetQuestionBubble} aria-hidden="true"/);
  assert.match(preview, /assetQuestionBubble[\s\S]*?question\.icon/);
  assert.doesNotMatch(preview, /styles\.assetQuestionLabel/);
  assert.match(preview, /assetActiveQuestion/);
  assert.match(preview, /assetActiveQuestionMain/);
  assert.match(preview, /QUESTIONS\[activeIndex\]\?\.icon \?\? QUESTIONS\[0\]\.icon/);
  assert.match(preview, /QUESTIONS\[activeIndex\]\?\.label \?\? QUESTIONS\[0\]\.label/);
  assert.match(preview, /assetStoryProgress/);
  assert.match(preview, /assetStoryProgressActive/);
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

  // What is it worth? — the final estimate page.
  const worthPreview = preview.slice(
    preview.indexOf('function WorthPreview()'),
    preview.indexOf('function ManagePreview()'),
  );
  assert.doesNotMatch(worthPreview, /Aim4price estimate|Confidence: High|Updated 01 Sept 2026/);
  assert.match(worthPreview, /2023 Toyota Hilux Single Cab/);
  assert.match(worthPreview, /R 237 150/);
  assert.doesNotMatch(worthPreview, /R 239 454/);
  assert.match(worthPreview, /VAT excluded[\s\S]*?VAT included/);
  assert.match(worthPreview, /Estimate shown with VAT excluded\./);
  assert.match(worthPreview, /<MiniFact label="Replacement" value="R 450 000 excl\. VAT" \/>/);
  assert.doesNotMatch(worthPreview, /label="Replacement price"/);
  assert.match(worthPreview, /Asset Valuation Report preview/);
  assert.match(worthPreview, /Miniature Asset Valuation Report for the 2023 Toyota Hilux Single Cab/);
  assert.match(worthPreview, /src="\/brand\/aim4price-mark-black\.png"/);
  assert.match(worthPreview, /width=\{660\}[\s\S]*?height=\{515\}[\s\S]*?className=\{styles\.worthReportLogo\}/);
  assert.doesNotMatch(worthPreview, /worthReportLogo\}>A4<\/span>/);
  assert.match(worthPreview, /Asset Details/);
  assert.match(worthPreview, /Record Summary/);
  assert.match(worthPreview, /Client \/ Asset Owner/);
  assert.match(worthPreview, /Aim4price demo owner/);
  assert.match(worthPreview, /\/brand\/home-asset-hilux-thumb-side\.webp/);
  assert.match(worthPreview, /\/brand\/home-asset-hilux-thumb-rear\.webp/);
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
    'Remove asset',
  ]) {
    assert.match(preview, new RegExp(action));
  }
  assert.match(
    preview,
    /function ManagePreview\(\)[\s\S]*?Year Model: 2023 · Usage: 113 677 km · Condition: Good/,
  );
  assert.doesNotMatch(preview, /function ManagePreview\(\)[\s\S]*?Manage asset/);
  assert.doesNotMatch(preview, /function ManagePreview\(\)[\s\S]*?Choose what you want to do with this asset\./);
  assert.doesNotMatch(preview, /Dispose or remove asset/);

  // What does it cost me? — Fuel and ownership report choices.
  const costPreview = preview.slice(
    preview.indexOf('function CostPreview()'),
    preview.indexOf('function AttentionPreview()'),
  );
  assert.match(costPreview, /<h2>2023 Toyota Hilux Single Cab<\/h2>/);
  assert.match(costPreview, /Year Model: 2023 · Usage: 113 677 km · Condition: Good/);
  assert.doesNotMatch(costPreview, /previewEyebrow/);
  assert.doesNotMatch(costPreview, /See what the asset costs across fuel, maintenance and ownership\./);
  assert.doesNotMatch(costPreview, /reportRowHighlighted/);
  assert.match(costPreview, /Download maintenance report/);
  assert.match(costPreview, /Download fuel report/);
  assert.match(costPreview, /Download depreciation log/);
  assert.match(costPreview, /Download cost of ownership report/);

  // What needs attention? — the real open-issue presentation.
  const attentionPreview = preview.slice(
    preview.indexOf('function AttentionPreview()'),
    preview.indexOf('function MiniFact('),
  );
  assert.match(attentionPreview, /<h2>2023 Toyota Hilux Single Cab<\/h2>/);
  assert.match(attentionPreview, /Year Model: 2023 · Usage: 113 677 km · Condition: Good/);
  assert.match(attentionPreview, /R 237 150[\s\S]*?Excl\. VAT/);
  assert.match(attentionPreview, /Aim4price value[\s\S]*?Updated 01 Sept 2026/);
  assert.match(attentionPreview, /Share[\s\S]*?View details[\s\S]*?Manage/);
  assert.match(attentionPreview, /Open issue reported/);
  assert.match(attentionPreview, /Lisensie disk het verval 2025/);
  assert.match(attentionPreview, /Sitplek kort aandag/);
  assert.match(attentionPreview, /Maintenance has been done/);
  assert.match(attentionPreview, /Changed engine oil/);
  assert.match(attentionPreview, /By Gerald · 29 Aug 2026/);
  assert.doesNotMatch(attentionPreview, /2024 Landini Super 110 \+ Front Loader/);
  assert.doesNotMatch(attentionPreview, /20 741 hours|R 446 250/);

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
  assert.match(storyHeroStyles, /\.storyCopyLayer \{[\s\S]*?filter: blur\(14px\);[\s\S]*?opacity 820ms[\s\S]*?filter 820ms[\s\S]*?transform 820ms/);
  assert.match(storyHeroStyles, /\.heroBrandTitle span,[\s\S]*?\.heroPromiseTitle span \{[\s\S]*?white-space: nowrap/);
  assert.match(storyHeroStyles, /\.heroBrandTitle span:first-child::after \{[\s\S]*?content: ''[\s\S]*?linear-gradient\(90deg, #1ba677/);
  assert.match(storyHeroStyles, /\.storyHeroLogo \{[\s\S]*?filter: blur\(14px\);[\s\S]*?opacity 850ms[\s\S]*?filter 850ms/);
  assert.match(storyHeroStyles, /\.storyHeroLogo::before \{[\s\S]*?border-radius: 50%/);
  assert.match(storyHeroStyles, /\.storyHeroLogo::before \{[\s\S]*?radial-gradient\([\s\S]*?rgba\(89, 195, 155, 0\.22\)/);
  assert.doesNotMatch(storyHeroStyles, /\.storyHeroLogo::after/);
  assert.match(storyHeroStyles, /\.storyHeroLogoImage \{[\s\S]*?drop-shadow\(0 1\.2rem 0\.8rem rgba\(12, 67, 49, 0\.16\)\)/);
  assert.match(storyHeroStyles, /\.assetStageMotion \{[\s\S]*?filter: blur\(14px\);[\s\S]*?transform 940ms/);
  assert.match(storyHeroStyles, /\.featureNarrativeLayer \{[\s\S]*?filter: blur\(12px\);[\s\S]*?opacity 700ms[\s\S]*?filter 700ms/);

  assert.match(storyHeroStyles, /\.heroSection\[data-story-step='brand'\] \.heroBrandCopy,[\s\S]*?\.heroSection\[data-story-step='preview'\] \.heroPromiseCopy \{[\s\S]*?filter: blur\(0\)/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-step='brand'\] \.storyHeroLogo,[\s\S]*?\.heroSection\[data-story-step='promise'\] \.storyHeroLogo \{[\s\S]*?filter: blur\(0\)[\s\S]*?scale\(1\)/);
  assert.match(storyHeroStyles, /\.heroPromiseTitle \{[\s\S]*?font-size: clamp\(2\.65rem, 2\.95vw, 2\.95rem\);[\s\S]*?line-height: 1\.01/);
  assert.match(storyHeroStyles, /\.heroPromiseText \{[\s\S]*?max-width: 33\.5rem;[\s\S]*?margin-top: 1\.85rem;[\s\S]*?line-height: 1\.6/);
  assert.match(styles, /\.heroStory \.heroActions \{[\s\S]*?gap: 1rem;[\s\S]*?margin-top: 1\.85rem/);
  assert.doesNotMatch(storyHeroStyles, /data-autoplay-finished='true'[^{]*\.storyHeroLogo/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-mode='preview'\] \.assetStageMotion,[\s\S]*?\.heroSection\[data-story-mode='features'\] \.assetStageMotion \{[\s\S]*?filter: blur\(0\)/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-mode='features'\] \.assetStageMotion \{[\s\S]*?translate3d\(var\(--asset-stage-shift-x\), 0, 0\)/);
  assert.match(storyHeroStyles, /\.heroSection\[data-story-mode='features'\] \.featureNarrative \{[\s\S]*?opacity: 1;[\s\S]*?filter: blur\(0\)/);
  assert.match(storyHeroStyles, /data-autoplay='true'[\s\S]*?assetStoryProgressActive::after \{[\s\S]*?animation-duration: 4800ms/);
  assert.match(storyHeroStyles, /\.featureNarrativeCount \{[\s\S]*?position: absolute;[\s\S]*?top: 0\.35rem;[\s\S]*?bottom: auto/);

  const desktopStoryStyles = storyHeroStyles.slice(
    storyHeroStyles.indexOf('@media (min-width: 1181px) and (min-height: 640px)'),
    storyHeroStyles.indexOf('@media (min-width: 1181px) and (max-width: 1360px)'),
  );
  assert.match(desktopStoryStyles, /\.heroStory \{[\s\S]*?min-height: 440svh/);
  assert.doesNotMatch(storyHeroStyles, /--hero-story-height|data-story-complete/);
  assert.match(desktopStoryStyles, /\.heroSticky \{[\s\S]*?position: sticky;[\s\S]*?top: var\(--home-header-height, 5\.75rem\);[\s\S]*?height: calc\(100dvh - var\(--home-header-height, 5\.75rem\)\);[\s\S]*?overflow: hidden/);
  assert.match(desktopStoryStyles, /\.heroStory \.heroMedia \{[\s\S]*?min-height: 0;[\s\S]*?\}[\s\S]*?\.heroStory \.heroMedia\.heroSticky \{[\s\S]*?height: calc\(100dvh - var\(--home-header-height, 5\.75rem\)\)/);
  assert.doesNotMatch(desktopStoryStyles, /\.heroStory \.heroMedia \{[^}]*height: 100%/s);
  assert.match(desktopStoryStyles, /\.storyHeroGrid \{[\s\S]*?--hero-working-inset: clamp\(0px, calc\(\(100% - 1240px\) \/ 2\), 60px\);[\s\S]*?width: calc\(100% - var\(--hero-working-inset\)\);[\s\S]*?height: 100%;[\s\S]*?grid-template-columns: minmax\(31rem, 1fr\) minmax\(39rem, 49\.5rem\);[\s\S]*?gap: clamp\(2\.5rem, 3vw, 3\.5rem\);[\s\S]*?margin-inline-start: var\(--hero-working-inset\)/);
  assert.match(desktopStoryStyles, /\.heroCopyDeck \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 1/);
  assert.match(desktopStoryStyles, /\.storyHeroLogo,[\s\S]*?\.assetStageMotion,[\s\S]*?\.featureNarrative \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1/);
  assert.match(desktopStoryStyles, /\.assetStageMotion \{[\s\S]*?--asset-preview-center-inset: 2\.325rem;[\s\S]*?width: min\(45\.5rem, calc\(100% \+ 7rem\)\);[\s\S]*?justify-self: end/);
  assert.match(desktopStoryStyles, /\.featureNarrative \{[\s\S]*?--feature-copy-inset: clamp\(5\.5rem, 8vw, 7\.75rem\)/);
  assert.match(desktopStoryStyles, /\.featureNarrativeLayer h2,[\s\S]*?\.featureNarrativeLayer > p:last-child \{[\s\S]*?inset-inline-start: calc\(0rem - var\(--feature-copy-inset\)\)/);
  assert.match(desktopStoryStyles, /\.heroStory \.assetQuestionGroup,[\s\S]*?\.heroStory \.assetPreviewCard \{[\s\S]*?top: var\(--asset-preview-center-inset\);[\s\S]*?bottom: var\(--asset-preview-center-inset\)/);
  assert.match(desktopStoryStyles, /\.heroStory \.assetActiveQuestion \{[\s\S]*?top: calc\(-4\.25rem \+ var\(--asset-preview-center-inset\)\);[\s\S]*?bottom: auto/);
  assert.match(desktopStoryStyles, /\.heroStory \.assetPreviewCard,[\s\S]*?\.heroStory \.assetActiveQuestion \{[\s\S]*?right: 3\.25rem;[\s\S]*?left: 5rem/);

  const mediumDesktopStoryStyles = storyHeroStyles.slice(
    storyHeroStyles.indexOf('@media (min-width: 1181px) and (max-width: 1360px)'),
    storyHeroStyles.indexOf('@media (min-width: 1181px) and (max-width: 1240px)'),
  );
  assert.match(mediumDesktopStoryStyles, /\.heroStory \.heroMedia \.shell \{[\s\S]*?width: min\(calc\(100% - 3rem\), 1360px\)/);
  assert.match(mediumDesktopStoryStyles, /\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(27rem, 31rem\) minmax\(34rem, 44rem\)/);
  assert.match(mediumDesktopStoryStyles, /\.assetStageMotion \{[\s\S]*?width: min\(44rem, calc\(100% \+ 6rem\)\);[\s\S]*?justify-self: end/);
  assert.match(storyHeroStyles, /@media \(min-width: 1181px\) and \(max-width: 1240px\) and \(min-height: 640px\)[\s\S]*?\.storyHeroGrid \{[\s\S]*?--hero-working-inset: 8px/);
  assert.match(storyHeroStyles, /@media \(min-width: 1181px\) and \(min-height: 640px\) and \(max-height: 759px\)[\s\S]*?\.assetStageMotion \{[\s\S]*?width: min\(43rem, calc\(100% \+ 5rem\)\)/);

  const chosenCompactStart = storyHeroStyles.indexOf(
    '/* The #543 desktop composition is the default.',
  );
  const chosenCompactEnd = storyHeroStyles.indexOf(
    '/* Static-wide is the sole fallback',
    chosenCompactStart,
  );
  assert.ok(chosenCompactStart >= 0 && chosenCompactEnd > chosenCompactStart);
  const chosenCompactStyles = storyHeroStyles.slice(chosenCompactStart, chosenCompactEnd);
  assert.match(chosenCompactStyles, /@media \(min-width: 1181px\) and \(min-height: 640px\)/);
  assert.match(chosenCompactStyles, /\.page\[data-home-display-size='small'\] \.heroStory \.heroMedia \.shell \{[\s\S]*?width: min\(calc\(100% - 2\.25rem\), 1280px\)/);
  assert.match(chosenCompactStyles, /\.page\[data-home-display-size='small'\] \.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(26rem, 1fr\) minmax\(32rem, 40rem\)/);
  assert.match(chosenCompactStyles, /\.page\[data-home-display-size='small'\] \.assetStageMotion \{[\s\S]*?width: min\(39\.5rem, calc\(100% \+ 3\.5rem\)\)/);
  assert.match(chosenCompactStyles, /\.page\[data-home-display-size='compact'\] \.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(28rem, 1fr\) minmax\(36rem, 44\.5rem\)/);
  assert.match(chosenCompactStyles, /\.page\[data-home-display-size='compact'\] \.assetStageMotion \{[\s\S]*?width: min\(44\.5rem, calc\(100% \+ 4rem\)\)/);
  assert.doesNotMatch(storyHeroStyles, /Compact laptop density contract, September 2026|max-width: 1599px|max-height: 899px/);

  assert.doesNotMatch(storyHeroStyles, /@media \(min-width: 901px\) and \(max-width: 1180px\)/);
  assert.doesNotMatch(storyHeroStyles, /top: 8\.4rem|height: calc\(100dvh - 8\.4rem\)/);

  const compactStoryStyles = storyHeroStyles.slice(
    storyHeroStyles.indexOf('@media (max-width: 1180px), (max-height: 639px)'),
    storyHeroStyles.indexOf('@media (max-width: 760px)'),
  );
  assert.match(compactStoryStyles, /\.heroStory \{[\s\S]*?min-height: 0 !important/);
  assert.match(compactStoryStyles, /\.heroSticky \{[\s\S]*?position: relative;[\s\S]*?top: auto;[\s\S]*?height: auto/);
  assert.match(compactStoryStyles, /\.storyHeroGrid \{[\s\S]*?grid-template-columns: minmax\(30rem, 1\.25fr\) minmax\(18rem, 0\.75fr\)/);
  assert.match(compactStoryStyles, /\.heroBrandCopy \{[\s\S]*?opacity: 1;[\s\S]*?filter: none/);
  assert.match(compactStoryStyles, /\.heroPromiseCopy \{[\s\S]*?display: none/);
  assert.match(compactStoryStyles, /\.storyHeroLogo \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 1;[\s\S]*?opacity: 1;[\s\S]*?filter: none/);
  assert.match(compactStoryStyles, /\.storyHeroLogo::before \{[\s\S]*?display: none/);
  assert.match(compactStoryStyles, /\.assetStageMotion \{[\s\S]*?grid-column: 1;[\s\S]*?grid-row: 2;[\s\S]*?opacity: 1;[\s\S]*?transform: none !important/);
  assert.match(compactStoryStyles, /\.featureNarrative \{[\s\S]*?grid-column: 2;[\s\S]*?grid-row: 2;[\s\S]*?opacity: 1;[\s\S]*?filter: none/);
  assert.match(compactStoryStyles, /\.compactHeroActions \{[\s\S]*?grid-column: 1 \/ -1;[\s\S]*?grid-row: 3;[\s\S]*?display: flex/);
  assert.match(compactStoryStyles, /\.storyPauseControl \{[\s\S]*?display: none/);

  assert.match(storyHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(storyHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.heroBrandTitle span \{[\s\S]*?white-space: normal/);
  assert.match(storyHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetQuestionGroup \{[\s\S]*?repeat\(5, minmax\(0, 1fr\)\)[\s\S]*?order: 1/);
  assert.match(storyHeroStyles, /@media \(max-width: 760px\)[\s\S]*?\.assetActiveQuestion \{[\s\S]*?display: none/);
  assert.match(storyHeroStyles, /@media \(max-width: 340px\)[\s\S]*?\.compactHeroActions \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(storyHeroStyles, /scroll-snap|overscroll-behavior/);

  const reducedMotionStyles = storyHeroStyles.slice(
    storyHeroStyles.indexOf('@media (prefers-reduced-motion: reduce)'),
    storyHeroStyles.indexOf('@media (forced-colors: active)'),
  );
  assert.match(reducedMotionStyles, /\.storyCopyLayer,[\s\S]*?\.storyPauseControl,[\s\S]*?\{[\s\S]*?animation: none !important;[\s\S]*?transition: none !important/);
  assert.match(reducedMotionStyles, /\.storyCopyLayer,[\s\S]*?\.featureNarrativeLayer \{[\s\S]*?filter: none !important/);
  assert.match(storyHeroStyles, /@media \(max-width: 1180px\), \(max-height: 639px\), \(prefers-reduced-motion: reduce\)[\s\S]*?\.heroStory \.heroMedia\.heroSticky \{[\s\S]*?height: auto;[\s\S]*?overflow: hidden/);
  assert.doesNotMatch(storyHeroStyles, /@media \(prefers-reduced-motion: reduce\) and \(min-width:/);
  assert.match(storyHeroStyles, /@media \(forced-colors: active\)[\s\S]*?\.storyPauseControl \{[\s\S]*?border: 1px solid CanvasText/);
});
