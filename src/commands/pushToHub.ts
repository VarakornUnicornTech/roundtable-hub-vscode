import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import * as http from 'http';

/**
 * Push workspace data to UniOpsQC Hub database.
 * Calls the Hub.Api HTTP endpoint (preferred) or falls back to CLI.
 */
export async function pushToHub(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('Please open a workspace folder first.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Check that UniOpsQC Framework is installed
  const fs = require('fs');
  const claudeMd = path.join(workspaceRoot, '.claude', 'CLAUDE.md');
  if (!fs.existsSync(claudeMd)) {
    vscode.window.showWarningMessage(
      'UniOpsQC Framework is not installed in this workspace.',
      'Install Now'
    ).then((choice) => {
      if (choice === 'Install Now') {
        vscode.commands.executeCommand('roundtable.install');
      }
    });
    return;
  }

  // Run import with progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Push to Hub',
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: 'Syncing data to Hub database...' });

      try {
        const result = await runImportViaApi(workspaceRoot);
        const summary = parseApiResult(result);

        if (summary.errors > 0) {
          vscode.window.showWarningMessage(
            `Push to Hub completed with warnings: ${summary.tickets} tickets, ${summary.sessions} sessions, ${summary.briefings} briefings synced. ${summary.errors} error(s).`,
            'View Output'
          ).then((choice) => {
            if (choice === 'View Output') {
              showOutput(JSON.stringify(result, null, 2));
            }
          });
        } else {
          vscode.window.showInformationMessage(
            `Push to Hub complete: ${summary.tickets} tickets, ${summary.sessions} sessions, ${summary.briefings} briefings synced.`
          );
        }
      } catch (error: any) {
        // If API is not reachable, try CLI fallback
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
          progress.report({ message: 'Hub API not running. Trying CLI fallback...' });
          try {
            const cliResult = await runImportViaCli(workspaceRoot);
            const summary = parseCliResult(cliResult);
            vscode.window.showInformationMessage(
              `Push to Hub complete (CLI): ${summary.tickets} tickets, ${summary.sessions} sessions, ${summary.briefings} briefings synced.`
            );
          } catch (cliError: any) {
            vscode.window.showErrorMessage(
              'Push to Hub failed: Hub API is not running and CLI fallback failed. Start the Hub API server first.',
              'View Output'
            ).then((choice) => {
              if (choice === 'View Output') {
                showOutput(`API Error: ${error.message}\n\nCLI Error: ${cliError.message}`);
              }
            });
          }
        } else {
          vscode.window.showErrorMessage(
            `Push to Hub failed: ${error.message}`,
            'View Output'
          ).then((choice) => {
            if (choice === 'View Output') {
              showOutput(error.message);
            }
          });
        }
      }
    }
  );
}

/**
 * Call the Hub.Api HTTP endpoint to trigger import.
 */
function runImportViaApi(projectRoot: string): Promise<any> {
  const hubApiUrl = vscode.workspace
    .getConfiguration('roundtable')
    .get<string>('hubApiUrl', 'http://localhost:5200');

  const url = new URL('/api/import', hubApiUrl);
  const body = JSON.stringify({
    projectRootPath: projectRoot,
    force: false,
  });

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 60000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );

    req.on('error', (err: any) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 60 seconds'));
    });

    req.write(body);
    req.end();
  });
}

/**
 * Fallback: run import via dotnet CLI (only works when Hub.Api is not running).
 */
function runImportViaCli(projectRoot: string): Promise<string> {
  const hubApiPath = getHubApiPath(projectRoot);
  if (!hubApiPath) {
    return Promise.reject(new Error('Hub.Api project not found. Configure roundtable.hubApiPath in settings.'));
  }

  return new Promise((resolve, reject) => {
    const command = `dotnet run --project "${hubApiPath}" -- import "${projectRoot}"`;

    cp.exec(command, { timeout: 60000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        if (stdout && stdout.includes('Import Complete')) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || error.message));
        }
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Locate Hub.Api project path for CLI fallback.
 */
function getHubApiPath(workspaceRoot: string): string | null {
  const fs = require('fs');

  const configuredPath = vscode.workspace
    .getConfiguration('roundtable')
    .get<string>('hubApiPath', '');
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  const searchPaths = [
    path.resolve(workspaceRoot, '..', 'RoundTable-Hub', 'src', 'Hub.Api'),
    path.resolve(workspaceRoot, '..', 'Projects', 'RoundTable-Hub', 'src', 'Hub.Api'),
    path.resolve(workspaceRoot, '..', '..', 'Projects', 'RoundTable-Hub', 'src', 'Hub.Api'),
    path.join('D:', 'AI Projects', 'Projects', 'RoundTable-Hub', 'src', 'Hub.Api'),
  ];

  for (const searchPath of searchPaths) {
    const csproj = path.join(searchPath, 'Hub.Api.csproj');
    if (fs.existsSync(csproj)) {
      return searchPath;
    }
  }

  return null;
}

interface ImportSummary {
  tickets: number;
  sessions: number;
  briefings: number;
  errors: number;
}

/**
 * Parse the HTTP API JSON response.
 */
function parseApiResult(result: any): ImportSummary {
  return {
    tickets: result.tickets ?? 0,
    sessions: (result.roundTableSessions ?? 0) + (result.teamChatEntries ?? 0),
    briefings: result.briefings ?? 0,
    errors: result.filesFailed ?? 0,
  };
}

/**
 * Parse CLI text output for fallback mode.
 */
function parseCliResult(output: string): ImportSummary {
  const getCount = (label: string): number => {
    const match = output.match(new RegExp(`${label}:\\s*(\\d+)`));
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    tickets: getCount('Tickets'),
    sessions: getCount('RoundTable') + getCount('Team Chat'),
    briefings: getCount('Briefings'),
    errors: getCount('Files failed'),
  };
}

/**
 * Show full output in an output channel.
 */
function showOutput(content: string): void {
  const channel = vscode.window.createOutputChannel('UniOpsQC Hub');
  channel.clear();
  channel.appendLine(content);
  channel.show();
}
