#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  AGENT_META,
  IMPLEMENTATION_AGENTS,
  assignAgentProvider,
  clearAgentModel,
  clearAgentProvider,
  ensureAuthenticatedOnboarding,
  getAgentMeta,
  getProviderMeta,
  getStoredCredential,
  listAgentStates,
  listProviderStates,
  normalizeAgentId,
  removeProviderCredential,
  resolveAgentConfig,
  runInteractiveLogin,
  setAgentModel,
  setDefaultProvider
} from './auth.js';
import { orchestrateWorkspacePatch } from './engine.js';
import { RunTui } from './tui.js';
import { DashboardTui } from './dashboard-tui.js';
import { buildWorkspaceSnapshot, applyWorkspaceChanges, describeWorkspacePath } from './workspace.js';
import { getDefaultModel } from './providers.js';

const color = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  blue: '\u001b[34m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  magenta: '\u001b[35m'
};

function paint(text, tone) {
  return `${color[tone] ?? ''}${text}${color.reset}`;
}

function ensureLogDir(rootDir) {
  const logDir = path.join(rootDir, '.multiverse-sec', 'logs');
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

function writeFailureLog(rootDir, payload) {
  const logDir = ensureLogDir(rootDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(logDir, `run-failure-${timestamp}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return filePath;
}

function normalizeSlashCommand(command) {
  const aliases = {
    '/mode': 'mode',
    '/login': 'login',
    '/oauth': 'login',
    '/providers': 'providers',
    '/agents': 'agents',
    '/use': 'use',
    '/assign': 'assign',
    '/unassign': 'unassign',
    '/model': 'model',
    '/unmodel': 'unmodel',
    '/logout': 'logout',
    '/cleanup': 'cleanup',
    '/run': 'run',
    '/tui': 'tui',
    '/dashboard': 'tui'
  };
  return aliases[command] ?? command;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const promptParts = [];
  let provider = null;
  let command = null;
  let apiKey = null;
  let agent = null;
  let model = null;

  if (args[0]?.startsWith('/')) {
    command = normalizeSlashCommand(args[0]);
    const slashArgs = args.slice(1);
    if (command === 'use') provider = slashArgs[0] ?? null;
    if (command === 'assign') {
      agent = slashArgs[0] ?? null;
      provider = slashArgs[1] ?? null;
    }
    if (command === 'unassign') agent = slashArgs[0] ?? null;
    if (command === 'logout') provider = slashArgs[0] ?? null;
    if (command === 'login' && slashArgs[0] && !slashArgs[0].startsWith('--')) provider = slashArgs[0];
    if (command === 'model') {
      agent = slashArgs[0] ?? null;
      model = slashArgs[1] ?? null;
    }
    if (command === 'unmodel') agent = slashArgs[0] ?? null;
    if (command === 'run') promptParts.push(...slashArgs.filter((arg) => !arg.startsWith('--')));
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg.startsWith('/')) continue;
    if (['login', 'providers', 'agents', 'logout', 'use', 'assign', 'unassign', 'model', 'unmodel', 'cleanup', 'mode', 'run', 'tui', 'dashboard'].includes(arg) && !command) {
      command = arg;
    } else if (arg === '--provider') {
      provider = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--api-key') {
      apiKey = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--agent') {
      agent = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--model') {
      model = args[index + 1] ?? null;
      index += 1;
    } else if (!arg.startsWith('--')) {
      if (command === 'assign' && !agent) {
        agent = arg;
      } else if (command === 'assign' && !provider) {
        provider = arg;
      } else if (command === 'model' && !agent) {
        agent = arg;
      } else if (command === 'model' && !model) {
        model = arg;
      } else if ((command === 'unassign' || command === 'unmodel') && !agent) {
        agent = arg;
      } else if ((command === 'use' || command === 'logout' || command === 'login') && !provider) {
        provider = arg;
      } else {
        promptParts.push(arg);
      }
    }
  }

  return {
    help: args.includes('--help') || args.includes('-h'),
    dryRun: args.includes('--dry-run'),
    plain: args.includes('--plain'),
    prompt: promptParts.join(' ').trim(),
    provider,
    apiKey,
    command,
    agent,
    model
  };
}

function providerLabel(provider) {
  return getProviderMeta(provider)?.label ?? provider ?? '미설정';
}

function printModeGuide() {
  console.log(paint('Multiverse Secure 모드 안내', 'bold'));
  console.log('- /login [provider]         : provider 연결을 시작합니다.');
  console.log('- /providers                : 연결된 provider 상태를 봅니다.');
  console.log('- /agents                   : 3개 자율 에이전트 설정을 봅니다.');
  console.log('- /assign <agent> <provider>: 에이전트별 provider를 지정합니다.');
  console.log('- /model <agent> <model>    : 에이전트별 모델을 지정합니다.');
  console.log('- /cleanup                  : 예전 tmux 분할 세션을 전부 정리합니다.');
  console.log('- /tui                      : 통합 대시보드 TUI를 실행합니다.');
  console.log('- /run "요청 내용"          : 현재 폴더에 기능을 반영합니다.');
  console.log('');
  console.log('에이전트 목록: alpha, beta, gamma');
}

function printHelp() {
  console.log('사용법:');
  console.log('  multiverse-sec login [--provider codex|claude|gemini]');
  console.log('  multiverse-sec providers');
  console.log('  multiverse-sec agents');
  console.log('  multiverse-sec use --provider codex|claude|gemini');
  console.log('  multiverse-sec assign --agent alpha|beta|gamma --provider codex|claude|gemini');
  console.log('  multiverse-sec model --agent alpha|beta|gamma --model <model>');
  console.log('  multiverse-sec unassign --agent alpha|beta|gamma');
  console.log('  multiverse-sec unmodel --agent alpha|beta|gamma');
  console.log('  multiverse-sec logout --provider codex|claude|gemini');
  console.log('  multiverse-sec cleanup');
  console.log('  multiverse-sec tui');
  console.log('  multiverse-sec run "로그인 기능 추가해줘" [--dry-run] [--plain]');
  console.log('  multiverse-sec /assign alpha codex');
  console.log('  multiverse-sec /model beta claude-sonnet-4-5');
  console.log('  multiverse-sec /cleanup');
  console.log('  multiverse-sec /tui');
  console.log('  multiverse-sec /run "로그인 기능 추가해줘"');
}

function printProviders() {
  const states = listProviderStates();
  console.log(paint('연결된 AI 제공자 상태', 'bold'));
  for (const state of states) {
    const status = state.configured ? paint('연결됨', 'green') : paint('미연결', 'yellow');
    const defaultMark = state.isDefault ? paint(' (기본)', 'cyan') : '';
    const agents = state.assignedAgents.length ? ` · 에이전트: ${state.assignedAgents.join(', ')}` : '';
    console.log(`- ${state.label}: ${status}${defaultMark}${agents}`);
  }
}

function printAgents() {
  const states = listAgentStates();
  console.log(paint('자율 에이전트 설정', 'bold'));
  for (const state of states) {
    const provider = state.provider ? providerLabel(state.provider) : '미설정';
    const effectiveProvider = state.effectiveProvider ? providerLabel(state.effectiveProvider) : '미연결';
    const model = state.model ?? `(기본: ${getDefaultModel(state.effectiveProvider || state.provider) ?? '없음'})`;
    console.log(`- ${state.id}: ${state.label}`);
    console.log(`  역할: ${state.strategy}`);
    console.log(`  provider: ${provider} · 실제 사용: ${effectiveProvider}`);
    if (state.forcedProvider) {
      console.log(`  fallback: 단일 연결 provider(${providerLabel(state.forcedProvider)})를 3개 에이전트가 함께 사용`);
    }
    console.log(`  model: ${model}`);
  }
}

async function runLogin(provider, apiKey) {
  const result = await runInteractiveLogin(provider ?? null, apiKey ?? null);
  console.log(paint(`${getProviderMeta(result.provider).label} 연결 완료`, 'green'));
  console.log(`저장 위치: ${result.storageLabel}`);
  if (result.makeDefault) console.log('기본 provider로 설정했습니다.');
}

function runUse(provider) {
  if (!provider) throw new Error('use에는 --provider 가 필요합니다.');
  setDefaultProvider(provider);
  console.log(paint(`${providerLabel(provider)}를 기본 provider로 설정했습니다.`, 'green'));
}

function runAssign(agent, provider) {
  agent = normalizeAgentId(agent);
  if (!agent || !provider) throw new Error('assign에는 --agent 와 --provider 가 필요합니다.');
  assignAgentProvider(agent, provider);
  console.log(paint(`${agent} 에이전트에 ${providerLabel(provider)}를 할당했습니다.`, 'green'));
}

function runUnassign(agent) {
  agent = normalizeAgentId(agent);
  if (!agent) throw new Error('unassign에는 --agent 가 필요합니다.');
  clearAgentProvider(agent);
  console.log(paint(`${agent} 에이전트 provider를 기본값으로 되돌렸습니다.`, 'green'));
}

function runModel(agent, model) {
  agent = normalizeAgentId(agent);
  if (!agent || !model) throw new Error('model에는 --agent 와 --model 이 필요합니다.');
  setAgentModel(agent, model);
  console.log(paint(`${agent} 에이전트 모델을 ${model}로 설정했습니다.`, 'green'));
}

function runUnmodel(agent) {
  agent = normalizeAgentId(agent);
  if (!agent) throw new Error('unmodel에는 --agent 가 필요합니다.');
  clearAgentModel(agent);
  console.log(paint(`${agent} 에이전트 모델 오버라이드를 제거했습니다.`, 'green'));
}

function runLogout(provider) {
  if (!provider) throw new Error('logout에는 --provider 가 필요합니다.');
  if (!getStoredCredential(provider)) throw new Error('해당 provider는 현재 연결되어 있지 않습니다.');
  removeProviderCredential(provider);
  console.log(paint(`${providerLabel(provider)} 연결을 제거했습니다.`, 'green'));
}

function listMultiverseTmuxSessions() {
  const result = spawnSync('tmux', ['list-sessions', '-F', '#{session_name}'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => name.startsWith('multiverse-sec'));
}

function runCleanup() {
  const sessions = listMultiverseTmuxSessions();
  if (sessions.length === 0) {
    console.log(paint('정리할 multiverse-sec tmux 세션이 없습니다.', 'yellow'));
    return;
  }

  for (const session of sessions) {
    const result = spawnSync('tmux', ['kill-session', '-t', session], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(result.stderr || `${session} 세션 종료에 실패했습니다.`);
    }
  }
  console.log(paint(`tmux 세션 ${sessions.length}개를 정리했습니다.`, 'green'));
}

function printRunSummary(result, dryRun, changedFiles, agentConfigs) {
  const singleProviderFallback = agentConfigs[0]?.forcedProvider ?? null;
  if (singleProviderFallback) {
    console.log(paint(`Single provider fallback active: ${providerLabel(singleProviderFallback)} provider 하나로 3개 에이전트를 모두 실행했습니다.`, 'yellow'));
    console.log();
  }
  console.log();
  console.log(paint('Proposal Round', 'magenta'));
  for (const proposal of result.proposals) {
    const meta = getAgentMeta(proposal.agent);
    console.log(`- ${meta.label}: [${proposal.strategy}] ${proposal.summary}`);
    for (const plan of proposal.plan.slice(0, 3)) {
      console.log(`  · plan: ${plan}`);
    }
    for (const reason of proposal.reasons.slice(0, 3)) {
      console.log(`  · ${reason}`);
    }
  }

  console.log();
  console.log(paint('Critique Round', 'yellow'));
  for (const critique of result.critiques) {
    console.log(`- ${critique.agent} -> ${critique.preferredAgent}`);
    for (const point of critique.debatePoints.slice(0, 2)) {
      console.log(`  · debate: ${point}`);
    }
    for (const issue of critique.issues.slice(0, 2)) {
      console.log(`  · ${issue}`);
    }
  }

  console.log();
  console.log(paint('Winner', 'green'));
  console.log(`- selected: ${result.selection.winner}`);
  console.log(`- strategy: ${result.finalPatch.winningStrategy}`);
  console.log(`- votes: ${JSON.stringify(result.selection.votes)}`);
  console.log(`- summary: ${result.finalPatch.summary}`);
  for (const reason of result.finalPatch.reasons) {
    console.log(`  ✓ ${reason}`);
  }
  for (const point of result.finalPatch.debateResolution.slice(0, 3)) {
    console.log(`  · resolved: ${point}`);
  }

  console.log();
  console.log(paint(dryRun ? 'Planned Changes' : 'Applied Changes', 'cyan'));
  for (const change of result.finalPatch.changes) {
    console.log(`- ${change.action}: ${change.path}`);
  }
  if (!dryRun) {
    console.log(`변경 파일 수: ${changedFiles.length}`);
  }
}

async function runOrchestration(prompt, dryRun, plain = false) {
  await ensureAuthenticatedOnboarding();

  const agentConfigs = IMPLEMENTATION_AGENTS.map((agent) => {
    const config = resolveAgentConfig(agent);
    if (!config.provider || !getStoredCredential(config.provider)) {
      throw new Error(`${agent} 에이전트에 사용할 provider credential이 없습니다.`);
    }
    return config;
  });

  const snapshot = buildWorkspaceSnapshot(process.cwd());
  if (snapshot.fileCount === 0) {
    throw new Error('현재 작업 폴더에서 읽을 수 있는 텍스트 파일을 찾지 못했습니다.');
  }

  const useTui = process.stdout.isTTY && !plain;
  const tui = useTui ? new RunTui({ prompt, agentConfigs, dryRun }) : null;

  if (tui) {
    tui.start();
  } else {
    console.log(paint('Multiverse Secure Workspace Run', 'magenta'));
    console.log(paint(`Prompt: ${prompt}`, 'dim'));
    console.log(paint(`Workspace: ${process.cwd()}`, 'dim'));
    console.log(paint(`Files in context: ${snapshot.fileCount}`, 'dim'));
    console.log(paint(`Agents: ${agentConfigs.map((config) => `${config.agent}=${providerLabel(config.provider)}:${config.model || getDefaultModel(config.provider)}`).join(', ')}`, 'dim'));
    if (agentConfigs[0]?.forcedProvider) {
      console.log(paint(`Single provider fallback: ${providerLabel(agentConfigs[0].forcedProvider)} provider 하나로 3개 에이전트를 모두 실행합니다.`, 'yellow'));
    }
  }

  let result;
  let changedFiles = [];
  try {
    result = await orchestrateWorkspacePatch(prompt, snapshot, agentConfigs, {
      onEvent: (event) => {
        tui?.handleEvent(event);
      }
    });
    try {
      changedFiles = dryRun ? [] : applyWorkspaceChanges(process.cwd(), result.finalPatch.changes);
    } catch (error) {
      error.finalPatch = result.finalPatch;
      error.selection = result.selection;
      throw error;
    }
    tui?.finish(result, changedFiles);
  } finally {
    tui?.dispose();
  }
  printRunSummary(result, dryRun, changedFiles, agentConfigs);
}

async function runDashboard() {
  const dashboard = new DashboardTui({ cwd: process.cwd() });
  await dashboard.start();
}

export async function runCli(argv = process.argv) {
  const { help, dryRun, plain, prompt, provider, apiKey, command, agent, model } = parseArgs(argv);
  if (help) {
    printHelp();
    return 0;
  }

  if (command === 'mode') {
    printModeGuide();
    return 0;
  }
  if (command === 'login') {
    await runLogin(provider, apiKey);
    return 0;
  }
  if (command === 'providers') {
    printProviders();
    return 0;
  }
  if (command === 'agents') {
    printAgents();
    return 0;
  }
  if (command === 'use') {
    runUse(provider);
    return 0;
  }
  if (command === 'assign') {
    runAssign(agent, provider);
    return 0;
  }
  if (command === 'unassign') {
    runUnassign(agent);
    return 0;
  }
  if (command === 'model') {
    runModel(agent, model);
    return 0;
  }
  if (command === 'unmodel') {
    runUnmodel(agent);
    return 0;
  }
  if (command === 'logout') {
    runLogout(provider);
    return 0;
  }
  if (command === 'cleanup') {
    runCleanup();
    return 0;
  }
  if (command === 'tui' || command === 'dashboard') {
    await runDashboard();
    return 0;
  }

  if (!command && !prompt && process.stdout.isTTY) {
    await runDashboard();
    return 0;
  }

  if (!command || command === 'run') {
    const effectivePrompt = prompt || '로그인 기능을 현재 프로젝트 구조에 맞게 추가해줘';
    await runOrchestration(effectivePrompt, dryRun, plain);
    return 0;
  }

  return 0;
}

const isDirectRun = process.argv[1] && fs.realpathSync.native(fileURLToPath(import.meta.url)) === fs.realpathSync.native(path.resolve(process.argv[1]));
if (isDirectRun) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    let logPath = null;
    try {
      const finalPatch = error?.finalPatch ?? null;
      const pathDiagnostics = Array.isArray(finalPatch?.changes)
        ? finalPatch.changes.map((change) => ({
            action: change.action,
            ...describeWorkspacePath(process.cwd(), change.path)
          }))
        : [];
      logPath = writeFailureLog(process.cwd(), {
        timestamp: new Date().toISOString(),
        cwd: process.cwd(),
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
        finalPatch,
        pathDiagnostics
      });
    } catch {}
    console.error(paint('CLI 실행 중 오류가 발생했습니다.', 'red'));
    console.error(error.message || error);
    if (error?.finalPatch?.changes) {
      console.error(paint('실패 시점 변경안:', 'yellow'));
      for (const change of error.finalPatch.changes) {
        console.error(`- ${change.action}: ${change.path}`);
      }
    }
    if (logPath) {
      console.error(paint(`오류 로그: ${logPath}`, 'yellow'));
    }
    process.exitCode = 1;
  });
}
