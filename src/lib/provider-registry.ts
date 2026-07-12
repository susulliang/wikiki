/**
 * Provider registry & dispatcher for Wikiki's cloud sync.
 *
 * This module is split out of cloud-provider.ts to avoid a circular import:
 *   cloud-provider.ts  defines the abstract BaseCloudProvider
 *   edgeone-blob.ts    imports BaseCloudProvider from cloud-provider.ts
 *   vercel-blob.ts     imports BaseCloudProvider from cloud-provider.ts
 *   this registry      imports edgeoneProvider + vercelProvider
 *
 * Keeping the registry here means cloud-provider.ts never imports the concrete
 * providers, so there is no cycle that would leave BaseCloudProvider undefined
 * at module-init time (which previously threw "X is not a constructor").
 */
import { edgeoneProvider } from '@/lib/edgeone-blob';
import { vercelProvider } from '@/lib/vercel-blob';
import type { CloudProvider, ProviderId } from '@/lib/cloud-provider';

const ACTIVE_PROVIDER_KEY = '__wikiki_cloud_provider';

const PROVIDERS: Record<ProviderId, CloudProvider> = {
  edgeone: edgeoneProvider,
  vercel: vercelProvider,
};

export function getActiveProviderId(): ProviderId {
  try {
    const v = localStorage.getItem(ACTIVE_PROVIDER_KEY);
    if (v === 'edgeone' || v === 'vercel') return v;
  } catch {
    // ignore
  }
  return 'edgeone';
}

export function setActiveProviderId(id: ProviderId): void {
  try {
    localStorage.setItem(ACTIVE_PROVIDER_KEY, id);
  } catch {
    // ignore
  }
}

export function getActiveProvider(): CloudProvider {
  return PROVIDERS[getActiveProviderId()];
}

export function getProvider(id: ProviderId): CloudProvider {
  return PROVIDERS[id];
}
