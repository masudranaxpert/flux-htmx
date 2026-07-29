import fs from 'fs';
import path from 'path';

const testDir = path.join(process.cwd(), 'test', 'unit');

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath));
    } else if (file.endsWith('.ts')) {
      results.push(filePath);
    }
  }
  return results;
}

const files = walk(testDir);

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');

  // htmx:beforeRequest -> htmx:before:request
  content = content.replace(/htmx:beforeRequest/g, 'htmx:before:request');
  
  // htmx:afterRequest -> htmx:after:request
  content = content.replace(/htmx:afterRequest/g, 'htmx:after:request');

  // htmx:beforeCleanupElement -> htmx:before:cleanup
  content = content.replace(/htmx:beforeCleanupElement/g, 'htmx:before:cleanup');
  content = content.replace(/htmx:before:cleanup:element/g, 'htmx:before:cleanup');

  fs.writeFileSync(file, content, 'utf-8');
}
console.log('Fixed test events');
