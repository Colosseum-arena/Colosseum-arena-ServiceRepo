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
  magenta: '\u001b[35m',
  gray: '\u001b[90m'
};

function paint(text, tone) {
  return `${color[tone] ?? ''}${text}${color.reset}`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    help: args.includes('--help') || args.includes('-h'),
    noDelay: args.includes('--no-delay'),
    prompt: args.filter((arg) => !arg.startsWith('--')).join(' ').trim()
  };
}

function visibleWidth(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '').length;
}

function pad(text, width) {
  const gap = Math.max(0, width - visibleWidth(text));
  return text + ' '.repeat(gap);
}

function wrapText(text, width) {
  const rawLines = String(text).split('\n');
  const result = [];
  for (const rawLine of rawLines) {
    const words = rawLine.split(' ');
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (visibleWidth(next) <= width) {
        current = next;
      } else {
        if (current) result.push(current);
        if (visibleWidth(word) <= width) {
          current = word;
        } else {
          let chunk = '';
          for (const char of word) {
            if (visibleWidth(chunk + char) > width) {
              result.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          current = chunk;
        }
      }
    }
    result.push(current || '');
  }
  return result;
}

function makeBox({ title, subtitle, tone = 'cyan', lines, width }) {
  const innerWidth = width - 2;
  const rendered = [];
  rendered.push(`┌${'─'.repeat(innerWidth)}┐`);
  rendered.push(`│${pad(paint(title, tone), innerWidth)}│`);
  rendered.push(`│${pad(paint(subtitle, 'dim'), innerWidth)}│`);
  rendered.push(`├${'─'.repeat(innerWidth)}┤`);
  for (const line of lines) {
    for (const wrapped of wrapText(line, innerWidth)) {
      rendered.push(`│${pad(wrapped, innerWidth)}│`);
    }
  }
  rendered.push(`└${'─'.repeat(innerWidth)}┘`);
  return rendered;
}

function mergeColumns(leftLines, rightLines, gap = 2) {
  const leftWidth = Math.max(...leftLines.map((line) => visibleWidth(line)), 0);
  const rows = Math.max(leftLines.length, rightLines.length);
  const merged = [];
  for (let index = 0; index < rows; index += 1) {
    const left = leftLines[index] ?? '';
    const right = rightLines[index] ?? '';
    merged.push(`${pad(left, leftWidth)}${' '.repeat(gap)}${right}`.trimEnd());
  }
  return merged;
}

function stackBoxes(boxes) {
  return boxes.flatMap((box, index) => index === 0 ? box : ['', ...box]);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function maybePause(noDelay, ms = 220) {
  if (!noDelay) {
    await sleep(ms);
  }
}

function buildAgentLines(scenario) {
  const architect = scenario.proposals.find((item) => item.agent === 'Architect');
  const red = scenario.proposals.find((item) => item.agent === 'Red Team');
  const blue = scenario.proposals.find((item) => item.agent === 'Blue Team');

  return {
    architect: [
      `현재 작업: ${architect.idea}`,
      `설계 방향: ${architect.detail}`,
      '산출물: API 구조/레이어 분리 제안'
    ],
    red: [
      `현재 작업: ${red.idea}`,
      `공격 포인트: ${red.detail}`,
      `주요 반박: ${scenario.debate[0].message}`
    ],
    blue: [
      `현재 작업: ${blue.idea}`,
      `방어 전략: ${blue.detail}`,
      `대응 방안: ${scenario.debate[1].message}`
    ]
  };
}

function renderSplitDashboard(scenario) {
  const totalWidth = Math.max(112, Number(process.stdout.columns) || 112);
  const columnGap = 2;
  const leftWidth = 56;
  const rightWidth = totalWidth - leftWidth - columnGap;
  const agentLines = buildAgentLines(scenario);

  const leftColumn = stackBoxes([
    makeBox({
      title: '좌상단 | Architect 패널',
      subtitle: '역할: 구조 설계 / API 초안 제안',
      tone: 'cyan',
      lines: agentLines.architect,
      width: leftWidth
    }),
    makeBox({
      title: '좌중단 | Red Team 패널',
      subtitle: '역할: 공격 시나리오 / 취약점 지적',
      tone: 'red',
      lines: agentLines.red,
      width: leftWidth
    }),
    makeBox({
      title: '좌하단 | Blue Team 패널',
      subtitle: '역할: 방어 전략 / 패치 제안',
      tone: 'blue',
      lines: agentLines.blue,
      width: leftWidth
    })
  ]);

  const rightColumn = stackBoxes([
    makeBox({
      title: '우측 상단 | Consensus Board',
      subtitle: '역할: AI 의견 충돌 / 조율 / 최종 판정',
      tone: 'yellow',
      lines: scenario.debate.map((turn, index) => `${index + 1}. ${turn.from} → ${turn.to}: ${turn.message}`),
      width: rightWidth
    }),
    makeBox({
      title: '우측 하단 | Final Decision',
      subtitle: '역할: 확정된 방향과 최종 코드 요약',
      tone: 'green',
      lines: [
        `확정안: ${scenario.decision.winner}`,
        `합의 흐름: ${scenario.decision.summary}`,
        '선정 이유:',
        ...scenario.decision.reason.map((reason) => `- ${reason}`),
        '최종 코드 미리보기:',
        '  --- final-code.js ---',
        ...scenario.finalCode.split('\n').map((line) => `  ${line}`)
      ],
      width: rightWidth
    })
  ]);

  return mergeColumns(leftColumn, rightColumn, columnGap);
}

function renderLegend() {
  return [
    paint('레이아웃 안내', 'bold'),
    `${paint('좌측', 'cyan')} 각 AI가 자기 역할별로 작업하는 패널`,
    `${paint('우측', 'yellow')} AI 의견 조율 / 판정 / 최종 결과를 모아보는 패널`
  ];
}

export async function runCli(argv = process.argv) {
  const { help, noDelay, prompt } = parseArgs(argv);

  if (help) {
    console.log('사용법: multiverse-sec "요청 내용" [--no-delay]');
    console.log('예시: multiverse-sec "보안이 강화된 login API 만들어줘"');
    console.log('설명: 좌측은 AI 작업 패널, 우측은 합의/최종 결정 패널을 표시합니다.');
    return 0;
  }

  const scenario = buildDemoScenario(prompt || '보안이 강화된 login API 만들어줘');
  await maybePause(noDelay, 120);

  console.log(paint('Multiverse Secure Demo', 'magenta'));
  console.log(paint('분할형 멀티 에이전트 대시보드', 'bold'));
  console.log(paint(`Prompt: ${scenario.prompt}`, 'dim'));
  console.log();
  console.log(renderLegend().join('\n'));
  console.log();
  console.log(renderSplitDashboard(scenario).join('\n'));

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
