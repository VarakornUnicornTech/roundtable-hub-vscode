import * as fs from 'fs';
import * as path from 'path';

export interface HealthResult {
  category: string;
  item: string;
  status: 'ok' | 'missing' | 'warning';
}

/**
 * Run a framework health check on the .claude/ directory.
 * Verifies that all expected structure is present.
 */
export function runHealthCheck(workspaceRoot: string): HealthResult[] {
  const claudeDir = path.join(workspaceRoot, '.claude');
  const results: HealthResult[] = [];

  // Core files
  const coreFiles = [
    { path: 'CLAUDE.md', category: 'Core' },
    { path: 'ProjectEnvironment.md', category: 'Core' },
    { path: 'settings.json', category: 'Core' },
    { path: 'template-version.json', category: 'Core' },
  ];

  for (const f of coreFiles) {
    results.push({
      category: f.category,
      item: f.path,
      status: fs.existsSync(path.join(claudeDir, f.path)) ? 'ok' : 'missing',
    });
  }

  // Policies
  const policies = [
    '01_Logging_and_RoundTable.md',
    '02_Ticket_and_Briefing.md',
    '03_TeamChat_and_Handover.md',
    '04_Development_Structure.md',
    '05_PreExisting_Codebase.md',
    '06_Debugging_Protocol.md',
    '07_Parallel_Execution.md',
  ];

  const policyDir = path.join(claudeDir, 'policies');
  for (const p of policies) {
    results.push({
      category: 'Policies',
      item: p,
      status: fs.existsSync(path.join(policyDir, p)) ? 'ok' : 'missing',
    });
  }

  // Team Rosters
  const rosters = [
    '1. Team_Overseer.md',
    '2. Team_Monolith.md',
    '3. Team_Syndicate.md',
    '4. Team_Arcade.md',
    '5. Team_Cipher.md',
  ];

  const rosterDir = path.join(claudeDir, 'Team Roster');
  for (const r of rosters) {
    results.push({
      category: 'Rosters',
      item: r,
      status: fs.existsSync(path.join(rosterDir, r)) ? 'ok' : 'missing',
    });
  }

  // RoundTable directory
  const rtDir = path.join(workspaceRoot, 'RoundTable');
  results.push({
    category: 'Workspace',
    item: 'RoundTable/',
    status: fs.existsSync(rtDir) ? 'ok' : 'warning',
  });

  return results;
}

export function getHealthSummary(results: HealthResult[]): {
  total: number;
  ok: number;
  missing: number;
  warnings: number;
  score: number;
} {
  const ok = results.filter((r) => r.status === 'ok').length;
  const missing = results.filter((r) => r.status === 'missing').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const total = results.length;
  const score = Math.round((ok / total) * 100);
  return { total, ok, missing, warnings, score };
}
