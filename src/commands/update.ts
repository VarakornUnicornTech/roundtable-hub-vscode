import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GitService } from '../services/git';
import { TemplateService } from '../services/template';
import { GitHubService } from '../services/github';
import { getRepoSlug } from '../services/config';

interface FileDiff {
  relativePath: string;
  status: 'added' | 'modified' | 'deleted' | 'unchanged';
  recommendation: 'RECOMMENDED' | 'OPTIONAL' | 'SKIP';
  reason: string;
}

export async function updateFramework(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const template = new TemplateService(workspaceRoot);

  if (!template.isInstalled()) {
    vscode.window.showErrorMessage('UniOpsQC Framework is not installed.');
    return;
  }

  const github = new GitHubService(getRepoSlug());
  const git = new GitService();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'UniOpsQC Hub',
      cancellable: true,
    },
    async (progress, token) => {
      try {
        // Step 1: Clone latest
        progress.report({ message: 'Downloading latest version...' });
        const tmpDir = path.join(os.tmpdir(), `roundtable-update-${Date.now()}`);
        await git.cloneShallow(github.getCloneUrl(), tmpDir);

        if (token.isCancellationRequested) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
          return;
        }

        // Step 2: Compare files
        progress.report({ message: 'Comparing files...' });
        const diffs = compareDirectories(
          path.join(tmpDir, '.claude'),
          template.claudeDir
        );

        // Cleanup temp
        fs.rmSync(tmpDir, { recursive: true, force: true });

        if (diffs.length === 0) {
          vscode.window.showInformationMessage('All files are up to date!');
          return;
        }

        // Step 3: Show diff picker
        const items = diffs
          .filter((d) => d.status !== 'unchanged')
          .map((d) => ({
            label: `$(${getIcon(d.status)}) ${d.relativePath}`,
            description: `[${d.recommendation}] ${d.reason}`,
            picked: d.recommendation === 'RECOMMENDED',
            diff: d,
          }));

        const selected = await vscode.window.showQuickPick(items, {
          canPickMany: true,
          placeHolder: 'Select files to update (RECOMMENDED files are pre-selected)',
          title: `RoundTable Update — ${items.length} files changed`,
        });

        if (!selected || selected.length === 0) { return; }

        // Step 4: Re-clone for actual files
        progress.report({ message: 'Applying updates...' });
        const applyDir = path.join(os.tmpdir(), `roundtable-apply-${Date.now()}`);
        await git.cloneShallow(github.getCloneUrl(), applyDir);

        // Step 5: Backup + Apply
        let applied = 0;
        for (const item of selected) {
          const srcFile = path.join(applyDir, '.claude', item.diff.relativePath);
          const destFile = path.join(template.claudeDir, item.diff.relativePath);

          if (item.diff.status === 'deleted') {
            if (fs.existsSync(destFile)) {
              template.backupFile(destFile);
              fs.unlinkSync(destFile);
            }
          } else {
            if (fs.existsSync(srcFile)) {
              if (fs.existsSync(destFile)) {
                template.backupFile(destFile);
              }
              const destDir = path.dirname(destFile);
              if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
              }
              fs.copyFileSync(srcFile, destFile);
            }
          }
          applied++;
        }

        // Copy updated template-version.json
        const srcVersion = path.join(applyDir, 'template-version.json');
        if (fs.existsSync(srcVersion)) {
          template.backupFile(template.versionFilePath);
          fs.copyFileSync(srcVersion, template.versionFilePath);
        }

        fs.rmSync(applyDir, { recursive: true, force: true });

        vscode.window
          .showInformationMessage(
            `Updated ${applied} files. Backups created (.backup files).`,
            'Undo (Rollback)'
          )
          .then((choice) => {
            if (choice === 'Undo (Rollback)') {
              const restored = template.restoreBackups();
              vscode.window.showInformationMessage(`Rolled back ${restored} files.`);
            }
          });

      } catch (error: any) {
        vscode.window.showErrorMessage(`Update failed: ${error.message}`);
      }
    }
  );
}

function compareDirectories(remoteDir: string, localDir: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  const remoteFiles = new Set<string>();

  // Walk remote
  walkDir(remoteDir, (filePath) => {
    const rel = path.relative(remoteDir, filePath).replace(/\\/g, '/');
    if (rel.includes('.gitkeep')) { return; }
    remoteFiles.add(rel);

    const localPath = path.join(localDir, rel);
    if (!fs.existsSync(localPath)) {
      diffs.push({
        relativePath: rel,
        status: 'added',
        recommendation: 'RECOMMENDED',
        reason: 'New file in latest version',
      });
    } else {
      const remoteContent = fs.readFileSync(filePath, 'utf-8');
      const localContent = fs.readFileSync(localPath, 'utf-8');
      if (remoteContent !== localContent) {
        const rec = classifyFile(rel);
        diffs.push({
          relativePath: rel,
          status: 'modified',
          recommendation: rec.recommendation,
          reason: rec.reason,
        });
      }
    }
  });

  // Check for files only in local (potential deletions)
  walkDir(localDir, (filePath) => {
    const rel = path.relative(localDir, filePath).replace(/\\/g, '/');
    if (rel.includes('.gitkeep') || rel.includes('.backup')) { return; }
    if (!remoteFiles.has(rel)) {
      diffs.push({
        relativePath: rel,
        status: 'unchanged',
        recommendation: 'SKIP',
        reason: 'Local custom file — not in template',
      });
    }
  });

  return diffs;
}

function classifyFile(relativePath: string): { recommendation: 'RECOMMENDED' | 'OPTIONAL' | 'SKIP'; reason: string } {
  const lower = relativePath.toLowerCase();

  // User-customized files — don't overwrite
  if (lower.includes('projectenvironment')) {
    return { recommendation: 'SKIP', reason: 'Contains your project-specific settings' };
  }
  if (lower.includes('team roster') || lower.includes('team_roster')) {
    return { recommendation: 'OPTIONAL', reason: 'May contain your custom team names' };
  }

  // Policy files — usually should update
  if (lower.includes('policies') || lower.includes('policy')) {
    return { recommendation: 'RECOMMENDED', reason: 'Policy update from framework maintainer' };
  }

  // Core file
  if (lower === 'claude.md') {
    return { recommendation: 'RECOMMENDED', reason: 'Core framework file updated' };
  }

  // Skills
  if (lower.includes('skills/')) {
    return { recommendation: 'RECOMMENDED', reason: 'Skill update or new skill' };
  }

  // Settings
  if (lower.includes('settings.json')) {
    return { recommendation: 'OPTIONAL', reason: 'Default settings — you may have customized' };
  }

  return { recommendation: 'RECOMMENDED', reason: 'Framework file updated' };
}

function getIcon(status: string): string {
  switch (status) {
    case 'added': return 'diff-added';
    case 'modified': return 'diff-modified';
    case 'deleted': return 'diff-removed';
    default: return 'file';
  }
}

function walkDir(dir: string, callback: (filePath: string) => void): void {
  if (!fs.existsSync(dir)) { return; }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}
