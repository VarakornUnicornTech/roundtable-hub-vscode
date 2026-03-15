import * as vscode from 'vscode';
import { SidebarProvider } from './views/sidebarProvider';
import { installFramework } from './commands/install';
import { setupProject } from './commands/setup';
import { checkForUpdates } from './commands/versionCheck';
import { updateFramework } from './commands/update';
import { pushToHub } from './commands/pushToHub';
import { isAutoCheckEnabled } from './services/config';
import { validateLicense, clearLicenseCache } from './services/license';
import { initTrial } from './services/trial';

export function activate(context: vscode.ExtensionContext) {
  console.log('RoundTable Hub activated');

  // Initialize 60-day free trial
  initTrial(context);

  // Register sidebar
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // First-run Welcome experience
  // Detect framework presence in current workspace
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const fs = require('fs');
  const path = require('path');
  const frameworkInstalled = workspaceRoot
    ? fs.existsSync(path.join(workspaceRoot, '.claude', 'CLAUDE.md'))
    : false;

  const hasShownWelcome = context.globalState.get<boolean>('roundtable.welcomeShown');

  // Show welcome if: first-ever activation OR framework not detected (covers reinstall edge case)
  if (!hasShownWelcome || !frameworkInstalled) {
    // Only update flag on genuine first run (not every time framework is missing)
    if (!hasShownWelcome) {
      context.globalState.update('roundtable.welcomeShown', true);
    }

    // Auto-reveal the sidebar panel
    vscode.commands.executeCommand('roundtable-hub.sidebar.focus');

    // Show Welcome notification when framework is not yet installed
    if (!frameworkInstalled) {
      vscode.window.showInformationMessage(
        'RoundTable Hub is ready! Open the sidebar and click "Install RoundTable Framework" to get started.',
        'Open Sidebar',
        'Learn More'
      ).then((selection) => {
        if (selection === 'Open Sidebar') {
          vscode.commands.executeCommand('roundtable-hub.sidebar.focus');
        } else if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/VarakornUnicornTech/roundtable-framework'));
        }
      });
    }
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('roundtable.install', async () => {
      await installFramework();
      sidebarProvider.updateContent();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roundtable.setup', async () => {
      await setupProject();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roundtable.checkUpdate', async () => {
      await checkForUpdates(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roundtable.update', async () => {
      await updateFramework();
      sidebarProvider.updateContent();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('roundtable.pushToHub', async () => {
      await pushToHub();
      sidebarProvider.updateContent();
    })
  );

  // Validate license on startup (async, non-blocking)
  validateLicense().then((status) => {
    if (status.valid) {
      console.log('RoundTable Hub: Pro license validated');
    }
    // Refresh sidebar to reflect validated status
    sidebarProvider.updateContent();
  }).catch(() => {
    // Silent fail — offline fallback handled in validateLicense()
  });

  // Re-validate when license key setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('roundtable.licenseKey')) {
        clearLicenseCache();
        validateLicense().then(() => {
          sidebarProvider.updateContent();
        });
      }
    })
  );

  // Auto-check for updates on startup (silent)
  if (isAutoCheckEnabled()) {
    setTimeout(() => {
      checkForUpdates(true);
    }, 5000);
  }
}

export function deactivate() {
  console.log('RoundTable Hub deactivated');
}
