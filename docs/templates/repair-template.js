/* Fix the rent-agreement DOCX template for docxtemplater.
 *
 * Root cause: docxtemplater default delimiters are single braces { }.
 * This template uses double braces {{...}} everywhere -> the lexer fails
 * with "Duplicate open tag / Duplicate close tag" (Multi error).
 * Loop tags {#x}/{/x} already use single braces and are fine.
 *
 * This script reads the pristine TOWER-1-804.docx and writes a repaired
 * TOWER-1-804-fixed.docx:
 *   1. convert {{ -> { and }} -> } inside every <w:t> text node
 *   2. normalize tag names so they match the admin form_data keys.
 *
 * Note: tags that Word split across multiple <w:r> runs are intentionally
 * left split - docxtemplater merges run text itself, so this is safe.
 */
const fs = require('fs');
const path = require('path');
const PizZip = require(path.resolve(__dirname, '../../backend/node_modules/pizzip'));

const SRC = path.resolve(__dirname, 'TOWER-1-804.docx');
const OUT = path.resolve(__dirname, 'TOWER-1-804-fixed.docx');

const zip = new PizZip(fs.readFileSync(SRC, 'binary'));
if (!zip.files['word/document.xml']) throw new Error('No word/document.xml in template');

let xml = zip.files['word/document.xml'].asText();
let changed = 0;

// Transform the text inside every <w:t ...>...</w:t> node only.
xml = xml.replace(/(<w:t\b[^>]*>)((?:(?!<\/w:t>)[\s\S])*?)(<\/w:t>)/g, (full, open, inner, close) => {
  if (!/[{}]/.test(inner)) return full;

  // 1) double braces -> single braces
  let text = inner.replace(/{{/g, '{').replace(/}}/g, '}');

  // 2) normalize tag names to match admin form_data keys
  const renames = [
    [/{\s*LICENSORS NAME\s*}/g, '{name}'],
    [/{\s*LICENSEE NAME\s*}/g, '{name}'],
    [/{\s*NAME\s*}/g, '{name}'],
    [/{\s*abbrevation\s*}/g, '{abbreviation}'],
    [/{\s*property address\s*}/g, '{PROPERTY_ADDRESS}'],
    [/{\s*PROPERTY ADDRESS\s*}/g, '{PROPERTY_ADDRESS}'],
  ];
  for (const [re, to] of renames) {
    text = text.replace(re, to);
  }

  if (text !== inner) changed++;
  return open + text + close;
});

if (changed === 0) {
  console.log('Nothing to repair (no double-brace tags found).');
} else {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer' });
  fs.writeFileSync(OUT, buf);
  console.log(`Repaired ${changed} w:t text node(s). Wrote ${OUT} (${buf.length} bytes)`);
}