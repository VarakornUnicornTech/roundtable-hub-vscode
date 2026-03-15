import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { GitService } from '../services/git';
import { TemplateService } from '../services/template';
import { GitHubService } from '../services/github';
import { getRepoSlug } from '../services/config';

export async function installFramework(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const template = new TemplateService(workspaceRoot);

  if (template.isInstalled()) {
    const answer = await vscode.window.showWarningMessage(
      'UniOpsQC Framework is already installed in this workspace. Reinstall?',
      'Reinstall',
      'Cancel'
    );
    if (answer !== 'Reinstall') { return; }
  }

  const github = new GitHubService(getRepoSlug());
  const git = new GitService();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'UniOpsQC Hub',
      cancellable: false,
    },
    async (progress) => {
      try {
        // Step 1: Clone
        progress.report({ message: 'Downloading UniOpsQC Framework...' });
        const tmpDir = path.join(os.tmpdir(), `roundtable-install-${Date.now()}`);
        await git.cloneShallow(github.getCloneUrl(), tmpDir);

        // Step 2: Copy .claude/
        progress.report({ message: 'Installing framework files...' });
        await template.installFromClone(tmpDir);

        // Step 3: Cleanup
        progress.report({ message: 'Cleaning up...' });
        fs.rmSync(tmpDir, { recursive: true, force: true });

        // Step 4: Create runtime directories
        progress.report({ message: 'Creating directories...' });
        const dirs = [
          path.join(workspaceRoot, 'RoundTable'),
          path.join(workspaceRoot, 'Development'),
        ];
        for (const dir of dirs) {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }

        vscode.window
          .showInformationMessage(
            'UniOpsQC Framework installed successfully!',
            'Getting Started',
            'Getting Started (ภาษาไทย)',
            'Setup Project'
          )
          .then((choice) => {
            if (choice === 'Getting Started') {
              const guideUri = vscode.Uri.file(
                path.join(workspaceRoot, '.claude', 'GETTING_STARTED.md')
              );
              vscode.commands.executeCommand('markdown.showPreview', guideUri);
            } else if (choice === 'Getting Started (ภาษาไทย)') {
              const guideUri = vscode.Uri.file(
                path.join(workspaceRoot, '.claude', 'GETTING_STARTED_TH.md')
              );
              vscode.commands.executeCommand('markdown.showPreview', guideUri);
            } else if (choice === 'Setup Project') {
              vscode.commands.executeCommand('roundtable.setup');
            }
          });

      } catch (error: any) {
        vscode.window.showErrorMessage(`Installation failed: ${error.message}`);
      }
    }
  );
}
