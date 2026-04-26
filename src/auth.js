import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export const PROVIDERS = [
  { id: 'codex', label: 'Codex', credentialLabel: 'Codex / OpenAI API Key' },
  { id: 'claude', label: 'Claude', credentialLabel: 'Claude API Key' },
  { id: 'gemini', label: 'Gemini', credentialLabel: 'Gemini API Key' }
];

export const IMPLEMENTATION_AGENTS = ['alpha', 'beta', 'gamma'];

export const AGENT_META = {
  alpha: { label: 'Agent Alpha', strategy: '요청과 코드베이스를 보고 자율적으로 구현 전략 수립' },
  beta: { label: 'Agent Beta', strategy: '요청과 코드베이스를 보고 자율적으로 구현 전략 수립' },
  gamma: { label: 'Agent Gamma', strategy: '요청과 코드베이스를 보고 자율적으로 구현 전략 수립' }
};

const DEFAULT_AGENT_PROVIDER = {
  alpha: 'codex',
  beta: 'claude',
  gamma: 'gemini'
};

const LEGACY_AGENT_ALIASES = {
  oop: 'alpha',
  procedural: 'beta',
  functional: 'gamma'
};

const SERVICE_NAME = 'multiverse-sec';

function getConfigRoot() {
  if (process.env.MULTIVERSE_SEC_CONFIG_DIR) {
    return process.env.MULTIVERSE_SEC_CONFIG_DIR;
  }
  return path.join(os.homedir(), '.multiverse-sec');
}

function ensureConfigRoot() {
  const root = getConfigRoot();
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  return root;
}

function getConfigPath() {
  return path.join(ensureConfigRoot(), 'config.json');
}

function getBackendMode() {
  if (process.env.MULTIVERSE_SEC_TEST_SECRET_BACKEND) {
    return process.env.MULTIVERSE_SEC_TEST_SECRET_BACKEND;
  }
  if (process.platform === 'darwin') {
    return 'keychain';
  }
  return 'file';
}

function getSecretPath(provider) {
  return path.join(ensureConfigRoot(), `${provider}.secret`);
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}

function keychainAccount(provider) {
  return `${SERVICE_NAME}:${provider}`;
}

function storeInKeychain(provider, secret) {
  const account = keychainAccount(provider);
  spawnSync('security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', account], { encoding: 'utf8' });
  const result = spawnSync('security', ['add-generic-password', '-U', '-s', SERVICE_NAME, '-a', account, '-w', secret], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Keychain 저장에 실패했습니다.');
  }
}

function readFromKeychain(provider) {
  const account = keychainAccount(provider);
  const result = spawnSync('security', ['find-generic-password', '-s', SERVICE_NAME, '-a', account, '-w'], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.trim();
}

function deleteFromKeychain(provider) {
  const account = keychainAccount(provider);
  spawnSync('security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', account], { encoding: 'utf8' });
}

function storeSecret(provider, secret) {
  const backend = getBackendMode();
  if (backend === 'keychain') {
    storeInKeychain(provider, secret);
    return 'macOS Keychain';
  }
  fs.writeFileSync(getSecretPath(provider), secret, { mode: 0o600 });
  return '로컬 보호 파일';
}

function readSecret(provider) {
  const backend = getBackendMode();
  if (backend === 'keychain') return readFromKeychain(provider);
  try {
    return fs.readFileSync(getSecretPath(provider), 'utf8').trim();
  } catch {
    return null;
  }
}

function deleteSecret(provider) {
  const backend = getBackendMode();
  if (backend === 'keychain') return deleteFromKeychain(provider);
  try {
    fs.unlinkSync(getSecretPath(provider));
  } catch {}
}

function defaultAgentSettings() {
  return Object.fromEntries(
    IMPLEMENTATION_AGENTS.map((agent) => [agent, { provider: DEFAULT_AGENT_PROVIDER[agent], model: null }])
  );
}

export function normalizeAgentId(agent) {
  return LEGACY_AGENT_ALIASES[agent] ?? agent;
}

function configuredProviders(config) {
  return PROVIDERS
    .map((provider) => provider.id)
    .filter((provider) => Boolean(config.providers?.[provider]?.configured && getStoredCredential(provider)));
}

export function loadAuthConfig() {
  const config = readJson(getConfigPath(), {
    defaultProvider: null,
    providers: {},
    agentSettings: defaultAgentSettings()
  });

  config.providers ??= {};
  config.agentSettings ??= {};
  for (const [legacyAgent, migratedAgent] of Object.entries(LEGACY_AGENT_ALIASES)) {
    if (config.agentSettings[legacyAgent] && !config.agentSettings[migratedAgent]) {
      config.agentSettings[migratedAgent] = config.agentSettings[legacyAgent];
    }
    delete config.agentSettings[legacyAgent];
  }
  for (const agent of IMPLEMENTATION_AGENTS) {
    config.agentSettings[agent] = {
      provider: config.agentSettings[agent]?.provider ?? DEFAULT_AGENT_PROVIDER[agent],
      model: config.agentSettings[agent]?.model ?? null
    };
  }
  return config;
}

