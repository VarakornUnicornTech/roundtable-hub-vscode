import * as vscode from 'vscode';

const TRIAL_START_KEY = 'roundtable.trialStartDate';
const TRIAL_DURATION_DAYS = 60;

let _context: vscode.ExtensionContext | null = null;

/**
 * Initialize trial system with extension context.
 * Must be called once during extension activation.
 */
export function initTrial(context: vscode.ExtensionContext): void {
  _context = context;

  // Start trial on first activation (if not already started)
  const existing = context.globalState.get<string>(TRIAL_START_KEY);
  if (!existing) {
    context.globalState.update(TRIAL_START_KEY, new Date().toISOString());
  }
}

/**
 * Check if the free trial is currently active.
 */
export function isTrialActive(): boolean {
  if (!_context) { return false; }
  const startStr = _context.globalState.get<string>(TRIAL_START_KEY);
  if (!startStr) { return false; }

  const start = new Date(startStr);
  const now = new Date();
  const elapsed = now.getTime() - start.getTime();
  const elapsedDays = elapsed / (1000 * 60 * 60 * 24);

  return elapsedDays <= TRIAL_DURATION_DAYS;
}

/**
 * Get remaining trial days.
 */
export function getTrialDaysRemaining(): number {
  if (!_context) { return 0; }
  const startStr = _context.globalState.get<string>(TRIAL_START_KEY);
  if (!startStr) { return 0; }

  const start = new Date(startStr);
  const now = new Date();
  const elapsed = now.getTime() - start.getTime();
  const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
  const remaining = TRIAL_DURATION_DAYS - elapsedDays;

  return Math.max(0, Math.ceil(remaining));
}

/**
 * Get trial start date as formatted string.
 */
export function getTrialStartDate(): string {
  if (!_context) { return 'N/A'; }
  const startStr = _context.globalState.get<string>(TRIAL_START_KEY);
  if (!startStr) { return 'N/A'; }

  const start = new Date(startStr);
  const dd = String(start.getDate()).padStart(2, '0');
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const yyyy = start.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}
