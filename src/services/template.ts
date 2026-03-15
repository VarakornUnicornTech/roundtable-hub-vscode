import * as fs from 'fs';
import * as path from 'path';

export interface ProjectConfig {
  name: string;
  mode: 'Centralized' | 'Decentralized';
  projectRoot: string;
  sourceRoot: string;
  active: boolean;
  notes: string;
}

export class TemplateService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  get claudeDir(): string {
    return path.join(this.workspaceRoot, '.claude');
  }

  get projectEnvPath(): string {
    return path.join(this.claudeDir, 'ProjectEnvironment.md');
  }

  get versionFilePath(): string {
    return path.join(this.claudeDir, 'template-version.json');
  }

  isInstalled(): boolean {
    return fs.existsSync(path.join(this.claudeDir, 'CLAUDE.md'));
  }

  getLocalVersion(): string | null {
    try {
      const content = fs.readFileSync(this.versionFilePath, 'utf-8');
      return JSON.parse(content).version || null;
    } catch {
      return null;
    }
  }

  async installFromClone(clonePath: string): Promise<void> {
    const sourceClaudeDir = path.join(clonePath, '.claude');
    if (!fs.existsSync(sourceClaudeDir)) {
      throw new Error('.claude/ directory not found in cloned repository');
    }

    this.copyDirRecursive(sourceClaudeDir, this.claudeDir);

    // Copy root files (always overwrite to keep version current)
    const rootFiles = ['template-version.json'];
    for (const file of rootFiles) {
      const src = path.join(clonePath, file);
      const dest = path.join(this.claudeDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  }

  writeProjectEnvironment(config: ProjectConfig): void {
    const content = `# ProjectEnvironment

> Active project registry. Check this file before constructing any Development folder path or PreExisting TechStack path.
> Maintained by KP (Overseer). Update when a project is added, put on hold, or its source path changes.

---

## Active Projects

### ${config.name}
**PROJECT_MODE:** ${config.mode}
**PROJECT_ROOT:** \`${config.projectRoot}\`
**SOURCE_ROOT:** \`${config.sourceRoot}\`
**ACTIVE:** ${config.active}
**Notes:** ${config.notes}

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

    fs.writeFileSync(this.projectEnvPath, content, 'utf-8');
  }

  backupFile(filePath: string): string {
    const backupPath = filePath + '.backup';
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
    }
    return backupPath;
  }

  restoreBackups(): number {
    let restored = 0;
    this.walkDir(this.claudeDir, (filePath) => {
      if (filePath.endsWith('.backup')) {
        const originalPath = filePath.replace(/\.backup$/, '');
        fs.copyFileSync(filePath, originalPath);
        fs.unlinkSync(filePath);
        restored++;
      }
    });
    return restored;
  }

  getInstalledFiles(): string[] {
    const files: string[] = [];
    if (fs.existsSync(this.claudeDir)) {
      this.walkDir(this.claudeDir, (filePath) => {
        if (!filePath.endsWith('.backup') && !filePath.includes('.gitkeep')) {
          files.push(path.relative(this.claudeDir, filePath));
        }
      });
    }
    return files;
  }

  private copyDirRecursive(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  private walkDir(dir: string, callback: (filePath: string) => void): void {
    if (!fs.existsSync(dir)) { return; }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, callback);
      } else {
        callback(fullPath);
      }
    }
  }
}