export function saveAuthConfig(config) {
  writeJson(getConfigPath(), config);
}

export function getProviderMeta(provider) {
  return PROVIDERS.find((item) => item.id === provider) ?? null;
}

export function getAgentMeta(agent) {
  return AGENT_META[normalizeAgentId(agent)] ?? null;
}

export function getStoredCredential(provider) {
  return readSecret(provider);
}

export function isProviderConfigured(provider) {
  const config = loadAuthConfig();
  return Boolean(config.providers?.[provider]?.configured && getStoredCredential(provider));
}

export function listProviderStates() {
  const config = loadAuthConfig();
  return PROVIDERS.map((provider) => ({
    ...provider,
    configured: Boolean(config.providers?.[provider.id]?.configured && getStoredCredential(provider.id)),
    isDefault: config.defaultProvider === provider.id,
    assignedAgents: IMPLEMENTATION_AGENTS.filter((agent) => config.agentSettings?.[agent]?.provider === provider.id)
  }));
}

export function listAgentStates() {
  const config = loadAuthConfig();
  const activeProviders = configuredProviders(config);
  const forcedProvider = activeProviders.length === 1 ? activeProviders[0] : null;
  return IMPLEMENTATION_AGENTS.map((agent) => {
    const preferredProvider = config.agentSettings?.[agent]?.provider ?? DEFAULT_AGENT_PROVIDER[agent];
    const fallbackProvider = forcedProvider ?? resolveDefaultProvider();
    const effectiveProvider = forcedProvider || (isProviderConfigured(preferredProvider) ? preferredProvider : fallbackProvider);
    return {
      id: agent,
      ...AGENT_META[agent],
      provider: preferredProvider,
      effectiveProvider,
      model: config.agentSettings?.[agent]?.model ?? null,
      forcedProvider
    };
  });
}

export function setProviderCredential(provider, secret, makeDefault = false) {
  const config = loadAuthConfig();
  const storageLabel = storeSecret(provider, secret);
  config.providers[provider] = {
    configured: true,
    storage: storageLabel,
    updatedAt: new Date().toISOString()
  };
  if (makeDefault || !config.defaultProvider) {
    config.defaultProvider = provider;
  }
  saveAuthConfig(config);
  return { storageLabel, config };
}

export function setDefaultProvider(provider) {
  if (!isProviderConfigured(provider)) {
    throw new Error('기본 provider로 설정하려면 먼저 연결되어 있어야 합니다.');
  }
  const config = loadAuthConfig();
  config.defaultProvider = provider;
  saveAuthConfig(config);
}

export function assignAgentProvider(agent, provider) {
  agent = normalizeAgentId(agent);
  if (!IMPLEMENTATION_AGENTS.includes(agent)) {
    throw new Error(`지원하지 않는 에이전트입니다: ${agent}`);
  }
  if (!isProviderConfigured(provider)) {
    throw new Error('해당 provider가 연결되어 있지 않습니다.');
  }
  const config = loadAuthConfig();
  config.agentSettings[agent] = {
    ...config.agentSettings[agent],
    provider
  };
  saveAuthConfig(config);
}

export function clearAgentProvider(agent) {
  agent = normalizeAgentId(agent);
  if (!IMPLEMENTATION_AGENTS.includes(agent)) {
    throw new Error(`지원하지 않는 에이전트입니다: ${agent}`);
  }
  const config = loadAuthConfig();
  config.agentSettings[agent] = {
    ...config.agentSettings[agent],
    provider: DEFAULT_AGENT_PROVIDER[agent]
  };
  saveAuthConfig(config);
}

export function setAgentModel(agent, model) {
  agent = normalizeAgentId(agent);
  if (!IMPLEMENTATION_AGENTS.includes(agent)) {
    throw new Error(`지원하지 않는 에이전트입니다: ${agent}`);
  }
  if (!model) {
    throw new Error('모델 이름이 비어 있습니다.');
  }
  const config = loadAuthConfig();
  config.agentSettings[agent] = {
    ...config.agentSettings[agent],
    model
  };
  saveAuthConfig(config);
}

export function clearAgentModel(agent) {
  agent = normalizeAgentId(agent);
  if (!IMPLEMENTATION_AGENTS.includes(agent)) {
    throw new Error(`지원하지 않는 에이전트입니다: ${agent}`);
  }
  const config = loadAuthConfig();
  config.agentSettings[agent] = {
    ...config.agentSettings[agent],
    model: null
  };
  saveAuthConfig(config);
}

