export const discoveryEntries = [
  { page: 'devices', label: 'client.app.devices' },
  { page: 'totp', label: 'client.discovery.twoFactor' },
  { page: 'downloads', label: 'client.downloads.downloads' },
] as const;

export type DiscoveryPage = typeof discoveryEntries[number]['page'];

export function isDiscoveryPage(page: string): page is DiscoveryPage {
  return discoveryEntries.some(entry => entry.page === page);
}

export function primaryNavigationPage(page: string): string {
  return isDiscoveryPage(page) ? 'discover' : page;
}
