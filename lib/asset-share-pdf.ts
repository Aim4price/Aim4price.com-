/** Bundle only the already-selected, authorised files. No extra data is fetched. */
export async function createAssetSharePdf(message: string, files: File[], title: string): Promise<File> {
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('This device cannot prepare the sharing PDF.');
  const reset = () => {
    ctx.fillStyle = '#ffffff';ctx.fillRect(0,0,1200,1600);
    ctx.fillStyle = '#123e31';ctx.font = 'bold 32px Arial';ctx.fillText('AIM4PRICE · ASSET SHARE',70,70);
    ctx.fillStyle = '#263e35';ctx.font = '28px Arial';
  };
  const addCanvas = async () => {
    const blob = await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not prepare PDF page.')),'image/jpeg',.9));
    const image = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([600,800]);page.drawImage(image,{x:0,y:0,width:600,height:800});
  };
  // Browser text rendering preserves Unicode and the user's exact edited message.
  reset();let y=135;
  for (const block of message.split(/(?=^\d+\. )/m)) {
    const lines: string[] = [];let line='';
    for (const char of block) {
      if (char==='\n') { lines.push(line);line='';continue; }
      if (ctx.measureText(line+char).width>1060) { lines.push(line);line=''; }
      line+=char;
    }
    if(line) lines.push(line);
    // Keep a normal asset's heading and facts together when they fit on one page.
    if (lines.length<=35 && y>135 && y+(lines.length-1)*40>1510) { await addCanvas();reset();y=135; }
    for(const text of lines) {
      if(y>1510) { await addCanvas();reset();y=135; }
      ctx.fillText(text,70,y);y+=40;
    }
  }
  await addCanvas();
  for(const file of files) {
    const bytes=await file.arrayBuffer();
    if(file.type==='application/pdf') {
      let report;
      try { report=await PDFDocument.load(bytes); }
      catch { throw Error(`“${file.name}” cannot be included in the PDF. Remove this report or choose another copy.`); }
      const pages=await pdf.copyPages(report,report.getPageIndices());pages.forEach(page=>pdf.addPage(page));
    } else if(file.type==='image/jpeg'||file.type==='image/png') {
      const image=file.type==='image/png'?await pdf.embedPng(bytes):await pdf.embedJpg(bytes);
      const page=pdf.addPage([600,800]);
      const scale=Math.min(560/image.width,760/image.height);
      const width=image.width*scale,height=image.height*scale;
      page.drawImage(image,{x:(600-width)/2,y:(800-height)/2,width,height});
    } else {
      throw Error(`“${file.name}” cannot be included in a PDF. Only photos and PDF reports are supported.`);
    }
  }
  const bytes=await pdf.save();
  if(bytes.length>25*1024*1024) throw Error('This PDF is larger than 25 MB. Select fewer photos or reports and try again.');
  const name=title.replace(/[^a-zA-Z0-9-]+/g,'-').slice(0,80)||'assets';
  return new File([new Uint8Array(bytes)],`${name}-asset-share.pdf`,{type:'application/pdf'});
}
