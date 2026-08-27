import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL("../" + path, import.meta.url), "utf8");

const source = read("components/DealerMaintenanceTrackerClient.tsx");
const styles = read("components/DealerMaintenanceTrackerClient.module.css");

test("Dealer App summary cards omit supporting copy while Dealer Desktop keeps it", () => {
  for (const copy of [
    "Due, overdue, or awaiting usage.",
    "Show all equipment shared with you.",
    "Maintenance completed and saved.",
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

test("Dealer App and Dealer Desktop history type choices omit supporting copy", () => {
  assert.doesNotMatch(
    source,
    /All saved activity|Completed services and checkups|Problems and saved notes/,
  );
  assert.match(source, /!dealerAppMode \? \([\s\S]*?<HistoryRecordIcon/);
  assert.match(
    source,
    /<span className=\{styles\.historyChoiceCopy\}>[\s\S]*?<strong>\{option\.label\}<\/strong>/,
  );
  assert.match(
    styles,
    /\.historyTypeTabs button \{[\s\S]*?min-height: 5\.2rem/,
  );
});

test("Dealer App timeline is a required custom date range while Desktop keeps presets", () => {
  assert.match(source, /dealerAppMode \? 'Timeline' : 'Choose a timeline'/);
  assert.match(
    source,
    /setHistoryTimelineFilter\(dealerAppMode \? 'custom' : 'all'\)/,
  );
  assert.match(
    source,
    /!dealerAppMode \? \([\s\S]*?historyTimelineOptions\.map/,
  );
  assert.match(source, /dealerAppMode \|\| historyTimelineFilter === 'custom'/);
  assert.match(source, /max=\{historyToDate \|\| undefined\}/);
  assert.match(source, /min=\{historyFromDate \|\| undefined\}/);
  assert.match(
    source,
    /disabled=\{dealerAppMode \? !historyFromDate \|\| !historyToDate/,
  );
  assert.match(source, /historyFiltersActive && !dealerAppMode/);
  assert.match(
    styles,
    /\.dealerApp \.historyDateRange \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/,
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
