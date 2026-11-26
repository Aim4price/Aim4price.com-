import { Workbook, type Row } from 'exceljs';
import { assetColumns, columns, coreColumns, maxAssets, moneyColumns, sheetChoices, templateGuideTitle, type BuiltInColumn } from './asset-sheet';

const green = 'FF155541';
const ink = 'FF183D32';
const white = 'FFFFFFFF';
const mint = 'FFE9F3EE';

function shadeHeader(row: Row, color: string) {
  row.height = 30;
  row.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: white } };
    cell.alignment = { vertical: 'middle', indent: 1 };
  });
}

export function buildAssetTemplate() {
  const workbook = new Workbook();
  workbook.creator = 'Aim4price';
  const assets = workbook.addWorksheet('Assets', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    properties: { defaultRowHeight: 21, tabColor: { argb: green } },
  });
  const order = [...coreColumns, ...columns.filter(key => !coreColumns.includes(key))];
  assets.columns = order.map(key => ({
    key, header: assetColumns[key],
    width: key === 'title' || key.endsWith('Note') || key === 'note' ? 35 : Math.max(16, assetColumns[key].length + 7),
  }));
  const header = assets.getRow(1);
  shadeHeader(header, green);
  for (const key of order) {
    const col = assets.getColumn(key);
    if (!coreColumns.includes(key)) {
      header.getCell(col.number).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF486459' } };
    }
    if (moneyColumns.some(k => k === key)) col.numFmt = '#,##0.00';
    else if (key === 'usage' || key === 'year') col.numFmt = '0';
    else col.numFmt = '@';
  }
  assets.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: order.length } };
  for (const key of order) {
    const options = sheetChoices[key];
    if (!options) continue;
    for (let row = 2; row <= maxAssets + 1; row++) {
      assets.getCell(row, assets.getColumn(key).number).dataValidation = {
        type: 'list', allowBlank: true, formulae: ['"' + options.join(',') + '"'],
        showErrorMessage: key !== 'category', errorTitle: assetColumns[key], error: 'Choose a value from the list or leave this cell blank.',
      };
    }
  }
  const guide = workbook.addWorksheet('Guide', {
    views: [{ showGridLines: false }], properties: { defaultRowHeight: 24, tabColor: { argb: 'FF6B897C' } },
  });
  guide.columns = [{ width: 25 }, { width: 33 }, { width: 33 }];
  function band(text: string, color: string) {
    const row = guide.addRow([text]);
    guide.mergeCells(row.number, 1, row.number, 3);
    shadeHeader(row, color);
  }
  function instruction(label: string, copy: string) {
    const row = guide.addRow([label, copy]);
    guide.mergeCells(row.number, 2, row.number, 3);
    row.height = 37;
    row.eachCell((cell, index) => {
      cell.font = { name: 'Calibri', size: 12, bold: index === 1, color: { argb: ink } };
      cell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    });
  }
  band(templateGuideTitle, green);
  instruction('Where to start', 'Enter one asset per row on the Assets tab. Give it a name, or enter both Brand and Model.');
  instruction('What to fill in', 'Fill in the details you know. Leave unknown values blank. Paperwork and notes are optional.');
  instruction('Values in rand', 'Use the same VAT basis for current, replacement and insured values. Choose inclusive or exclusive when you review the sheet.');
  instruction('Usage', 'Pair each reading with hours, km or %. For a percentage, enter a whole number from 0 to 100.');
  instruction('When you are ready', 'Upload the workbook or paste the rows with their headings. Review up to ' + maxAssets + ' assets per upload.');
  guide.addRow([]);
  band('Example entries', green);
  const examples = guide.addRow(['Column', 'Truck example', 'Trailer example']);
  shadeHeader(examples, 'FF486459');
  const truck: Partial<Record<BuiltInColumn, string | number>> = {
    title: 'Delivery truck', category: 'Vehicle', make: 'Isuzu', model: 'FTR 850', year: 2021,
    serial: '001204', condition: 'Good', usage: 186000, unit: 'km', value: 580000, replacement: 950000,
  };
  const trailer: Partial<Record<BuiltInColumn, string | number>> = {
    title: 'Flatbed trailer', category: 'Vehicle', year: 2019, serial: '000982',
    condition: 'Fair', value: 135000, replacement: 210000,
  };
  for (const [i, key] of coreColumns.entries()) {
    const row = guide.addRow([assetColumns[key], truck[key], trailer[key]]);
    if (i % 2 === 0) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mint } };
  }
  return workbook;
}
