import * as vscode from 'vscode';
import { GitHubService } from '../services/github';
import { TemplateService } from '../services/template';
import { getRepoSlug } from '../services/config';
import { isNewerVersion } from '../utils/semver';

export async function checkForUpdates(silent: boolean = false): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    if (!silent) {
      vscode.window.showErrorMessage('Please open a workspace folder first.');
    }
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const template = new TemplateService(workspaceRoot);

  if (!template.isInstalled()) {
    if (!silent) {
      vscode.window.showInformationMessage(
        'UniOpsQC Framework is not installed in this workspace.',
        'Install Now'
      ).then((choice) => {
        if (choice === 'Install Now') {
          vscode.commands.executeCommand('roundtable.install');
        }
      });
    }
    return;
  }

  const localVersion = template.getLocalVersion();
  if (!localVersion) {
    if (!silent) {
      vscode.window.showWarningMessage(
        'Cannot read local template-version.json. Framework may be corrupted.'
      );
    }
    return;
  }

  try {
    const github = new GitHubService(getRepoSlug());
    const remote = await github.getRemoteVersion();

    if (isNewerVersion(remote.version, localVersion)) {
      const changelog = await github.getChangelog();
      const changelogPreview = extractVersionChanges(changelog, remote.version);

      vscode.window
        .showInformationMessage(
          `UniOpsQC v${remote.version} available! (current: v${localVersion})\n${changelogPreview}`,
          'Update Now',
          'View Changes',
          'Later'
        )
        .then((choice) => {
          if (choice === 'Update Now') {
            vscode.commands.executeCommand('roundtable.update');
          } else if (choice === 'View Changes') {
            showChangelog(changelog);
          }
        });
    } else if (!silent) {
      vscode.window.showInformationMessage(
        `UniOpsQC Framework v${localVersion} is up to date.`
      );
    }
  } catch (error: any) {
    if (!silent) {
      vscode.window.showErrorMessage(`Failed to check for updates: ${error.message}`);
    }
  }
}

function extractVersionChanges(changelog: string, version: string): string {
  const regex = new RegExp(`## \\[${version.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=## \\[|$)`);
  const match = changelog.match(regex);
  if (match) {
    const lines = match[0].split('\n').slice(0, 5);
    return lines.join(' ').substring(0, 200);
  }
  return '';
}

function showChangelog(changelog: string): void {
  const panel = vscode.window.createWebviewPanel(
    'roundtable-changelog',
    'UniOpsQC Changelog',
    vscode.ViewColumn.One,
    {}
  );

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    h1, h2, h3 { color: var(--vscode-editor-foreground); }
    pre { background: var(--vscode-textBlockQuote-background); padding: 10px; border-radius: 4px; overflow-x: auto; }
    code { font-family: var(--vscode-editor-font-family); }
  </style>
</head>
<body>
  <h1>UniOpsQC Framework Changelog</h1>
  <pre>${escapeHtml(changelog)}</pre>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
