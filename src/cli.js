#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildDemoScenario } from './demo-data.js';
import {
  ensureAuthenticatedOnboarding,
  getProviderMeta,
  getStoredCredential,
  listProviderStates,
  loadAuthConfig,
  removeProviderCredential,
  resolveDefaultProvider,
  runInteractiveLogin
} from './auth.js';

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

const ROLE_META = {
  architect: { tone: 'cyan', title: 'Architect', subtitle: '구조 설계 / API 초안 제안' },
  red: { tone: 'red', title: 'Red Team', subtitle: '공격 시나리오 / 취약점 지적' },
  blue: { tone: 'blue', title: 'Blue Team', subtitle: '방어 전략 / 패치 제안' },
  consensus: { tone: 'yellow', title: 'Consensus Board', subtitle: '의견 충돌 / 조율 / 최종 판정' },
  final: { tone: 'green', title: 'Final Decision', subtitle: '확정안 / 최종 코드 요약' }
};

function paint(text, tone) {
  return `${color[tone] ?? ''}${text}${color.reset}`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const promptParts = [];
  let role = null;
  let sessionName = 'multiverse-sec-demo';
  let promptBase64 = null;
  let provider = null;
  let command = null;
  let apiKey = null;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === 'login' || arg === 'providers' || arg === 'logout') {
      command = arg;
    } else if (arg === '--role') {
      role = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--session-name') {
      sessionName = args[index + 1] ?? sessionName;
      index += 1;
    } else if (arg === '--prompt-b64') {
      promptBase64 = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--provider') {
      provider = args[index + 1] ?? null;
      index += 1;
    } else if (arg === '--api-key') {
      apiKey = args[index + 1] ?? null;
      index += 1;
    } else if (!arg.startsWith('--')) {
      promptParts.push(arg);
    }
  }

  return {
    help: args.includes('--help') || args.includes('-h'),
    noDelay: args.includes('--no-delay'),
    tmux: args.includes('--tmux'),
    noAttach: args.includes('--no-attach'),
    role,
    sessionName,
    promptBase64,
    prompt: promptParts.join(' ').trim(),
    provider,
    command,
    apiKey
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function maybePause(noDelay, ms = 280) {
  if (!noDelay) {
    await sleep(ms);
  }
}

function decodePrompt(prompt, promptBase64) {
  if (promptBase64) {
    return Buffer.from(promptBase64, 'base64').toString('utf8');
  }
  return prompt || '보안이 강화된 login API 만들어줘';
}

function printPaneHeader(roleKey, prompt, providerLabel) {
  const role = ROLE_META[roleKey];
  const line = '─'.repeat(72);
  console.log(paint(line, role.tone));
  console.log(paint(`${role.title} 패널`, role.tone));
  console.log(paint(`역할: ${role.subtitle}`, 'dim'));
  console.log(paint(`Provider: ${providerLabel}`, 'dim'));
  console.log(paint(`Prompt: ${prompt}`, 'dim'));
  console.log(paint(line, role.tone));
}

async function renderRolePane(roleKey, scenario, noDelay, providerLabel) {
  printPaneHeader(roleKey, scenario.prompt, providerLabel);

  if (roleKey === 'architect') {
    const architect = scenario.proposals.find((item) => item.agent === 'Architect');
    console.log(`현재 작업: ${architect.idea}`);
    await maybePause(noDelay);
    console.log(`설계 방향: ${architect.detail}`);
    await maybePause(noDelay);
    console.log('산출물: API 구조/레이어 분리 제안');
    await maybePause(noDelay);
    console.log(paint('상태: 구조 제안 완료, Red Team 검토 대기', 'cyan'));
    return;
  }

  if (roleKey === 'red') {
    const red = scenario.proposals.find((item) => item.agent === 'Red Team');
    console.log(`현재 작업: ${red.idea}`);
    await maybePause(noDelay);
    console.log(`공격 포인트: ${red.detail}`);
    await maybePause(noDelay);
    console.log(`주요 반박: ${scenario.debate[0].message}`);
    await maybePause(noDelay);
    console.log(paint('상태: 취약점 분석 완료, Blue Team 대응 확인 중', 'red'));
    return;
  }

  if (roleKey === 'blue') {
    const blue = scenario.proposals.find((item) => item.agent === 'Blue Team');
    console.log(`현재 작업: ${blue.idea}`);
    await maybePause(noDelay);
    console.log(`방어 전략: ${blue.detail}`);
    await maybePause(noDelay);
    console.log(`대응 방안: ${scenario.debate[1].message}`);
    await maybePause(noDelay);
    console.log(paint('상태: 방어안 제시 완료, Judge 판정 대기', 'blue'));
    return;
  }

  if (roleKey === 'consensus') {
    for (const [index, turn] of scenario.debate.entries()) {
      console.log(`${index + 1}. ${turn.from} → ${turn.to}`);
      console.log(`   ${turn.message}`);
      await maybePause(noDelay, 420);
    }
    console.log();
    console.log(paint(`[Judge] ${scenario.decision.winner}로 확정`, 'yellow'));
    console.log(`합의 흐름: ${scenario.decision.summary}`);
    return;
  }

  if (roleKey === 'final') {
    console.log(`확정안: ${scenario.decision.winner}`);
    await maybePause(noDelay);
    console.log('선정 이유:');
    for (const reason of scenario.decision.reason) {
      console.log(`- ${reason}`);
      await maybePause(noDelay, 220);
    }
    console.log();
    console.log('--- final-code.js ---');
    console.log(scenario.finalCode);
  }
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function runTmux(args, options = {}) {
  const result = spawnSync('tmux', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    ...options
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `tmux command failed: ${args.join(' ')}`);
  }

  return result;
}

function runTmuxAndRead(args) {
  return runTmux(args).stdout.trim();
}

function buildPaneCommand(roleKey, prompt, noDelay, provider) {
  const scriptPath = fileURLToPath(import.meta.url);
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
  const parts = [
    shellEscape(process.execPath),
    shellEscape(scriptPath),
    '--role',
    shellEscape(roleKey),
    '--prompt-b64',
    shellEscape(promptBase64),
    '--provider',
    shellEscape(provider)
  ];

  if (noDelay) {
    parts.push('--no-delay');
  }

  parts.push(';', 'printf', shellEscape('\n\n[done] pane completed. Press Ctrl-b d to detach.\n'), ';', 'exec', process.env.SHELL || '/bin/zsh');
  return parts.join(' ');
}

function launchTmuxDashboard({ sessionName, prompt, noDelay, noAttach, provider }) {
  const existing = spawnSync('tmux', ['has-session', '-t', sessionName], { encoding: 'utf8' });
  if (existing.status === 0) {
    throw new Error(`tmux session '${sessionName}' 이(가) 이미 존재합니다. 다른 이름을 사용하거나 세션을 종료하세요.`);
  }

  const architectPane = runTmuxAndRead(['new-session', '-d', '-P', '-F', '#{pane_id}', '-s', sessionName, '-n', 'agents', buildPaneCommand('architect', prompt, noDelay, provider)]);
  const consensusPane = runTmuxAndRead(['split-window', '-P', '-F', '#{pane_id}', '-h', '-t', architectPane, buildPaneCommand('consensus', prompt, noDelay, provider)]);
  const redPane = runTmuxAndRead(['split-window', '-P', '-F', '#{pane_id}', '-v', '-t', architectPane, buildPaneCommand('red', prompt, noDelay, provider)]);
  const bluePane = runTmuxAndRead(['split-window', '-P', '-F', '#{pane_id}', '-v', '-t', architectPane, buildPaneCommand('blue', prompt, noDelay, provider)]);
  const finalPane = runTmuxAndRead(['split-window', '-P', '-F', '#{pane_id}', '-v', '-t', consensusPane, buildPaneCommand('final', prompt, noDelay, provider)]);
  runTmux(['select-layout', '-t', `${sessionName}:0`, 'tiled']);
  runTmux(['select-pane', '-t', architectPane, '-T', 'Architect']);
  runTmux(['select-pane', '-t', consensusPane, '-T', 'Consensus']);
  runTmux(['select-pane', '-t', redPane, '-T', 'Red Team']);
  runTmux(['select-pane', '-t', bluePane, '-T', 'Blue Team']);
  runTmux(['select-pane', '-t', finalPane, '-T', 'Final Decision']);
  runTmux(['set-option', '-t', sessionName, 'mouse', 'on']);

  console.log(paint(`tmux 세션 '${sessionName}' 생성 완료`, 'green'));
  console.log(`Provider: ${getProviderMeta(provider)?.label ?? provider}`);
  console.log(`붙기: tmux attach -t ${sessionName}`);
  console.log('패널 구성: 좌측 Architect/Red/Blue, 우측 Consensus/Final');

  if (!noAttach) {
    const attach = spawnSync('tmux', ['attach-session', '-t', sessionName], { stdio: 'inherit' });
    if (attach.status !== 0) {
      throw new Error('tmux attach-session 실행에 실패했습니다.');
    }
  }
}

function printHelp() {
  console.log('사용법:');
  console.log('  multiverse-sec login [--provider openai|claude|gemini]');
  console.log('  multiverse-sec providers');
  console.log('  multiverse-sec logout --provider openai|claude|gemini');
  console.log('  multiverse-sec --tmux "요청 내용" [--session-name 이름] [--no-delay]');
  console.log('');
  console.log('옵션:');
  console.log('  --tmux         실제 tmux pane 분할 데모를 실행합니다.');
  console.log('  --no-attach    tmux 세션 생성만 하고 바로 붙지 않습니다.');
  console.log('  --session-name 생성할 tmux 세션 이름을 지정합니다.');
  console.log('  --provider     provider를 명시합니다.');
  console.log('  --api-key      비대화형 login에 사용할 API 키를 전달합니다.');
  console.log('  --no-delay     패널 출력 지연을 제거합니다.');
}

function printProviders() {
  const states = listProviderStates();
  console.log(paint('연결된 AI 제공자 상태', 'bold'));
  for (const state of states) {
    const status = state.configured ? paint('연결됨', 'green') : paint('미연결', 'yellow');
    const defaultMark = state.isDefault ? paint(' (기본)', 'cyan') : '';
    console.log(`- ${state.label}: ${status}${defaultMark}`);
  }
}

async function runLogin(provider, apiKey) {
  const result = await runInteractiveLogin(provider ?? null, apiKey ?? null);
  console.log(paint(`${getProviderMeta(result.provider).label} 연결 완료`, 'green'));
  console.log(`저장 위치: ${result.storageLabel}`);
  if (result.makeDefault) {
    console.log('기본 provider로 설정했습니다.');
  }
}

function runLogout(provider) {
  if (!provider) {
    throw new Error('logout에는 --provider 가 필요합니다.');
  }
  if (!getStoredCredential(provider)) {
    throw new Error('해당 provider는 현재 연결되어 있지 않습니다.');
  }
  removeProviderCredential(provider);
  console.log(paint(`${getProviderMeta(provider)?.label ?? provider} 연결을 제거했습니다.`, 'green'));
}

export async function runCli(argv = process.argv) {
  const { help, noDelay, prompt, tmux, noAttach, sessionName, role, promptBase64, provider, command, apiKey } = parseArgs(argv);
  const decodedPrompt = decodePrompt(prompt, promptBase64);

  if (help) {
    printHelp();
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

  if (command === 'logout') {
    runLogout(provider);
    return 0;
  }

  const effectiveProvider = role ? (provider ?? resolveDefaultProvider() ?? 'unconfigured') : await ensureAuthenticatedOnboarding();
  const providerLabel = getProviderMeta(effectiveProvider)?.label ?? effectiveProvider;
  const scenario = buildDemoScenario(decodedPrompt);

  if (role) {
    await renderRolePane(role, scenario, noDelay, providerLabel);
    return 0;
  }

  if (tmux) {
    launchTmuxDashboard({ sessionName, prompt: decodedPrompt, noDelay, noAttach, provider: effectiveProvider });
    return 0;
  }

  console.log(paint('Multiverse Secure Demo', 'magenta'));
  console.log(paint('분할형 멀티 에이전트 대시보드', 'bold'));
  console.log(paint(`Provider: ${providerLabel}`, 'dim'));
  console.log(paint(`Prompt: ${scenario.prompt}`, 'dim'));
  console.log();
  console.log(paint('실제 pane 분할이 필요하면 --tmux 옵션으로 실행하세요.', 'yellow'));
  console.log(paint(`예시: node ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} --tmux "${scenario.prompt}"`, 'dim'));

  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirectRun) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(paint('CLI 실행 중 오류가 발생했습니다.', 'red'));
    console.error(error.message || error);
    process.exitCode = 1;
  });
}
