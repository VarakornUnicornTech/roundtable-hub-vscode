import * as fs from 'fs';
import * as path from 'path';

export interface PolicyFile {
  filename: string;
  title: string;
  fullPath: string;
  sectionNumber: string;
  preview: string;
}

/**
 * Scan for policy markdown files.
 * Supports both v1.3.0+ (.claude/TeamDocument/1. Policies/) and legacy (.claude/policies/).
 */
export function scanPolicies(workspaceRoot: string): PolicyFile[] {
  const newDir = path.join(workspaceRoot, '.claude', 'TeamDocument', '1. Policies');
  const legacyDir = path.join(workspaceRoot, '.claude', 'policies');
  const policyDir = fs.existsSync(newDir) ? newDir : legacyDir;
  if (!fs.existsSync(policyDir)) { return []; }

  const files = fs.readdirSync(policyDir)
    .filter((f) => f.endsWith('.md'))
    .sort();

  return files.map((filename) => {
    const fullPath = path.join(policyDir, filename);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // Extract section number from filename (e.g., "01_Logging..." → "§1")
    const numMatch = filename.match(/^(\d+)/);
    const sectionNumber = numMatch ? `§${parseInt(numMatch[1], 10)}` : '';

    // Extract title from first # heading
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');

    // First non-empty, non-heading line as preview
    const lines = content.split('\n');
    let preview = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---')) {
        preview = trimmed.substring(0, 80);
        break;
      }
    }

    return { filename, title, fullPath, sectionNumber, preview };
  });
}
