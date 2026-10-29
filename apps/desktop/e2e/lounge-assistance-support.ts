import type { Page } from '@playwright/test';
import type { AssistanceInvitation } from '../src/remoteAssistance/store';

declare global { interface Window { loungeAssistanceFixture: {
  invited: string[]; permissions: boolean; end: () => void;
} } }

/** Exercise the real assistance store without inviting a real account. */
export async function setupAssistance(page: Page) {
  await page.addInitScript(() => {
    const native = (window as unknown as { __TAURI_INTERNALS__: {
      invoke: (command: string, args?: { request: { kind: string; email?: string; id?: string } }) => Promise<unknown>;
    } }).__TAURI_INTERNALS__;
    const original = native.invoke;
    let requests: AssistanceInvitation[] = [];
    window.loungeAssistanceFixture = { invited: [], permissions: true, end: () => { requests = []; } };
    native.invoke = async (command, args) => {
      const fixture = window.loungeAssistanceFixture;
      if (command === 'remote_desktop_permissions') return { enabled: fixture.permissions, control: fixture.permissions };
      if (command !== 'remote_assistance') return original(command, args);
      const request = args?.request;
      if (request?.kind === 'invite') {
        fixture.invited.push(request.email!);
        requests = [{ id: crypto.randomUUID(), hostDeviceId: 'alice-pc', hostName: 'Alice PC',
          hostEmail: 'alice@example.test', helperEmail: request.email!, state: 'pending',
          expiresAt: new Date(Date.now() + 300_000).toISOString() }];
      }
      if (request?.kind === 'respond') requests = requests.map(value => ({ ...value, state: 'ended' }));
      return { identity: { baseUrl: 'https://lounge.test', userId: 'alice' }, currentDeviceId: 'alice-pc', requests };
    };
  });
}
