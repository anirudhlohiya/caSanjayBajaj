import { DOMParser } from '@xmldom/xmldom';

interface RunStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  fontFamily?: string;
  fontSizePt?: number;
}

function readRunStyle(rPr: Element | null): RunStyle {
  const s: RunStyle = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
  };
  if (!rPr) return s;
  s.bold = !!rPr.getElementsByTagName('w:b').length;
  if (!s.bold) s.bold = !!rPr.getElementsByTagName('w:bCs').length;
  s.italic = !!rPr.getElementsByTagName('w:i').length;
  if (!s.italic) s.italic = !!rPr.getElementsByTagName('w:iCs').length;
  s.underline = !!rPr.getElementsByTagName('w:u').length;
  s.strike = !!rPr.getElementsByTagName('w:strike').length;
  const sz = rPr.getElementsByTagName('w:sz')[0];
  if (sz) {
    const val = sz.getAttribute('w:val');
    if (val) s.fontSizePt = Number(val) / 2;
  }
  const fonts = rPr.getElementsByTagName('w:rFonts')[0];
  if (fonts) {
    s.fontFamily = fonts.getAttribute('w:ascii') ?? undefined;
  }
  return s;
}

function wrapWithStyle(s: RunStyle): string {
  const styles: string[] = [];
  if (s.fontFamily) styles.push(`font-family: ${s.fontFamily};`);
  if (s.fontSizePt) styles.push(`font-size: ${s.fontSizePt}pt;`);
  return styles.length ? ` style="${styles.join(' ')}"` : '';
}

function renderRun(run: Element): string {
  const rPr = run.getElementsByTagName('w:rPr')[0] ?? null;
  const s = readRunStyle(rPr);
  let inner = '';
  for (const child of Array.from(run.childNodes)) {
    const el = child as Element;
    const tag = el.tagName || '';
    const local = tag.split(':').pop() || '';
    if (el.nodeType === 3) {
      inner += (el as unknown as { data: string }).data ?? '';
    } else if (local === 't') {
      inner += el.textContent ?? '';
    } else if (local === 'tab') {
      inner += '    ';
    } else if (local === 'br') {
      if (el.getAttribute('w:type') === 'page')
        inner += '<div class="page-break"></div>';
      else inner += '<br />';
    } else if (local === 'noBreakHyphen') {
      inner += '-';
    }
  }
  if (!inner) return '';
  if (s.bold) inner = `<strong>${inner}</strong>`;
  if (s.italic) inner = `<em>${inner}</em>`;
  if (s.underline) inner = `<u>${inner}</u>`;
  if (s.strike) inner = `<s>${inner}</s>`;
  return `<span${wrapWithStyle(s)}>${inner}</span>`;
}

function renderInlineRuns(parent: Element): string {
  let out = '';
  for (const child of Array.from(parent.childNodes)) {
    const el = child as Element;
    const tag = el.tagName || '';
    const local = tag.split(':').pop() || '';
    if (el.nodeType === 3) {
      out += (el as unknown as { data: string }).data ?? '';
    } else if (local === 'r') {
      out += renderRun(el);
    } else if (local === 'hyperlink') {
      out += renderInlineRuns(el);
    } else if (local === 'smartTag') {
      out += renderInlineRuns(el);
    }
  }
  return out;
}

function renderParagraph(p: Element): string {
  const pPr = p.getElementsByTagName('w:pPr')[0] ?? null;

  let align = '';
  if (pPr) {
    const jc = pPr.getElementsByTagName('w:jc')[0];
    if (jc) {
      const v = jc.getAttribute('w:val') ?? '';
      if (v === 'center') align = 'center';
      else if (v === 'right') align = 'right';
      else if (v === 'both') align = 'justify';
    }
  }

  const alignStyle = align ? ` text-align: ${align};` : '';
  const style = ` style="margin: 0 0 6pt 0;${alignStyle}"`;

  let inner = '';

  for (const child of Array.from(p.childNodes)) {
    const el = child as Element;
    const tag = el.tagName || '';
    const local = tag.split(':').pop() || '';
    if (el.nodeType === 3) continue;
    if (local === 'r') {
      inner += renderRun(el);
    } else if (local === 'hyperlink' || local === 'smartTag') {
      inner += renderInlineRuns(el);
    }
  }

  return inner.trim() ? `<p${style}>${inner}</p>` : '';
}

function appendTextboxBlocks(p: Element, blocks: string[]): void {
  const txbxes: Element[] = [];
  for (const t of Array.from(p.getElementsByTagName('w:txbxContent')))
    txbxes.push(t);
  for (const t of Array.from(p.getElementsByTagName('wne:txbxContent')))
    txbxes.push(t);
  for (const txbx of txbxes) {
    for (const child of Array.from(txbx.getElementsByTagName('w:p'))) {
      blocks.push(renderParagraph(child));
    }
  }
}

function renderTableCell(tc: Element): string {
  const gridSpan = tc.getElementsByTagName('w:gridSpan')[0];
  const span = gridSpan ? ` colspan="${gridSpan.getAttribute('w:val')}"` : '';
  const content: string[] = [];
  for (const child of Array.from(tc.childNodes)) {
    const el = child as Element;
    const local = (el.tagName || '').split(':').pop() || '';
    if (local === 'p') content.push(renderParagraph(el));
    else if (local === 'tbl') content.push(renderTable(el));
  }
  return `<td${span}>${content.join('')}</td>`;
}

function renderTable(tbl: Element): string {
  const rows: string[] = [];
  for (const tr of Array.from(tbl.getElementsByTagName('w:tr'))) {
    const cells: string[] = [];
    for (const tc of Array.from(tr.getElementsByTagName('w:tc'))) {
      cells.push(renderTableCell(tc));
    }
    rows.push(`<tr>${cells.join('')}</tr>`);
  }
  return `<table style="border-collapse: collapse; width: 100%;"><tbody>${rows.join('')}</tbody></table>`;
}

export function docxToHtml(docxXml: string): string {
  const doc = new DOMParser().parseFromString(docxXml, 'text/xml');
  const body =
    doc.getElementsByTagName('w:body')[0] ??
    doc.getElementsByTagName('body')[0];
  if (!body) return '';

  const out: string[] = [];
  for (const node of Array.from(body.childNodes)) {
    const el = node as unknown as Element;
    const local = (el.tagName || '').split(':').pop() || '';
    if (local === 'p') {
      appendTextboxBlocks(el, out);
      out.push(renderParagraph(el));
    } else if (local === 'tbl') {
      out.push(renderTable(el));
    }
  }
  return out.join('\n');
}
