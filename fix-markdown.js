#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Common markdown linting fixes
function fixMarkdownContent(content) {
  let fixed = content;

  // Fix 1: Add blank lines around headings
  fixed = fixed.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  fixed = fixed.replace(/(#{1,6}.*)\n([^\n])/g, '$1\n\n$2');

  // Fix 2: Add blank lines around lists
  fixed = fixed.replace(/([^\n])\n([*-+]\s)/g, '$1\n\n$2');
  fixed = fixed.replace(/([*-+].*)\n([^\n])/g, '$1\n\n$2');

  // Fix 3: Add blank lines around code blocks
  fixed = fixed.replace(/([^\n])\n(```)/g, '$1\n\n$2');
  fixed = fixed.replace(/(```.*)\n([^\n])/g, '$1\n\n$2');

  // Fix 4: Remove trailing spaces
  fixed = fixed.replace(/[ \t]+$/gm, '');

  // Fix 5: Remove multiple consecutive blank lines (keep only one)
  fixed = fixed.replace(/\n{3,}/g, '\n\n');

  // Fix 6: Fix line length (basic wrapping for very long lines)
  const lines = fixed.split('\n');
  const wrappedLines = lines.map(line => {
    if (line.length > 120 && !line.startsWith('```') && !line.startsWith('#')) {
      // Simple word wrapping for long lines
      const words = line.split(' ');
      let result = '';
      let currentLine = '';
      
      for (const word of words) {
        if ((currentLine + word).length > 120) {
          result += currentLine.trim() + '\n';
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }
      result += currentLine.trim();
      return result;
    }
    return line;
  });

  return wrappedLines.join('\n');
}

// Process all markdown files
function processMarkdownFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      processMarkdownFiles(fullPath);
    } else if (file.name.endsWith('.md')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const fixed = fixMarkdownContent(content);
        
        if (content !== fixed) {
          fs.writeFileSync(fullPath, fixed);
          console.log(`Fixed: ${fullPath}`);
        }
      } catch (error) {
        console.error(`Error processing ${fullPath}:`, error.message);
      }
    }
  }
}

// Main execution
const projectRoot = process.cwd();
console.log('Fixing markdown files...');

// Process specific directories
const dirsToProcess = [
  '.',
  'docs',
  'scripts'
];

for (const dir of dirsToProcess) {
  const fullPath = path.join(projectRoot, dir);
  if (fs.existsSync(fullPath)) {
    processMarkdownFiles(fullPath);
  }
}

console.log('Markdown fixing complete!');
