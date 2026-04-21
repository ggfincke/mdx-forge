// Local HTTP preview server — serves the latest render at a stable URL on
// 127.0.0.1 and live-reloads open tabs via SSE whenever a new render arrives.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { spawn } from 'node:child_process';

interface PreviewState {
  html: string | undefined;
  listeners: Set<ServerResponse>;
}

const state: PreviewState = {
  html: undefined,
  listeners: new Set(),
};

let server: Server | undefined;
let serverPort: number | undefined;
let startPromise: Promise<string> | undefined;
let hasAutoOpened = false;

const LIVE_RELOAD_SCRIPT = `
<script>
  (function() {
    var src = new EventSource('/events');
    src.addEventListener('reload', function() { window.location.reload(); });
    src.onerror = function() {
      src.close();
      // try again after a short delay
      setTimeout(function() { window.location.reload(); }, 1000);
    };
  })();
</script>
`;

const EMPTY_DOCUMENT = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>mdx-forge-render</title></head>
<body style="font-family: system-ui, sans-serif; padding: 2rem; color: #666;">
  <p>No preview yet. Call <code>render_mdx</code> to populate this page.</p>
${LIVE_RELOAD_SCRIPT}
</body>
</html>`;

function injectLiveReload(html: string): string {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`);
  }
  return `${html}${LIVE_RELOAD_SCRIPT}`;
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url ?? '/';

  if (url === '/' || url === '/preview' || url === '/preview/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(injectLiveReload(state.html ?? EMPTY_DOCUMENT));
    return;
  }

  if (url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 1000\n\n');
    state.listeners.add(res);
    req.on('close', () => {
      state.listeners.delete(res);
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('not found');
}

export async function startPreviewServer(): Promise<string> {
  if (startPromise) {
    return startPromise;
  }

  startPromise = new Promise<string>((resolve, reject) => {
    const httpServer = createServer(handleRequest);
    httpServer.on('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('failed to bind preview server'));
        return;
      }
      server = httpServer;
      serverPort = address.port;
      resolve(`http://127.0.0.1:${address.port}/preview`);
    });
  });

  return startPromise;
}

export function getPreviewUrl(): string | undefined {
  if (!serverPort) {
    return undefined;
  }
  return `http://127.0.0.1:${serverPort}/preview`;
}

export function updatePreview(html: string): void {
  state.html = html;
  const payload = 'event: reload\ndata: 1\n\n';
  for (const listener of state.listeners) {
    listener.write(payload);
  }
}

export async function stopPreviewServer(): Promise<void> {
  for (const listener of state.listeners) {
    listener.end();
  }
  state.listeners.clear();
  const currentServer = server;
  server = undefined;
  serverPort = undefined;
  startPromise = undefined;
  if (!currentServer) {
    return;
  }
  await new Promise<void>((resolve) => {
    currentServer.close(() => resolve());
  });
}

// Open a URL in the user's default browser. Detached so the child process
// keeps running after this handler returns.
export function openInBrowser(url: string): void {
  let command: string;
  let args: string[];

  if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '""', url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // ignore — auto-open is best-effort
  }
}

// Open once per server lifetime. Live reload handles subsequent renders,
// so we don't steal focus on every call.
export function autoOpenOnce(url: string): void {
  if (hasAutoOpened) {
    return;
  }
  hasAutoOpened = true;
  openInBrowser(url);
}
