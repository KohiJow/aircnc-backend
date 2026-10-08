const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'src', 'server.js');

// sobe o processo de verdade: valida o ambiente, abre a porta e so entao tenta o mongo
function startServer(env) {
  const child = spawn(process.execPath, [ENTRY], { cwd: ROOT, env: { ...process.env, ...env } });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => (stdout += chunk));
  child.stderr.on('data', chunk => (stderr += chunk));
  const exited = new Promise(resolve => child.on('exit', code => resolve(code)));
  const output = () => ({ stdout, stderr });
  return { child, exited, output };
}

const waitFor = (fn, timeout = 8000) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const value = fn();
      if (value) return resolve(value);
      if (Date.now() - started > timeout) return reject(new Error('timeout'));
      setTimeout(tick, 50);
    };
    tick();
  });

describe('src/server.js', () => {
  let uploadDir;
  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircnc-server-'));
  });
  afterEach(() => fs.rmSync(uploadDir, { recursive: true, force: true }));

  test('sobe sem mongo, responde as rotas base, 503 nas de dominio e encerra no SIGTERM', async () => {
    const server = startServer({
      NODE_ENV: 'test',
      LOG_LEVEL: 'info',
      MONGO_URI: 'mongodb://127.0.0.1:1/aircnc-inexistente',
      PORT: '0',
      UPLOAD_DIR: uploadDir,
      DB_CONNECT_TIMEOUT_MS: '300',
      DB_RETRY_MS: '60000'
    });

    try {
      const port = await waitFor(() => (server.output().stdout.match(/servidor em http:\/\/localhost:(\d+)/) || [])[1]);

      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect(health.status).toBe(200);
      expect(await health.json()).toMatchObject({ status: 'degraded', database: 'disconnected' });

      const ping = await fetch(`http://127.0.0.1:${port}/ping`);
      expect(await ping.text()).toBe('pong');

      const spots = await fetch(`http://127.0.0.1:${port}/spots`);
      expect(spots.status).toBe(503);
      expect(await spots.json()).toEqual({ error: 'banco de dados indisponivel' });

      await waitFor(() => /falha ao conectar no MongoDB/.test(server.output().stderr));
    } finally {
      server.child.kill('SIGTERM');
    }

    expect(await server.exited).toBe(0);
    expect(server.output().stdout).toMatch(/SIGTERM recebido, encerrando/);
  }, 15000);

  test('sai com codigo 1 listando os problemas do ambiente', async () => {
    const server = startServer({ NODE_ENV: 'test', LOG_LEVEL: 'info', MONGO_URI: '', PORT: 'abc', UPLOAD_DIR: uploadDir });

    expect(await server.exited).toBe(1);
    const { stderr } = server.output();
    expect(stderr).toMatch(/configuracao invalida/);
    expect(stderr).toMatch(/MONGO_URI e obrigatoria/);
    expect(stderr).toMatch(/PORT precisa ser um inteiro/);
  }, 15000);
});
