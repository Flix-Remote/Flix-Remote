import { mountOriginalRemote } from './mount.ts';
import type { PageHost } from './bridge.ts';

// Render the bundled surface before evaluating the protocol/install engines.
// Startup requests wait for the real host, with no substituted responses.
let host: PageHost | undefined;
let resolveHost!: (value: PageHost) => void;
const hostReady = new Promise<PageHost>(resolve => { resolveHost = resolve; });
export let originalSurface: Awaited<ReturnType<typeof mountOriginalRemote>> | undefined;
export function connectOriginalHost(value: PageHost) { host = value; resolveHost(value); }
export async function renderOriginalSurface() {
  originalSurface = await mountOriginalRemote({
    api: async <T>(...args: Parameters<PageHost['api']>) => (await hostReady).api<T>(...args),
    household: async (operation, data) => {
      const connected = await hostReady;
      if (!connected.household) throw Error('حدّث نسخة التطبيق لاستخدام الملفات والإدارة.');
      return connected.household(operation, data);
    },
    selected: () => host?.selected() || '',
    select: id => { void hostReady.then(h => h.select(id)); },
    open: (action, target) => { void hostReady.then(h => h.open(action, target)); },
    record: (...args) => { void hostReady.then(h => h.record(...args)); },
  });
  await originalSurface.painted;
}
