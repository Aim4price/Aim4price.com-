import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const client = readFileSync(
  new URL("../app/asset-registers/asset-registers-client.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/asset-registers/page.module.css", import.meta.url),
  "utf8",
);

const targetDropdown = client.slice(
  client.indexOf("type RegisterTargetDropdownProps"),
  client.indexOf("export default function AssetRegistersClient"),
);
const registerSearchMatcher = client.slice(
  client.indexOf("function matchesRegisterSearch"),
  client.indexOf("async function readJsonPayload"),
);

test("target register dropdown provides a searchable filtered list", () => {
  assert.match(targetDropdown, /const \[targetSearchTerm, setTargetSearchTerm\] = useState\(""\);/);
  assert.match(
    targetDropdown,
    /const visibleTargets = useMemo\([\s\S]*?targets\.filter\(\(target\) => matchesRegisterSearch\(target, targetSearchTerm\)\)/,
  );
  assert.match(registerSearchMatcher, /searchTerm\.trim\(\)\.toLowerCase\(\)/);
  assert.match(
    registerSearchMatcher,
    /register\.businessName,[\s\S]*?register\.email,[\s\S]*?register\.phone,[\s\S]*?register\.addressLine1/,
  );
  assert.match(targetDropdown, /\{visibleTargets\.map\(\(target\) =>/);
  assert.doesNotMatch(targetDropdown, /\{targets\.map\(\(target\) =>/);
  assert.match(targetDropdown, /type="search"/);
  assert.match(targetDropdown, /placeholder="Search asset registers\.\.\."/);
  assert.match(targetDropdown, /aria-label="Search target asset registers"/);
  assert.match(targetDropdown, /value=\{targetSearchTerm\}/);
  assert.match(targetDropdown, /onChange=\{\(event\) => setTargetSearchTerm\(event\.target\.value\)\}/);
  assert.match(targetDropdown, /aria-label="Clear target register search"/);
  assert.match(targetDropdown, /No asset registers match your search\./);
  assert.match(targetDropdown, /role="status" aria-live="polite"/);
});

test("target register search resets and remains open across the portalled menu", () => {
  assert.match(
    targetDropdown,
    /if \(!isOpen\) \{\s*setTargetSearchTerm\(""\);\s*return undefined;\s*\}/,
  );
  assert.match(
    targetDropdown,
    /function closeDropdown\(\{ restoreFocus = false \}: \{ restoreFocus\?: boolean \} = \{\}\) \{\s*setTargetSearchTerm\(""\);/,
  );
  assert.match(targetDropdown, /const targetSelectRef = useRef<HTMLDivElement \| null>\(null\);/);
  assert.match(targetDropdown, /const targetMenuRef = useRef<HTMLDivElement \| null>\(null\);/);
  assert.match(targetDropdown, /const targetTriggerRef = useRef<HTMLButtonElement \| null>\(null\);/);
  assert.match(targetDropdown, /const targetSearchInputRef = useRef<HTMLInputElement \| null>\(null\);/);
  assert.match(
    targetDropdown,
    /const animationFrame = window\.requestAnimationFrame\(\(\) => \{\s*targetSearchInputRef\.current\?\.focus\(\);/,
  );
  assert.doesNotMatch(targetDropdown, /autoFocus/);
  assert.match(
    targetDropdown,
    /!targetSelectRef\.current\?\.contains\(nextFocus\)[\s\S]*?!targetMenuRef\.current\?\.contains\(nextFocus\)/,
  );
  assert.match(targetDropdown, /anchorRef=\{targetTriggerRef\}/);
  assert.match(targetDropdown, /ref=\{targetMenuRef\}[^>]*onBlur=\{handleBlur\}/);
  assert.match(targetDropdown, /aria-controls=\{isOpen \? targetListboxId : undefined\}/);
  assert.match(targetDropdown, /aria-controls=\{targetListboxId\}/);
  assert.match(targetDropdown, /role="listbox" aria-label="Target asset registers"/);
  assert.match(targetDropdown, /role="option"[\s\S]*?aria-selected=/);
  assert.match(targetDropdown, /closeDropdown\(\{ restoreFocus: true \}\)/);
  assert.match(
    targetDropdown,
    /setTargetSearchTerm\(""\);\s*window\.requestAnimationFrame\(\(\) => targetSearchInputRef\.current\?\.focus\(\)\);/,
  );
});

test("target register search stays fixed while its results scroll", () => {
  assert.match(styles, /\.targetSelectMenu\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(
    styles,
    /\.targetSelectMenuContent\s*\{[\s\S]*?grid-template-rows:\s*auto minmax\(0, 1fr\);/,
  );
  assert.match(styles, /\.targetSelectSearch\s*\{[\s\S]*?grid-template-columns:/);
  assert.match(styles, /\.targetSelectSearch:focus-within\s*\{[\s\S]*?box-shadow:/);
  assert.match(styles, /\.targetSelectSearchInput::\-webkit-search-cancel-button\s*\{[\s\S]*?display:\s*none;/);
  assert.match(
    styles,
    /\.targetSelectOptions\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/,
  );
  assert.match(styles, /\.targetSelectEmpty\s*\{[\s\S]*?text-align:\s*center;/);
});
