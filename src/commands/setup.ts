import * as vscode from 'vscode';
import { TemplateService, ProjectConfig } from '../services/template';

export async function setupProject(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const template = new TemplateService(workspaceRoot);

  if (!template.isInstalled()) {
    const answer = await vscode.window.showWarningMessage(
      'UniOpsQC Framework is not installed. Install it first?',
      'Install',
      'Cancel'
    );
    if (answer === 'Install') {
      vscode.commands.executeCommand('roundtable.install');
    }
    return;
  }

  // Step 1: Project name
  const folderName = workspaceFolders[0].name;
  const projectName = await vscode.window.showInputBox({
    prompt: 'Project name',
    value: folderName,
    placeHolder: 'MyProject',
    validateInput: (value) => (value.trim() ? null : 'Project name is required'),
  });
  if (!projectName) { return; }

  // Step 2: Mode
  const mode = await vscode.window.showQuickPick(
    [
      {
        label: 'Centralized',
        description: 'Single project root — PROJECT_ROOT = SOURCE_ROOT',
        detail: 'Best for most projects. Planning and source code in the same folder.',
      },
      {
        label: 'Decentralized',
        description: 'Separate planning hub and source roots',
        detail: 'For projects where planning docs and source code live in different locations.',
      },
    ],
    {
      placeHolder: 'Select project mode',
      title: 'RoundTable: Project Mode',
    }
  );
  if (!mode) { return; }

  // Step 3: Project root
  const projectRootUri = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: workspaceFolders[0].uri,
    openLabel: 'Select Project Root',
    title: 'Select PROJECT_ROOT folder',
  });
  const projectRoot = projectRootUri?.[0]?.fsPath || workspaceRoot;

  // Step 4: Source root (only ask if Decentralized)
  let sourceRoot = projectRoot;
  if (mode.label === 'Decentralized') {
    const sourceRootUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      defaultUri: vscode.Uri.file(projectRoot),
      openLabel: 'Select Source Root',
      title: 'Select SOURCE_ROOT folder (where source code lives)',
    });
    sourceRoot = sourceRootUri?.[0]?.fsPath || projectRoot;
  }

  // Step 5: Write config
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).replace(/\//g, '-');

  const config: ProjectConfig = {
    name: projectName.trim(),
    mode: mode.label as 'Centralized' | 'Decentralized',
    projectRoot: projectRoot.replace(/\\/g, '/'),
    sourceRoot: sourceRoot.replace(/\\/g, '/'),
    active: true,
    notes: `New project. Initial setup completed ${today}.`,
  };

  template.writeProjectEnvironment(config);

  vscode.window.showInformationMessage(
    `Project "${config.name}" configured! Open Claude Code to start using RoundTable.`
  );

  // Open the file for review
  const doc = await vscode.workspace.openTextDocument(template.projectEnvPath);
  await vscode.window.showTextDocument(doc);
}
