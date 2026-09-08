const fs = require('fs');
const path = require('path');

const mappings = {
  'bg-white': 'dark:bg-neutral-900',
  'text-neutral-950': 'dark:text-white',
  'text-neutral-900': 'dark:text-neutral-100',
  'text-neutral-800': 'dark:text-neutral-200',
  'text-neutral-700': 'dark:text-neutral-300',
  'text-neutral-600': 'dark:text-neutral-400',
  'text-neutral-500': 'dark:text-neutral-400',
  'border-neutral-50': 'dark:border-neutral-800',
  'border-neutral-100': 'dark:border-neutral-800',
  'border-neutral-200': 'dark:border-neutral-700',
  'bg-neutral-50': 'dark:bg-neutral-800/50',
  'bg-neutral-100': 'dark:bg-neutral-800',
  'bg-neutral-900': 'dark:bg-neutral-100 dark:text-neutral-900',
  'hover:bg-neutral-50': 'dark:hover:bg-neutral-800/50',
  'hover:bg-neutral-100': 'dark:hover:bg-neutral-800',
  'hover:bg-neutral-200': 'dark:hover:bg-neutral-700',
  'hover:bg-neutral-800': 'dark:hover:bg-neutral-200',
  'hover:text-neutral-900': 'dark:hover:text-white',
  'ring-neutral-200': 'dark:ring-neutral-700',
  'divide-neutral-50': 'dark:divide-neutral-800',
  'divide-neutral-100': 'dark:divide-neutral-800',
  'divide-neutral-200': 'dark:divide-neutral-700',
  'bg-red-50': 'dark:bg-red-900/20',
  'text-red-700': 'dark:text-red-400',
  'border-red-100': 'dark:border-red-900/50',
  'hover:bg-red-100': 'dark:hover:bg-red-900/40',
};

function fixClasses(html) {
  return html.replace(/class="([^"]+)"/g, (match, p1) => {
    let classes = p1.split(/\s+/).filter(c => c);
    let classSet = new Set(classes);
    let newClasses = [...classes];

    for (let c of classes) {
      if (mappings[c]) {
        let darkEquivalent = mappings[c];
        // Don't add if a dark equivalent for this property already exists
        // E.g. if we have text-neutral-950, mapping is dark:text-white
        // We shouldn't add it if another dark:text-* exists (unless it's the same, then just don't duplicate)
        let prefix = darkEquivalent.split('-')[0]; // e.g. dark:bg
        if (darkEquivalent.includes(':text-')) prefix = 'dark:text-';
        else if (darkEquivalent.includes(':bg-')) prefix = 'dark:bg-';
        else if (darkEquivalent.includes(':border-')) prefix = 'dark:border-';
        else if (darkEquivalent.includes(':divide-')) prefix = 'dark:divide-';
        
        let hasDarkEquiv = classes.some(existing => existing.startsWith(prefix));
        if (!hasDarkEquiv) {
          newClasses.push(darkEquivalent);
        }
      }
    }
    return `class="${newClasses.join(' ')}"`;
  });
}

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = fixClasses(content);
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

const targetDir = path.join(__dirname, '..', 'src', 'app', 'features');
processDir(targetDir);
