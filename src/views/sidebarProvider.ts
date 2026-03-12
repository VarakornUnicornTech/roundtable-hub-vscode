import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateService } from '../services/template';
import { isProUser, PURCHASE_URL, getLicenseKey } from '../services/config';
import { isTrialActive, getTrialDaysRemaining } from '../services/trial';
import { scanRoundTableLogs, getLogStats, getExtendedStats, type RoundTableFile, type SessionStats } from '../services/sessionLog';
import { parseProjectEnvironment, writeProjectEnvironment } from '../services/projectEnv';
import { runHealthCheck, getHealthSummary, type HealthResult } from '../services/healthCheck';
import { scanPolicies, type PolicyFile } from '../services/policyBrowser';
import { scanRosters, type TeamRoster } from '../services/rosterViewer';
import type { ProjectConfig } from '../services/template';

function getExtensionVersion(): string {
  const ext = vscode.extensions.getExtension('UnicornTech.roundtable-hub');
  return ext?.packageJSON?.version || '0.0.0';
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'roundtable-hub.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    this.updateContent();

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'install':
          vscode.commands.executeCommand('roundtable.install');
          break;
        case 'setup':
          vscode.commands.executeCommand('roundtable.setup');
          break;
        case 'checkUpdate':
          vscode.commands.executeCommand('roundtable.checkUpdate');
          break;
        case 'update':
          vscode.commands.executeCommand('roundtable.update');
          break;
        case 'upgrade':
          vscode.env.openExternal(vscode.Uri.parse(PURCHASE_URL));
          break;
        case 'openLog':
          if (message.path) {
            const doc = vscode.workspace.openTextDocument(message.path);
            doc.then((d) => vscode.window.showTextDocument(d));
          }
          break;
        case 'enterKey':
          vscode.commands.executeCommand('workbench.action.openSettings', 'roundtable.licenseKey');
          break;
        case 'saveProject': {
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root && message.project) {
            const projects = parseProjectEnvironment(root);
            const idx = projects.findIndex((p) => p.name === message.originalName);
            const proj: ProjectConfig = {
              name: message.project.name,
              mode: message.project.mode,
              projectRoot: message.project.projectRoot,
              sourceRoot: message.project.sourceRoot,
              active: message.project.active,
              notes: message.project.notes,
            };
            if (idx >= 0) { projects[idx] = proj; } else { projects.push(proj); }
            writeProjectEnvironment(root, projects);
            vscode.window.showInformationMessage(`Project "${proj.name}" saved.`);
            this.updateContent();
          }
          break;
        }
        case 'deleteProject': {
          const root2 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root2 && message.name) {
            const projects = parseProjectEnvironment(root2).filter((p) => p.name !== message.name);
            writeProjectEnvironment(root2, projects);
            vscode.window.showInformationMessage(`Project "${message.name}" removed.`);
            this.updateContent();
          }
          break;
        }
        case 'openProjectEnv': {
          const root3 = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root3) {
            const envPath = require('path').join(root3, '.claude', 'ProjectEnvironment.md');
            const doc = vscode.workspace.openTextDocument(envPath);
            doc.then((d: vscode.TextDocument) => vscode.window.showTextDocument(d));
          }
          break;
        }
        case 'openSession': {
          const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (wsRoot) {
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const dateStr = `${dd}-${mm}-${yyyy}`;
            const rtDir = path.join(wsRoot, 'RoundTable');
            const filePath = path.join(rtDir, `${dateStr}_RoundTable.md`);
            const fs = require('fs');
            if (!fs.existsSync(rtDir)) { fs.mkdirSync(rtDir, { recursive: true }); }
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(filePath, `# RoundTable — ${dateStr}\n\n---\n\n`, 'utf-8');
            }
            const doc = vscode.workspace.openTextDocument(filePath);
            doc.then((d: vscode.TextDocument) => vscode.window.showTextDocument(d));
          }
          break;
        }
        case 'openPolicy':
        case 'openRoster':
          if (message.path) {
            const docFile = vscode.workspace.openTextDocument(message.path);
            docFile.then((d) => vscode.window.showTextDocument(d));
          }
          break;
        case 'refresh':
          this.updateContent();
          break;
      }
    });
  }

  public updateContent(): void {
    if (!this._view) { return; }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;

    let installed = false;
    let version = 'unknown';
    let fileCount = 0;
    let logFiles: RoundTableFile[] = [];
    let projects: ProjectConfig[] = [];
    let healthResults: HealthResult[] = [];
    let policies: PolicyFile[] = [];
    let rosters: TeamRoster[] = [];
    let extStats: SessionStats | null = null;

    if (workspaceRoot) {
      const template = new TemplateService(workspaceRoot);
      installed = template.isInstalled();
      version = template.getLocalVersion() || 'unknown';
      fileCount = installed ? template.getInstalledFiles().length : 0;
      if (installed) {
        logFiles = scanRoundTableLogs(workspaceRoot);
        projects = parseProjectEnvironment(workspaceRoot);
        healthResults = runHealthCheck(workspaceRoot);
        policies = scanPolicies(workspaceRoot);
        rosters = scanRosters(workspaceRoot);
        extStats = getExtendedStats(logFiles);
      }
    }

    const hasLicense = isProUser();
    const trialActive = isTrialActive();
    const isPro = hasLicense || trialActive;
    const trialDays = trialActive ? getTrialDaysRemaining() : 0;
    // proSource: 'license' | 'trial' | 'none'
    const proSource = hasLicense ? 'license' : trialActive ? 'trial' : 'none';

    const logoUri = this._view.webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'logo3_square.png')
    );

    this._view.webview.html = this.getHtml(installed, version, fileCount, isPro, logoUri, logFiles, projects, healthResults, policies, rosters, extStats, proSource, trialDays);
  }

  private getHtml(
    installed: boolean,
    version: string,
    fileCount: number,
    isPro: boolean,
    logoUri: vscode.Uri,
    logFiles: RoundTableFile[] = [],
    projects: ProjectConfig[] = [],
    healthResults: HealthResult[] = [],
    policies: PolicyFile[] = [],
    rosters: TeamRoster[] = [],
    extStats: SessionStats | null = null,
    proSource: string = 'none',
    trialDays: number = 0
  ): string {
    const icons = this.getIcons();

    if (!installed) {
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${this.getStyles()}</style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <img src="${logoUri}" alt="RoundTable Hub" class="logo" />
      <div class="header-text">
        <h1 class="title">RoundTable Hub</h1>
        <span class="subtitle">by Unicorn Tech Int Co.,Ltd.</span>
      </div>
    </div>

    <div class="divider"></div>

    <!-- Install Prompt -->
    <div class="install-section">
      <div class="install-icon">${icons.desktopDownload}</div>
      <p class="install-heading">Get Started</p>
      <p class="install-description">No RoundTable Framework detected in this workspace. Install it to enable multi-team AI governance.</p>
      <button class="btn btn-primary" onclick="send('install')">
        ${icons.desktopDownload}
        <span>Install RoundTable Framework</span>
      </button>
      <p class="hint">This will clone the framework and set up your .claude/ directory.</p>
    </div>

    <!-- Footer -->
    <div class="divider"></div>
    <div class="footer">
      <span class="footer-version">${icons.tag} v${getExtensionVersion()}</span>
    </div>

  </div>
</body>
<script>
  const vscode = acquireVsCodeApi();
  function send(cmd, data) { vscode.postMessage({ command: cmd, path: data }); }
</script>
</html>`;
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${this.getStyles()}</style>
</head>
<body>
  <div class="container">

    <!-- Header -->
    <div class="header">
      <img src="${logoUri}" alt="RoundTable Hub" class="logo" />
      <div class="header-text">
        <h1 class="title">RoundTable Hub</h1>
        <span class="subtitle">by Unicorn Tech Int Co.,Ltd.</span>
      </div>
      <span class="badge ${proSource === 'license' ? 'badge-pro' : proSource === 'trial' ? 'badge-trial' : 'badge-free'}">${proSource === 'license' ? 'PRO' : proSource === 'trial' ? 'TRIAL' : 'FREE'}</span>
    </div>

    <div class="divider"></div>

    <!-- Status Card -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Framework Status</span>
      </div>
      <div class="status-row">
        <span class="status-label">${icons.tag} Version</span>
        <span class="status-value">v${version}</span>
      </div>
      <div class="status-row">
        <span class="status-label">${icons.file} Files</span>
        <span class="status-value">${fileCount}</span>
      </div>
      <div class="status-row">
        <span class="status-label">${icons.check} Status</span>
        <span class="status-value status-installed">Installed</span>
      </div>
    </div>

    ${proSource === 'trial' ? `
    <div class="card card-trial">
      <div class="trial-header">
        <span class="trial-icon">${icons.star}</span>
        <span class="trial-title">Free Trial Active</span>
      </div>
      <p class="trial-text">All Pro features are unlocked for <strong>${trialDays} day${trialDays !== 1 ? 's' : ''}</strong> remaining. Enjoy!</p>
      <div class="trial-actions">
        <button class="btn-link" onclick="send('enterKey')">Enter License Key</button>
        <button class="btn-link" onclick="send('upgrade')">Buy Pro</button>
      </div>
    </div>
    ` : ''}

    <div class="divider"></div>

    <!-- Quick Actions -->
    <div class="section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="actions-grid">
        <button class="btn btn-secondary" onclick="send('openSession')">
          ${icons.file}
          <span>Open Today's Session</span>
        </button>
        <button class="btn btn-secondary" onclick="send('setup')">
          ${icons.gear}
          <span>Setup Project</span>
        </button>
        <button class="btn btn-secondary" onclick="send('checkUpdate')">
          ${icons.cloudDownload}
          <span>Check for Updates</span>
        </button>
        ${isPro
          ? `<button class="btn btn-secondary" onclick="send('update')">
              ${icons.sync}
              <span>Update Framework</span>
            </button>`
          : `<button class="btn btn-disabled" disabled title="Upgrade to Pro to unlock">
              ${icons.sync}
              <span>Update Framework</span>
              <span class="pro-lock">PRO</span>
            </button>`
        }
      </div>
    </div>

    <div class="divider"></div>

    <!-- Session Log Dashboard -->
    ${isPro ? this.getSessionLogHtml(logFiles) : `
    <div class="card card-locked">
      <div class="card-header">
        <span class="card-title">Session Logs</span>
        <span class="pro-lock">PRO</span>
      </div>
      <p class="locked-description">View and browse your RoundTable session history directly from the sidebar.</p>
      <button class="btn btn-small" onclick="send('upgrade')">Unlock with Pro</button>
    </div>
    `}

    <div class="divider"></div>

    <!-- Project Environment Editor -->
    ${isPro ? this.getProjectEditorHtml(projects) : `
    <div class="card card-locked">
      <div class="card-header">
        <span class="card-title">Project Editor</span>
        <span class="pro-lock">PRO</span>
      </div>
      <p class="locked-description">Edit your ProjectEnvironment.md visually — add, modify, or deactivate projects without touching markdown.</p>
      <button class="btn btn-small" onclick="send('upgrade')">Unlock with Pro</button>
    </div>
    `}

    <div class="divider"></div>

    <!-- Health Check -->
    ${isPro ? this.getHealthCheckHtml(healthResults) : `
    <div class="card card-locked">
      <div class="card-header">
        <span class="card-title">Health Check</span>
        <span class="pro-lock">PRO</span>
      </div>
      <p class="locked-description">Verify your framework integrity — check that all policies, rosters, and core files are present.</p>
      <button class="btn btn-small" onclick="send('upgrade')">Unlock with Pro</button>
    </div>
    `}

    <div class="divider"></div>

    <!-- Policy Browser -->
    ${isPro ? this.getPolicyBrowserHtml(policies) : `
    <div class="card card-locked">
      <div class="card-header">
        <span class="card-title">Policy Browser</span>
        <span class="pro-lock">PRO</span>
      </div>
      <p class="locked-description">Browse and read all RoundTable governance policies directly from the sidebar.</p>
      <button class="btn btn-small" onclick="send('upgrade')">Unlock with Pro</button>
    </div>
    `}

    <div class="divider"></div>

    <!-- Team Roster Viewer -->
    ${isPro ? this.getTeamRosterHtml(rosters) : `
    <div class="card card-locked">
      <div class="card-header">
        <span class="card-title">Team Roster</span>
        <span class="pro-lock">PRO</span>
      </div>
      <p class="locked-description">View all team members, roles, and responsibilities across the RoundTable organization.</p>
      <button class="btn btn-small" onclick="send('upgrade')">Unlock with Pro</button>
    </div>
    `}

    <div class="divider"></div>

    <!-- Session Statistics -->
    ${isPro ? this.getSessionStatsHtml(extStats) : `
    <div class="card card-locked">
      <div class="card-header">
        <span class="card-title">Session Statistics</span>
        <span class="pro-lock">PRO</span>
      </div>
      <p class="locked-description">Track your RoundTable session activity — streaks, averages, team participation.</p>
      <button class="btn btn-small" onclick="send('upgrade')">Unlock with Pro</button>
    </div>
    `}

    <div class="divider"></div>

    ${!isPro ? `
    <!-- Upgrade to Pro -->
    <div class="card card-upgrade">
      <div class="card-header">
        <span class="card-title upgrade-title">Upgrade to Pro</span>
      </div>
      <ul class="pro-features">
        <li>${icons.star} Visual ProjectEnvironment editor</li>
        <li>${icons.star} One-click framework updates</li>
        <li>${icons.star} Session log dashboard</li>
        <li>${icons.star} Framework health check</li>
        <li>${icons.star} Policy browser</li>
        <li>${icons.star} Team roster viewer</li>
        <li>${icons.star} Session statistics & streaks</li>
      </ul>
      <button class="btn btn-upgrade" onclick="send('upgrade')">
        <span>Upgrade Now</span>
      </button>
      <button class="btn-link" style="margin-top:8px;justify-content:center;width:100%;" onclick="send('enterKey')">
        Already have a license key?
      </button>
    </div>

    <div class="divider"></div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <span class="footer-version">${icons.tag} v${getExtensionVersion()}</span>
      <button class="btn-link" onclick="send('refresh')">
        ${icons.refresh} Refresh
      </button>
    </div>

  </div>
</body>
<script>
  const vscode = acquireVsCodeApi();
  function send(cmd, data) { vscode.postMessage({ command: cmd, path: data }); }
  function getFormData(prefix) {
    return {
      name: document.getElementById(prefix + '-name')?.value || '',
      mode: document.getElementById(prefix + '-mode')?.value || 'Centralized',
      projectRoot: document.getElementById(prefix + '-root')?.value || '',
      sourceRoot: document.getElementById(prefix + '-source')?.value || '',
      active: document.getElementById(prefix + '-active')?.checked ?? true,
      notes: document.getElementById(prefix + '-notes')?.value || '',
    };
  }
  function toggleAddForm() {
    const f = document.getElementById('add-form');
    if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
  }
  function saveNewProject() {
    const p = getFormData('new');
    if (!p.name) return;
    vscode.postMessage({ command: 'saveProject', project: p, originalName: '' });
  }
  function editProject(i) {
    document.getElementById('edit-form-' + i).style.display = 'block';
  }
  function cancelEdit(i) {
    document.getElementById('edit-form-' + i).style.display = 'none';
  }
  function saveEditProject(i, originalName) {
    const p = getFormData('edit-' + i);
    if (!p.name) return;
    vscode.postMessage({ command: 'saveProject', project: p, originalName: originalName });
  }
  function deleteProject(name) {
    vscode.postMessage({ command: 'deleteProject', name: name });
  }
</script>
</html>`;
  }

  private getSessionLogHtml(logFiles: RoundTableFile[]): string {
    const stats = getLogStats(logFiles);
    const recentFiles = logFiles.slice(0, 5); // Show last 5 days

    if (logFiles.length === 0) {
      return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Session Logs</span>
        </div>
        <p class="empty-state">No RoundTable logs found yet. Start a Claude Code session to generate your first log.</p>
      </div>`;
    }

    const fileItems = recentFiles.map((f) => {
      const sessionCount = f.sessions.length;
      const openCount = f.sessions.filter((s) => s.status === 'OPEN').length;
      const statusDot = openCount > 0 ? '<span class="dot dot-open"></span>' : '<span class="dot dot-closed"></span>';
      const escapedPath = f.fullPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      return `
        <button class="log-item" onclick="send('openLog', '${escapedPath}')">
          <div class="log-item-header">
            ${statusDot}
            <span class="log-date">${f.date}</span>
            <span class="log-count">${sessionCount} session${sessionCount !== 1 ? 's' : ''}</span>
          </div>
          ${f.sessions.length > 0 ? `<span class="log-preview">${f.sessions[f.sessions.length - 1].title}</span>` : ''}
        </button>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Session Logs</span>
      </div>
      <div class="status-row">
        <span class="status-label">Total Sessions</span>
        <span class="status-value">${stats.totalSessions}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Log Files</span>
        <span class="status-value">${stats.totalFiles}</span>
      </div>
      ${stats.openSessions > 0 ? `
      <div class="status-row">
        <span class="status-label">Open Sessions</span>
        <span class="status-value status-open">${stats.openSessions}</span>
      </div>` : ''}
    </div>
    <div class="section" style="margin-top: 8px;">
      <h2 class="section-title">Recent Logs</h2>
      <div class="log-list">
        ${fileItems}
      </div>
    </div>`;
  }

  private getHealthCheckHtml(results: HealthResult[]): string {
    const summary = getHealthSummary(results);
    const scoreColor = summary.score === 100 ? '#4caf50' : summary.score >= 80 ? '#ff9800' : '#e53935';

    const rows = results.map((r) => {
      const icon = r.status === 'ok' ? '<span class="health-ok">OK</span>'
        : r.status === 'missing' ? '<span class="health-missing">MISSING</span>'
        : '<span class="health-warning">WARN</span>';
      return `<div class="health-row"><span class="health-item">${r.item}</span>${icon}</div>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Health Check</span>
      </div>
      <div class="health-score" style="color:${scoreColor}">
        <span class="score-number">${summary.score}%</span>
        <span class="score-label">${summary.ok}/${summary.total} files present</span>
      </div>
      ${summary.missing > 0 ? `<div class="health-alert">${summary.missing} file${summary.missing > 1 ? 's' : ''} missing</div>` : ''}
      <details class="health-details">
        <summary class="health-toggle">View Details</summary>
        <div class="health-list">${rows}</div>
      </details>
    </div>`;
  }

  private getProjectEditorHtml(projects: ProjectConfig[]): string {
    if (projects.length === 0) {
      return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Project Editor</span>
        </div>
        <p class="empty-state">No projects configured yet. Add your first project below.</p>
        <button class="btn btn-secondary" onclick="toggleAddForm()">+ Add Project</button>
        <div id="add-form" class="editor-form" style="display:none;">
          ${this.getProjectFormHtml()}
          <div class="form-actions">
            <button class="btn btn-primary btn-small" onclick="saveNewProject()">Save</button>
            <button class="btn btn-secondary btn-small" onclick="toggleAddForm()">Cancel</button>
          </div>
        </div>
      </div>`;
    }

    const projectCards = projects.map((p, i) => {
      const escapedName = p.name.replace(/'/g, "\\'");
      const activeClass = p.active ? 'status-active' : 'status-inactive';
      const activeLabel = p.active ? 'Active' : 'On Hold';

      return `
        <div class="project-card" id="project-${i}">
          <div class="project-header">
            <span class="project-name">${p.name}</span>
            <span class="project-status ${activeClass}">${activeLabel}</span>
          </div>
          <div class="project-meta">
            <span class="project-mode">${p.mode}</span>
          </div>
          <div class="project-detail">
            <span class="detail-label">Root:</span>
            <span class="detail-value">${p.projectRoot}</span>
          </div>
          ${p.mode === 'Decentralized' ? `<div class="project-detail">
            <span class="detail-label">Source:</span>
            <span class="detail-value">${p.sourceRoot}</span>
          </div>` : ''}
          <div class="project-detail">
            <span class="detail-label">Notes:</span>
            <span class="detail-value">${p.notes}</span>
          </div>
          <div class="project-actions">
            <button class="btn-link" onclick="editProject(${i})">Edit</button>
            <button class="btn-link btn-danger" onclick="deleteProject('${escapedName}')">Remove</button>
          </div>
          <div id="edit-form-${i}" class="editor-form" style="display:none;">
            ${this.getProjectFormHtml(p, i)}
            <div class="form-actions">
              <button class="btn btn-primary btn-small" onclick="saveEditProject(${i}, '${escapedName}')">Save</button>
              <button class="btn btn-secondary btn-small" onclick="cancelEdit(${i})">Cancel</button>
            </div>
          </div>
        </div>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <span class="card-title">Project Editor</span>
        <button class="btn-link" onclick="send('openProjectEnv')">View File</button>
      </div>
      ${projectCards}
      <button class="btn btn-secondary" style="margin-top:8px;" onclick="toggleAddForm()">+ Add Project</button>
      <div id="add-form" class="editor-form" style="display:none;">
        ${this.getProjectFormHtml()}
        <div class="form-actions">
          <button class="btn btn-primary btn-small" onclick="saveNewProject()">Save</button>
          <button class="btn btn-secondary btn-small" onclick="toggleAddForm()">Cancel</button>
        </div>
      </div>
    </div>`;
  }

  private getProjectFormHtml(project?: ProjectConfig, index?: number): string {
    const prefix = index !== undefined ? `edit-${index}` : 'new';
    const name = project?.name || '';
    const mode = project?.mode || 'Centralized';
    const projectRoot = project?.projectRoot || '';
    const sourceRoot = project?.sourceRoot || '';
    const active = project?.active !== false;
    const notes = project?.notes || '';

    return `
      <div class="form-group">
        <label class="form-label">Project Name</label>
        <input class="form-input" id="${prefix}-name" value="${name}" placeholder="MyProject" />
      </div>
      <div class="form-group">
        <label class="form-label">Mode</label>
        <select class="form-input" id="${prefix}-mode">
          <option value="Centralized" ${mode === 'Centralized' ? 'selected' : ''}>Centralized</option>
          <option value="Decentralized" ${mode === 'Decentralized' ? 'selected' : ''}>Decentralized</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Project Root</label>
        <input class="form-input" id="${prefix}-root" value="${projectRoot}" placeholder="/path/to/project" />
      </div>
      <div class="form-group">
        <label class="form-label">Source Root</label>
        <input class="form-input" id="${prefix}-source" value="${sourceRoot}" placeholder="/path/to/source" />
      </div>
      <div class="form-group form-row">
        <label class="form-label">Active</label>
        <input type="checkbox" id="${prefix}-active" ${active ? 'checked' : ''} />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <input class="form-input" id="${prefix}-notes" value="${notes}" placeholder="Project notes..." />
      </div>`;
  }

  private getPolicyBrowserHtml(policies: PolicyFile[]): string {
    if (policies.length === 0) {
      return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Policy Browser</span>
        </div>
        <p class="empty-state">No policies found. Install the framework to access governance policies.</p>
      </div>`;
    }

    const items = policies.map((p) => {
      const escapedPath = p.fullPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `
        <button class="log-item" onclick="send('openPolicy', '${escapedPath}')">
          <div class="log-item-header">
            <span class="policy-badge">${p.sectionNumber}</span>
            <span class="log-date">${p.title}</span>
          </div>
          ${p.preview ? `<span class="log-preview">${p.preview}</span>` : ''}
        </button>`;
    }).join('');

    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Policy Browser</span>
      </div>
      <div class="log-list">
        ${items}
      </div>
    </div>`;
  }

  private getTeamRosterHtml(rosters: TeamRoster[]): string {
    if (rosters.length === 0) {
      return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Team Roster</span>
        </div>
        <p class="empty-state">No team rosters found. Install the framework to view team assignments.</p>
      </div>`;
    }

    const teamCards = rosters.map((r) => {
      const escapedPath = r.fullPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const memberRows = r.members.map((m) => `
        <div class="roster-row">
          <span class="roster-code">${m.code}</span>
          <span class="roster-name">${m.name}</span>
          <span class="roster-role">${m.role}</span>
        </div>`).join('');

      return `
        <details class="roster-team">
          <summary class="roster-team-header">
            <span class="roster-team-name">${r.teamName}</span>
            <span class="roster-member-count">${r.members.length}</span>
          </summary>
          <div class="roster-members">
            ${r.context ? `<div class="roster-context">${r.context}</div>` : ''}
            ${memberRows}
            <button class="btn-link" style="margin-top:6px;" onclick="send('openRoster', '${escapedPath}')">View Full Roster</button>
          </div>
        </details>`;
    }).join('');

    const totalMembers = rosters.reduce((sum, r) => sum + r.members.length, 0);

    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Team Roster</span>
      </div>
      <div class="status-row">
        <span class="status-label">Teams</span>
        <span class="status-value">${rosters.length}</span>
      </div>
      <div class="status-row">
        <span class="status-label">Members</span>
        <span class="status-value">${totalMembers}</span>
      </div>
      <div class="roster-list" style="margin-top:8px;">
        ${teamCards}
      </div>
    </div>`;
  }

  private getSessionStatsHtml(stats: SessionStats | null): string {
    if (!stats || stats.totalSessions === 0) {
      return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Session Statistics</span>
        </div>
        <p class="empty-state">No session data available yet. Start logging RoundTable sessions to see your activity stats.</p>
      </div>`;
    }

    const streakLabel = stats.activityStreak > 0
      ? `<span class="streak-badge">${stats.activityStreak} day${stats.activityStreak > 1 ? 's' : ''}</span>`
      : '<span class="streak-badge streak-none">0 days</span>';

    const participantTags = stats.uniqueParticipants.slice(0, 8).map(
      (p) => `<span class="participant-tag">${p}</span>`
    ).join('');

    return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Session Statistics</span>
      </div>
      <div class="stats-grid">
        <div class="stat-box">
          <span class="stat-number">${stats.totalSessions}</span>
          <span class="stat-label">Total Sessions</span>
        </div>
        <div class="stat-box">
          <span class="stat-number">${stats.sessionsLast7Days}</span>
          <span class="stat-label">Last 7 Days</span>
        </div>
        <div class="stat-box">
          <span class="stat-number">${stats.avgSessionsPerDay}</span>
          <span class="stat-label">Avg / Day</span>
        </div>
        <div class="stat-box">
          <span class="stat-number">${stats.completedSessions}</span>
          <span class="stat-label">Completed</span>
        </div>
      </div>
      <div class="status-row" style="margin-top:8px;">
        <span class="status-label">Activity Streak</span>
        ${streakLabel}
      </div>
      <div class="status-row">
        <span class="status-label">Most Active Day</span>
        <span class="status-value">${stats.mostActiveDay} <span style="opacity:0.5">(${stats.mostActiveCount})</span></span>
      </div>
      ${stats.uniqueParticipants.length > 0 ? `
      <div style="margin-top:8px;">
        <span class="status-label" style="display:block;margin-bottom:4px;">Participants</span>
        <div class="participant-list">${participantTags}</div>
      </div>` : ''}
    </div>`;
  }

  private getIcons(): Record<string, string> {
    const s = (d: string) =>
      `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">${d}</svg>`;

    return {
      gear: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M9.1 4.4L8.6 2H7.4L6.9 4.4L6.2 4.7L4.2 3.4L3.4 4.2L4.7 6.2L4.4 6.9L2 7.4V8.6L4.4 9.1L4.7 9.8L3.4 11.8L4.2 12.6L6.2 11.3L6.9 11.6L7.4 14H8.6L9.1 11.6L9.8 11.3L11.8 12.6L12.6 11.8L11.3 9.8L11.6 9.1L14 8.6V7.4L11.6 6.9L11.3 6.2L12.6 4.2L11.8 3.4L9.8 4.7L9.1 4.4ZM8 10C9.1046 10 10 9.1046 10 8C10 6.8954 9.1046 6 8 6C6.8954 6 6 6.8954 6 8C6 9.1046 6.8954 10 8 10Z"/>'),
      cloudDownload: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M11.957 6.02A3.5 3.5 0 005.121 5 3.5 3.5 0 002 8.5a3.483 3.483 0 001.874 3.086L3.17 12.3A4.483 4.483 0 011 8.5 4.5 4.5 0 015.41 4.01a4.5 4.5 0 018.548 1.278A3.5 3.5 0 0114.5 12h-1.548l.27-.713A2.5 2.5 0 0014.5 7a2.5 2.5 0 00-2.543-.98zM8.5 7v5.293l1.646-1.647.708.708L8 14.207l-2.854-2.853.708-.708L7.5 12.293V7h1z"/>'),
      sync: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M2.006 8.267L.78 9.5 0 8.73l2.09-2.07.76.01 2.09 2.12-.76.76-1.167-1.18a5 5 0 009.4 1.96l.94.34a6 6 0 01-11.35-2.4l.01.01zm11.986-.534L15.22 6.5l.78.77-2.09 2.07-.76-.01-2.09-2.12.76-.76 1.167 1.18a5 5 0 00-9.4-1.96l-.94-.34a6 6 0 0111.35 2.4l-.01-.01z"/>'),
      desktopDownload: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M4 15H1V14H4V12H0V2H16V12H12V14H15V15H12H11H5H4ZM15 11V3H1V11H15ZM7.5 5V9.293L5.854 7.646L5.146 8.354L8 11.207L10.854 8.354L10.146 7.646L8.5 9.293V5H7.5Z"/>'),
      tag: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M7.74 1L14 7.28V8L8 14.01L7.28 14L1 7.72V1H7.74ZM7.45 2L2 2V7.44L7.64 13L13 7.64L7.45 2ZM5 5C5 5.5523 4.5523 6 4 6C3.4477 6 3 5.5523 3 5C3 4.4477 3.4477 4 4 4C4.5523 4 5 4.4477 5 5Z"/>'),
      file: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M10.57 1L13 3.43V14H3V1H10.57ZM12 4L10 2H4V13H12V4Z"/>'),
      check: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M14.431 3.323L5.569 12.186L1.569 8.186L2.431 7.323L5.569 10.461L13.569 2.461L14.431 3.323Z"/>'),
      star: s('<path d="M8 0L9.796 5.528H15.604L10.904 8.944L12.7 14.472L8 11.056L3.3 14.472L5.096 8.944L0.396 5.528H6.204L8 0Z"/>'),
      refresh: s('<path fill-rule="evenodd" clip-rule="evenodd" d="M4.681 3A5.5 5.5 0 0113.5 8 5.5 5.5 0 012.5 8h1a4.5 4.5 0 118.3-2.4H9.5V4.5H14V1h-1v2.1A5.478 5.478 0 008 0.5 5.5 5.5 0 002.5 6h1a4.5 4.5 0 011.181-3zM2.5 8a5.5 5.5 0 005.5 5.5A5.5 5.5 0 0013.5 8h-1a4.5 4.5 0 01-4.5 4.5A4.5 4.5 0 013.5 8h-1z"/>'),
    };
  }

  private getStyles(): string {
    return `
      /* ===== Reset & Base ===== */
      *,
      *::before,
      *::after {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
        font-size: var(--vscode-font-size, 13px);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        padding: 16px;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }

      .container {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      /* ===== Header ===== */
      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
      }

      .logo {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        flex-shrink: 0;
        object-fit: contain;
      }

      .header-text {
        display: flex;
        flex-direction: column;
        gap: 1px;
        flex: 1;
        min-width: 0;
      }

      .title {
        font-size: 14px;
        font-weight: 600;
        line-height: 1.3;
        letter-spacing: -0.01em;
        color: var(--vscode-foreground);
      }

      .subtitle {
        font-size: 11px;
        color: var(--vscode-descriptionForeground, var(--vscode-foreground));
        opacity: 0.65;
        line-height: 1.3;
      }

      /* ===== Badges ===== */
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        flex-shrink: 0;
        line-height: 1.6;
      }

      .badge-pro {
        background: #f0b429;
        color: #1a1a1a;
      }

      .badge-trial {
        background: #4caf50;
        color: #ffffff;
      }

      .badge-free {
        background: var(--vscode-badge-background, rgba(255,255,255,0.1));
        color: var(--vscode-badge-foreground, var(--vscode-foreground));
      }

      /* ===== Divider ===== */
      .divider {
        height: 1px;
        background: var(--vscode-widget-border, rgba(128,128,128,0.2));
        margin: 2px 0;
      }

      /* ===== Card ===== */
      .card {
        background: var(--vscode-editor-background, rgba(255,255,255,0.04));
        border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
        border-radius: 8px;
        padding: 12px;
      }

      .card-header {
        margin-bottom: 10px;
      }

      .card-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.55;
      }

      /* ===== Status Rows ===== */
      .status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 5px 0;
        font-size: 12px;
      }

      .status-row + .status-row {
        border-top: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
      }

      .status-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--vscode-descriptionForeground, var(--vscode-foreground));
        opacity: 0.75;
      }

      .status-label svg {
        width: 14px;
        height: 14px;
        opacity: 0.6;
      }

      .status-value {
        font-weight: 600;
        font-size: 12px;
      }

      .status-installed {
        color: #4caf50;
      }

      /* ===== Sections ===== */
      .section {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        opacity: 0.55;
        margin-bottom: 2px;
      }

      .actions-grid {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      /* ===== Buttons ===== */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        font-family: inherit;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        line-height: 1.4;
        position: relative;
      }

      .btn svg {
        width: 14px;
        height: 14px;
        flex-shrink: 0;
      }

      .btn-primary {
        background: #E84B8A;
        color: #ffffff;
      }

      .btn-primary:hover {
        background: #d43d7c;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(232, 75, 138, 0.3);
      }

      .btn-primary:active {
        transform: translateY(0);
        box-shadow: none;
      }

      .btn-secondary {
        background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.08));
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
      }

      .btn-secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.12));
        border-color: var(--vscode-focusBorder, rgba(128,128,128,0.3));
      }

      .btn-disabled {
        background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.04));
        color: var(--vscode-disabledForeground, rgba(128,128,128,0.5));
        border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
        cursor: not-allowed;
        opacity: 0.55;
      }

      .btn-disabled:hover {
        transform: none;
        box-shadow: none;
      }

      .pro-lock {
        font-size: 9px;
        font-weight: 700;
        background: #f0b429;
        color: #1a1a1a;
        padding: 1px 5px;
        border-radius: 4px;
        letter-spacing: 0.04em;
        margin-left: auto;
      }

      /* ===== Upgrade Card ===== */
      .card-upgrade {
        background: linear-gradient(
          135deg,
          var(--vscode-editor-background, rgba(255,255,255,0.04)),
          rgba(232, 75, 138, 0.06)
        );
        border-color: rgba(232, 75, 138, 0.2);
      }

      .upgrade-title {
        color: #E84B8A;
        opacity: 1;
      }

      .pro-features {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 12px;
      }

      .pro-features li {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        line-height: 1.4;
      }

      .pro-features li svg {
        width: 12px;
        height: 12px;
        color: #f0b429;
        flex-shrink: 0;
      }

      .btn-upgrade {
        background: linear-gradient(135deg, #E84B8A, #d43d7c);
        color: #ffffff;
        font-weight: 600;
      }

      .btn-upgrade:hover {
        background: linear-gradient(135deg, #d43d7c, #c0336e);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(232, 75, 138, 0.35);
      }

      .btn-upgrade:active {
        transform: translateY(0);
        box-shadow: none;
      }

      /* ===== Install State ===== */
      .install-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 10px;
        padding: 20px 8px;
      }

      .install-icon {
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: rgba(232, 75, 138, 0.1);
        color: #E84B8A;
      }

      .install-icon svg {
        width: 24px;
        height: 24px;
      }

      .install-heading {
        font-size: 15px;
        font-weight: 600;
        color: var(--vscode-foreground);
      }

      .install-description {
        font-size: 12px;
        opacity: 0.7;
        line-height: 1.6;
        max-width: 240px;
      }

      .hint {
        font-size: 11px;
        opacity: 0.5;
        text-align: center;
        line-height: 1.5;
      }

      /* ===== Footer ===== */
      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 2px 0;
      }

      .footer-version {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        opacity: 0.45;
      }

      .footer-version svg {
        width: 12px;
        height: 12px;
      }

      .btn-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        color: var(--vscode-textLink-foreground, #E84B8A);
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
      }

      .btn-link:hover {
        background: rgba(232, 75, 138, 0.08);
      }

      .btn-link svg {
        width: 12px;
        height: 12px;
      }

      /* ===== Session Log Dashboard ===== */
      .log-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .log-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        padding: 8px 10px;
        background: var(--vscode-editor-background, rgba(255,255,255,0.04));
        border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
        border-radius: 6px;
        cursor: pointer;
        font-family: inherit;
        color: var(--vscode-foreground);
        text-align: left;
        transition: all 0.15s ease;
      }

      .log-item:hover {
        border-color: var(--vscode-focusBorder, rgba(128,128,128,0.3));
        background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
      }

      .log-item-header {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }

      .log-date {
        font-weight: 600;
        font-size: 12px;
      }

      .log-count {
        margin-left: auto;
        font-size: 11px;
        opacity: 0.6;
      }

      .log-preview {
        font-size: 11px;
        opacity: 0.55;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .dot-open {
        background: #4caf50;
        box-shadow: 0 0 4px rgba(76, 175, 80, 0.4);
      }

      .dot-closed {
        background: var(--vscode-descriptionForeground, rgba(128,128,128,0.5));
        opacity: 0.5;
      }

      .card-locked {
        opacity: 0.7;
        border-style: dashed;
      }

      .locked-description {
        font-size: 12px;
        opacity: 0.65;
        margin-bottom: 10px;
        line-height: 1.5;
      }

      .empty-state {
        font-size: 12px;
        opacity: 0.55;
        text-align: center;
        padding: 12px 0;
        line-height: 1.6;
      }

      .status-open {
        color: #4caf50;
      }

      .btn-small {
        padding: 5px 12px;
        font-size: 11px;
        width: auto;
      }

      /* ===== Health Check ===== */
      .health-score {
        display: flex;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 8px;
      }

      .score-number {
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
      }

      .score-label {
        font-size: 11px;
        opacity: 0.6;
      }

      .health-alert {
        font-size: 11px;
        color: #e53935;
        margin-bottom: 8px;
      }

      .health-details {
        margin-top: 4px;
      }

      .health-toggle {
        font-size: 11px;
        cursor: pointer;
        opacity: 0.6;
        user-select: none;
      }

      .health-toggle:hover {
        opacity: 1;
      }

      .health-list {
        margin-top: 6px;
      }

      .health-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 0;
        font-size: 11px;
        border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
      }

      .health-item {
        opacity: 0.75;
      }

      .health-ok {
        color: #4caf50;
        font-size: 10px;
        font-weight: 600;
      }

      .health-missing {
        color: #e53935;
        font-size: 10px;
        font-weight: 600;
      }

      .health-warning {
        color: #ff9800;
        font-size: 10px;
        font-weight: 600;
      }

      /* ===== Project Editor ===== */
      .project-card {
        padding: 10px 0;
        border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.1));
      }

      .project-card:last-of-type {
        border-bottom: none;
      }

      .project-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 4px;
      }

      .project-name {
        font-weight: 600;
        font-size: 13px;
      }

      .project-status {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      .status-active {
        background: rgba(76, 175, 80, 0.15);
        color: #4caf50;
      }

      .status-inactive {
        background: rgba(255, 152, 0, 0.15);
        color: #ff9800;
      }

      .project-meta {
        margin-bottom: 6px;
      }

      .project-mode {
        font-size: 11px;
        opacity: 0.55;
        font-style: italic;
      }

      .project-detail {
        display: flex;
        gap: 6px;
        font-size: 11px;
        line-height: 1.6;
      }

      .detail-label {
        opacity: 0.5;
        flex-shrink: 0;
      }

      .detail-value {
        word-break: break-all;
        opacity: 0.8;
      }

      .project-actions {
        display: flex;
        gap: 8px;
        margin-top: 6px;
      }

      .btn-danger {
        color: #e53935 !important;
      }

      .btn-danger:hover {
        background: rgba(229, 57, 53, 0.08) !important;
      }

      .editor-form {
        margin-top: 10px;
        padding: 10px;
        background: var(--vscode-editor-background, rgba(255,255,255,0.02));
        border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
        border-radius: 6px;
      }

      .form-group {
        margin-bottom: 8px;
      }

      .form-label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        opacity: 0.65;
        margin-bottom: 3px;
      }

      .form-input {
        width: 100%;
        padding: 5px 8px;
        font-size: 12px;
        font-family: inherit;
        background: var(--vscode-input-background, rgba(255,255,255,0.06));
        color: var(--vscode-input-foreground, var(--vscode-foreground));
        border: 1px solid var(--vscode-input-border, rgba(128,128,128,0.2));
        border-radius: 4px;
        outline: none;
        box-sizing: border-box;
      }

      .form-input:focus {
        border-color: var(--vscode-focusBorder, #E84B8A);
      }

      select.form-input {
        cursor: pointer;
      }

      .form-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-direction: row;
      }

      .form-row .form-label {
        margin-bottom: 0;
      }

      .form-actions {
        display: flex;
        gap: 6px;
        margin-top: 10px;
      }

      /* ===== Policy Browser ===== */
      .policy-badge {
        font-size: 10px;
        font-weight: 700;
        background: rgba(232, 75, 138, 0.12);
        color: #E84B8A;
        padding: 1px 5px;
        border-radius: 4px;
        letter-spacing: 0.02em;
        flex-shrink: 0;
      }

      /* ===== Team Roster Viewer ===== */
      .roster-team {
        margin-bottom: 4px;
      }

      .roster-team-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        cursor: pointer;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        user-select: none;
        transition: background 0.15s ease;
      }

      .roster-team-header:hover {
        background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.06));
      }

      .roster-team-name {
        font-size: 12px;
      }

      .roster-member-count {
        font-size: 10px;
        font-weight: 600;
        opacity: 0.5;
        background: var(--vscode-badge-background, rgba(255,255,255,0.1));
        padding: 1px 6px;
        border-radius: 8px;
      }

      .roster-members {
        padding: 6px 8px 8px;
      }

      .roster-context {
        font-size: 11px;
        opacity: 0.55;
        font-style: italic;
        margin-bottom: 6px;
        line-height: 1.4;
      }

      .roster-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: 11px;
        border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.08));
      }

      .roster-row:last-of-type {
        border-bottom: none;
      }

      .roster-code {
        font-weight: 700;
        font-size: 11px;
        min-width: 28px;
        color: #E84B8A;
      }

      .roster-name {
        font-weight: 500;
        min-width: 60px;
      }

      .roster-role {
        opacity: 0.55;
        font-size: 10px;
        margin-left: auto;
      }

      /* ===== Session Statistics ===== */
      .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .stat-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 10px 6px;
        background: var(--vscode-editor-background, rgba(255,255,255,0.02));
        border: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.12));
        border-radius: 6px;
      }

      .stat-number {
        font-size: 20px;
        font-weight: 700;
        line-height: 1;
        color: var(--vscode-foreground);
      }

      .stat-label {
        font-size: 10px;
        opacity: 0.5;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: 4px;
      }

      .streak-badge {
        font-size: 11px;
        font-weight: 600;
        background: rgba(76, 175, 80, 0.12);
        color: #4caf50;
        padding: 2px 8px;
        border-radius: 10px;
      }

      .streak-none {
        background: rgba(128, 128, 128, 0.1);
        color: var(--vscode-descriptionForeground);
      }

      .participant-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .participant-tag {
        font-size: 10px;
        font-weight: 600;
        background: var(--vscode-badge-background, rgba(255,255,255,0.1));
        color: var(--vscode-badge-foreground, var(--vscode-foreground));
        padding: 2px 6px;
        border-radius: 4px;
      }

      /* ===== Trial Card ===== */
      .card-trial {
        background: linear-gradient(135deg, var(--vscode-editor-background, rgba(255,255,255,0.04)), rgba(76, 175, 80, 0.08));
        border-color: rgba(76, 175, 80, 0.25);
      }

      .trial-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .trial-icon svg {
        width: 14px;
        height: 14px;
        color: #4caf50;
      }

      .trial-title {
        font-size: 12px;
        font-weight: 600;
        color: #4caf50;
      }

      .trial-text {
        font-size: 12px;
        opacity: 0.8;
        line-height: 1.5;
        margin-bottom: 8px;
      }

      .trial-text strong {
        color: #4caf50;
      }

      .trial-actions {
        display: flex;
        gap: 8px;
      }

      /* ===== Utility ===== */
      p {
        font-size: 12px;
      }
    `;
  }
}
