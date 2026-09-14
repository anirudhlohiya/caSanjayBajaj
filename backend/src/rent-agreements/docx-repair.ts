import { DOMParser } from '@xmldom/xmldom';

export interface SanitizeResult {
  xml: string | null;
  error: string | null;
  changed: string[];
}

/**
 * Validate document.xml well-formedness and fix known structural problems so
 * Microsoft Word never rejects the generated package.
 *
 * Currently fixes:
 *  - html-to-docx emits <w:sectPr> as the FIRST child of <w:body>; the OOXML
 *    schema requires it to be the LAST child (sections wrap the paragraphs).
 *    Word reports "unspecified error / word/document.xml" for the wrong order.
 *
 * The sectPr move is done as a character-level string surgery so the rest of
 * the document.xml is preserved byte-for-byte (no reserialization side effects).
 * Returns the original XML unchanged when nothing needs fixing.
 */
export function sanitizeDocumentXml(input: string): SanitizeResult {
  const comments: string[] = [];
  let parseFailed = false;

  new DOMParser({
    errorHandler: (level: 'warning' | 'error' | 'fatalError', msg: string) => {
      if (level === 'error' || level === 'fatalError') {
        parseFailed = true;
        comments.push(`${level}: ${msg}`);
      }
    },
  }).parseFromString(input, 'application/xml');

  if (parseFailed) {
    return {
      xml: null,
      error: comments.join('; ') || 'XML parse failure',
      changed: comments,
    };
  }

  const fixed = moveSectPrToBodyEnd(input, comments);
  return { xml: fixed, error: null, changed: comments };
}

/**
 * If <w:body> is immediately followed (allow whitespace) by <w:sectPr>, move
 * that sectPr block to just before </w:body>. This matches html-to-docx output.
 */
function moveSectPrToBodyEnd(xml: string, comments: string[]): string {
  const bodyOpen = '<w:body>';
  const bodyIdx = xml.indexOf(bodyOpen);
  if (bodyIdx < 0) return xml;

  const afterBody = xml.slice(bodyIdx + bodyOpen.length);
  const sectPrStart = afterBody.search(/<w:sectPr\b/);
  if (sectPrStart < 0) return xml;

  const gap = afterBody.slice(0, sectPrStart);
  if (!/^\s*$/.test(gap)) {
    // sectPr is not the first immediate child of body - nothing to fix.
    return xml;
  }

  const sectPrEnd = afterBody.indexOf('</w:sectPr>', sectPrStart);
  if (sectPrEnd < 0) return xml;
  const sectPrEndFull = sectPrEnd + '</w:sectPr>'.length;

  const sectPrBlock = afterBody.slice(sectPrStart, sectPrEndFull);
  // head = original up to the sectPr block start (includes <w:body> + gap whitespace)
  const head = xml.slice(0, bodyIdx + bodyOpen.length + gap.length);
  // tail = everything after the sectPr block (paragraphs, closing tags)
  const tail = afterBody.slice(sectPrEndFull);

  const mid = head + tail; // original XML with the stray sectPr removed
  const bodyCloseIdx = mid.lastIndexOf('</w:body>');
  if (bodyCloseIdx < 0) return xml;

  const result =
    mid.slice(0, bodyCloseIdx) + sectPrBlock + mid.slice(bodyCloseIdx);
  comments.push('moved w:sectPr from first body child to last');
  return result;
}

export function checkDocumentXml(xml: string): string | null {
  const result = sanitizeDocumentXml(xml);
  return result.error;
}
