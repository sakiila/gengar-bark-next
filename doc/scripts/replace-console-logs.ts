// scripts/replace-console-logs.ts
import * as fs from 'fs';
import * as path from 'path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

function replaceConsoleLogsInFile(filePath: string): void {
  let content = fs.readFileSync(filePath, 'utf8');

  // Add logger import if needed
  if (content.includes('console.') && !content.includes('@/lib/logger')) {
    content = `import { logger } from '@/lib/logger';\n${content}`;
  }

  // Replace different console methods
  content = content
  // Replace console.log
  .replace(
    /console\.log\((.*?)\);/g,
    (match, args) => `logger.log(${args});`
  )
  // Replace console.info
  .replace(
    /console\.info\((.*?)\);/g,
    (match, args) => `logger.info(${args});`
  )
  // Replace console.warn
  .replace(
    /console\.warn\((.*?)\);/g,
    (match, args) => `logger.warn(${args});`
  )
  // Replace console.error
  .replace(
    /console\.error\((.*?)\);/g,
    (match, args) => `logger.error(${args});`
  )
  // Replace console.debug
  .replace(
    /console\.debug\((.*?)\);/g,
    (match, args) => `logger.debug(${args});`
  );

  fs.writeFileSync(filePath, content);
}

function walkDir(dir: string): void {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.includes('node_modules')) {
      walkDir(filePath);
    } else if (
      stat.isFile() &&
      EXTENSIONS.includes(path.extname(file))
    ) {
      replaceConsoleLogsInFile(filePath);
    }
  }
}

// Start the replacement process
const srcDir = path.join(process.cwd(), 'src');
walkDir(srcDir);
console.log('Finished replacing console.log statements with logger');
