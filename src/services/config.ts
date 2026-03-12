import * as vscode from 'vscode';

export function getRepoSlug(): string {
  return vscode.workspace.getConfiguration('roundtable').get<string>(
    'repoUrl',
    'VarakornUnicornTech/unicorn_roundtable_framework_repo'
  );
}

export function getLicenseKey(): string {
  return vscode.workspace.getConfiguration('roundtable').get<string>('licenseKey', '');
}

export function isAutoCheckEnabled(): boolean {
  return vscode.workspace.getConfiguration('roundtable').get<boolean>('autoCheckUpdates', true);
}

export function isProUser(): boolean {
  // Synchronous check: key exists and matches known format
  const key = getLicenseKey();
  if (!key || key.trim().length === 0) { return false; }
  // Accept LemonSqueezy format or RT- prefix format
  return /^[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}-[A-F0-9]{8}$/i.test(key.trim()) ||
         /^RT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(key.trim());
}

export const PURCHASE_URL = 'https://unicorntech.lemonsqueezy.com/checkout/buy/06250cd4-2a4b-48fd-9e9a-5621881e5242';