export function getAgentSettings() {
  const config = loadAuthConfig();
  return structuredClone(config.agentSettings);
}

export function resolveDefaultProvider() {
  const config = loadAuthConfig();
  if (config.defaultProvider && getStoredCredential(config.defaultProvider)) {
    return config.defaultProvider;
  }
  for (const provider of PROVIDERS) {
    if (config.providers?.[provider.id]?.configured && getStoredCredential(provider.id)) {
      config.defaultProvider = provider.id;
      saveAuthConfig(config);
      return provider.id;
    }
  }
  return null;
}

export function resolveAgentConfig(agent) {
  agent = normalizeAgentId(agent);
  const config = loadAuthConfig();
  const preferredProvider = config.agentSettings?.[agent]?.provider ?? DEFAULT_AGENT_PROVIDER[agent];
  const activeProviders = configuredProviders(config);
  const forcedProvider = activeProviders.length === 1 ? activeProviders[0] : null;
  const provider = forcedProvider || (isProviderConfigured(preferredProvider) ? preferredProvider : resolveDefaultProvider());
  return {
    agent,
    provider,
    model: config.agentSettings?.[agent]?.model ?? null,
    forcedProvider
  };
}

export function removeProviderCredential(provider) {
  const config = loadAuthConfig();
  deleteSecret(provider);
  delete config.providers[provider];
  for (const agent of IMPLEMENTATION_AGENTS) {
    if (config.agentSettings?.[agent]?.provider === provider) {
      config.agentSettings[agent].provider = DEFAULT_AGENT_PROVIDER[agent];
    }
  }
  if (config.defaultProvider === provider) {
    const nextProvider = Object.keys(config.providers).find((item) => isProviderConfigured(item)) ?? null;
    config.defaultProvider = nextProvider;
  }
  saveAuthConfig(config);
}

export async function ask(question) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

export async function askHidden(question) {
  if (!input.isTTY) {
    throw new Error('보안 입력은 TTY 환경에서만 가능합니다.');
  }
  output.write(question);
  input.setRawMode?.(true);
  input.resume();
  input.setEncoding('utf8');
  return await new Promise((resolve) => {
    let value = '';
    const onData = (chunk) => {
      const char = String(chunk);
      if (char === '\r' || char === '\n') {
        output.write('\n');
        input.setRawMode?.(false);
        input.pause();
        input.removeListener('data', onData);
        resolve(value.trim());
        return;
      }
      if (char === '\u0003') {
        output.write('^C\n');
        process.exit(1);
      }
      if (char === '\u007f') {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    input.on('data', onData);
  });
}

export async function chooseProvider(excluded = []) {
  console.log('연결할 AI 제공자를 선택하세요.');
  const candidates = PROVIDERS.filter((provider) => !excluded.includes(provider.id));
  for (const [index, provider] of candidates.entries()) {
    console.log(`${index + 1}. ${provider.label}`);
  }
  const answer = await ask('번호를 입력하세요: ');
  const provider = candidates[Number(answer) - 1];
  if (!provider) {
    throw new Error('올바른 provider 번호를 입력해주세요.');
  }
  return provider.id;
}

export async function runInteractiveLogin(preselectedProvider = null, presetSecret = null) {
  const provider = preselectedProvider ?? await chooseProvider();
  const meta = getProviderMeta(provider);
  if (!meta) throw new Error('지원하지 않는 provider입니다.');
  const secret = presetSecret ?? await askHidden(`${meta.credentialLabel}를 입력하세요: `);
  if (!secret) throw new Error('비어 있는 키는 저장할 수 없습니다.');
  const defaultAnswer = await ask('기본 provider로 설정할까요? (Y/n): ');
  const makeDefault = defaultAnswer === '' || /^y(es)?$/i.test(defaultAnswer);
  const { storageLabel } = setProviderCredential(provider, secret, makeDefault);
  return { provider, storageLabel, makeDefault };
}

export async function ensureAuthenticatedOnboarding() {
  const provider = resolveDefaultProvider();
  if (provider) return provider;

  console.log('초기 연결이 필요합니다. 한번만 설정하면 다음부터 자동으로 재사용됩니다.');
  const configured = [];
  let keepGoing = true;
  while (keepGoing) {
    const result = await runInteractiveLogin(configured.length === 0 ? null : await chooseProvider(configured));
    configured.push(result.provider);
    console.log(`${getProviderMeta(result.provider).label} 연결 완료 · 저장 위치: ${result.storageLabel}`);
    if (configured.length >= PROVIDERS.length) break;
    const answer = await ask('다른 provider도 계속 연결할까요? (y/N): ');
    keepGoing = /^y(es)?$/i.test(answer);
  }
  return resolveDefaultProvider();
}
