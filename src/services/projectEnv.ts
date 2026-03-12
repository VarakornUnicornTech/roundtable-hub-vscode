import * as fs from 'fs';
import * as path from 'path';
import { ProjectConfig } from './template';

/**
 * Parse ProjectEnvironment.md back into ProjectConfig objects.
 */
export function parseProjectEnvironment(workspaceRoot: string): ProjectConfig[] {
  const envPath = path.join(workspaceRoot, '.claude', 'ProjectEnvironment.md');
  if (!fs.existsSync(envPath)) { return []; }

  const content = fs.readFileSync(envPath, 'utf-8');
  const projects: ProjectConfig[] = [];

  // Match project blocks: ### Name followed by field lines
  const projectRegex = /### (.+)\n\*\*PROJECT_MODE:\*\*\s*(.+)\n\*\*PROJECT_ROOT:\*\*\s*`([^`]*)`\n\*\*SOURCE_ROOT:\*\*\s*`([^`]*)`\n\*\*ACTIVE:\*\*\s*(.+)\n\*\*Notes:\*\*\s*(.+)/g;

  let match;
  while ((match = projectRegex.exec(content)) !== null) {
    projects.push({
      name: match[1].trim(),
      mode: match[2].trim() as 'Centralized' | 'Decentralized',
      projectRoot: match[3].trim(),
      sourceRoot: match[4].trim(),
      active: match[5].trim().toLowerCase() === 'true',
      notes: match[6].trim(),
    });
  }

  return projects;
}

/**
 * Write multiple projects to ProjectEnvironment.md.
 */
export function writeProjectEnvironment(workspaceRoot: string, projects: ProjectConfig[]): void {
  const envPath = path.join(workspaceRoot, '.claude', 'ProjectEnvironment.md');

  const projectBlocks = projects.map((p) => `### ${p.name}
**PROJECT_MODE:** ${p.mode}
**PROJECT_ROOT:** \`${p.projectRoot}\`
**SOURCE_ROOT:** \`${p.sourceRoot}\`
**ACTIVE:** ${p.active}
**Notes:** ${p.notes}`).join('\n\n');

  const content = `# ProjectEnvironment

> Active project registry. Check this file before constructing any Development folder path or PreExisting TechStack path.
> Maintained by KP (Overseer). Update when a project is added, put on hold, or its source path changes.

---

## Active Projects

${projectBlocks}

---

## Rules

- Check this file before constructing any Development folder path or PreExisting TechStack path
- If a project is not listed here, add it before beginning work
- \`SOURCE_ROOT\` and \`PROJECT_ROOT\` are the same in Centralized mode with no sub-components; different in Decentralized mode
- Set \`ACTIVE: false\` for projects that are on hold — do not delete entries
- Update the Notes field when significant project state changes (new deployment, mode change, source path change)

---

*Template — replace example entries with your actual projects.*
`;

  fs.writeFileSync(envPath, content, 'utf-8');
}
