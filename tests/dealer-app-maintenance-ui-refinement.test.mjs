import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const source = read("components/DealerMaintenanceTrackerClient.tsx");
const styles = read("components/DealerMaintenanceTrackerClient.module.css");

test("Dealer App summary cards omit supporting copy while Dealer Desktop keeps it", () => {
  for (const copy of [
    "Overdue, due soon, or waiting for a usage reading.",
    "Show all equipment shared with you.",
    "No current maintenance requires attention.",
  ]) {
    const escaped = copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      source,
      new RegExp(`!dealerAppMode \\? <span[^>]*>[\\s\\S]*?${escaped}`),
    );
  }
});

test("Dealer App filter is concise, uses both native dropdowns, and applies both drafts", () => {
  assert.match(
    source,
    /dealerAppMode \? 'Filter' : 'Filter tracked equipment'/,
  );
  assert.match(source, /nativeSelect=\{dealerAppMode\}/g);
  assert.match(source, /onChange=\{setDraftOwnerFilter\}/);
  assert.match(source, /setDraftStatusFilter\(value as TrackerStatusFilter\)/);
  assert.match(
    source,
    /setOwnerFilter\(draftOwnerFilter\); setStatusFilter\(draftStatusFilter\)/,
  );
  assert.match(
    styles,
    /\.dealerApp \.trackerFilterForm\.trackerFilterForm \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
  );
  assert.match(
    styles,
    /\.dealerApp \.trackerFilterForm select \{[\s\S]*?min-height: 3\.4rem/,
  );
});

test("Dealer App history choices are text-first while Dealer Desktop retains its detail", () => {
  assert.match(source, /dealerAppMode \? 'Timeline' : 'Choose a timeline'/);
  assert.match(source, /!dealerAppMode \? \([\s\S]*?<HistoryRecordIcon/);
  assert.match(source, /!dealerAppMode \? <small>\{option\.value === 'all'/);
  assert.match(
    source,
    /!dealerAppMode \? \([\s\S]*?<HistoryTimelineChoiceIcon/,
  );
  assert.match(source, /!dealerAppMode \? <ChevronRightIcon/);
  assert.match(
    styles,
    /\.dealerApp \.historyTypeTabs button \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/,
  );
  assert.match(
    styles,
    /\.dealerApp \.historyChoiceModal \.historyTimelineFilters button \{[\s\S]*?place-items: center/,
  );
});

test("Dealer App history results use narrow-screen-safe alignment without changing desktop rules", () => {
  assert.match(
    styles,
    /\.dealerApp \.historyTimelineItem \{[\s\S]*?grid-template-columns: 1rem minmax\(0, 1fr\)/,
  );
  assert.match(
    styles,
    /\.dealerApp \.historyTimelineMeta \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/,
  );
  assert.match(
    styles,
    /\.dealerApp \.historyTimelineEntry \.recordCard > header,[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/,
  );
  assert.match(
    styles,
    /@media \(max-width: 380px\)[\s\S]*?\.dealerApp \.historyTimelineMeta \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
  );
  assert.match(
    styles,
    /\.dealerDesktop \.trackerManageModal\.trackerManageModal/,
  );
});
