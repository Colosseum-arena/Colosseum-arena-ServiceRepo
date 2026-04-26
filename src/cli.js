#!/usr/bin/env node
import { buildDemoScenario } from './demo-data.js';

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

function header(title) {
  console.log(`\n${paint(title, 'bold')}`);
}

function logLine(label, text, tone = 'dim') {
  console.log(`${paint(label, tone)} ${text}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    help: args.includes('--help') || args.includes('-h'),
    noDelay: args.includes('--no-delay'),
    prompt: args.filter((arg) => !arg.startsWith('--')).join(' ').trim()
  };
}

async function maybePause(noDelay, ms = 220) {
  if (!noDelay) {
    await sleep(ms);
  }
}

export async function runCli(argv = process.argv) {
  const { help, noDelay, prompt } = parseArgs(argv);

  if (help) {
    console.log('사용법: multiverse-sec "요청 내용" [--no-delay]');
    console.log('예시: multiverse-sec "보안이 강화된 login API 만들어줘"');
    return 0;
  }

  const scenario = buildDemoScenario(prompt || '보안이 강화된 login API 만들어줘');

  console.log(paint('Multiverse Secure Demo', 'cyan'));
  console.log(paint('AI 아이디어 제안 → 반박 → 조율 → 최종 합의', 'dim'));
  logLine('Prompt', scenario.prompt, 'magenta');

  header('1. 에이전트별 아이디어 제안');
  for (const proposal of scenario.proposals) {
    await maybePause(noDelay);
    logLine(`[${proposal.agent}]`, proposal.idea, 'cyan');
    logLine('  └', proposal.detail, 'dim');
  }

  header('2. 에이전트 간 충돌과 조율');
  for (const turn of scenario.debate) {
    await maybePause(noDelay);
    const tone = turn.from === 'Red Team' ? 'red' : turn.from === 'Blue Team' ? 'blue' : 'yellow';
    logLine(`[${turn.from} → ${turn.to}]`, turn.message, tone);
  }

  header('3. 최종 합의 결과');
  await maybePause(noDelay);
  logLine('[Judge]', `${scenario.decision.winner}로 확정`, 'green');
  logLine('합의된 흐름', scenario.decision.summary, 'green');
  for (const reason of scenario.decision.reason) {
    await maybePause(noDelay, 180);
    logLine('  ✓', reason, 'green');
  }

  header('4. 최종 코드 결과');
  await maybePause(noDelay);
  logLine('[Final Code]', '최종 보안 코드가 확정되었습니다.', 'green');
  console.log();
  console.log(paint('--- final-code.js ---', 'bold'));
  console.log(scenario.finalCode);

  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isDirectRun) {
  runCli().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(paint('CLI 실행 중 오류가 발생했습니다.', 'red'));
    console.error(error);
    process.exitCode = 1;
  });
}
