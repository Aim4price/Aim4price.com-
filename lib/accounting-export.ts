// Excel exports in ZA commonly use semicolons when the decimal separator is a comma.
export function parseExport(input:string,delimiter:string):string[][] {
  if(![',',';','\t'].includes(delimiter) || input.length>2_000_000) throw new Error('Choose a smaller delimited file.');
  const text=input.replace(/^\uFEFF/,'');
  let field='', quoted=false, closed=false;
  let row:string[]=[];
  const rows:string[][]=[];
  function endRow() {
    row.push(field);
    if(row.some(v=>v.trim())) rows.push(row);
    if(rows.length>5001) throw new Error('Use up to 5,000 supplier lines.');
    row=[]; field=''; closed=false;
  }
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch!=='"') field+=ch;
      else if(text[i+1]==='"') {field+='"';i++;}
      else {quoted=false;closed=true;}
    } else if(ch===delimiter) {
      row.push(field); field=''; closed=false;
      if(row.length>100) throw new Error('Too many columns.');
    } else if(ch==='\n' || ch==='\r') {
      if(ch==='\r' && text[i+1]==='\n') i++;
      endRow();
    } else if(ch==='"' && !closed && !field) quoted=true;
    else if(closed || ch==='"') throw new Error('Check the delimiter and quotation marks.');
    else field+=ch;
  }
  if(quoted) throw new Error('Incomplete quoted field.');
  endRow();
  if(rows.length<2 || rows[0].length<3 || rows.some(r=>r.length!==rows[0].length)) throw new Error('Choose a file with headings and consistent detail columns.');
  return rows;
}
