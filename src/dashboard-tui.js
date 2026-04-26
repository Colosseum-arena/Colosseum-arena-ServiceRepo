import blessed from 'blessed';
import { spawnSync } from 'node:child_process';
import {
  IMPLEMENTATION_AGENTS,
  PROVIDERS,
  assignAgentProvider,
  clearAgentModel,
  clearAgentProvider,
  getStoredCredential,
  listAgentStates,
  listProviderStates,
  removeProviderCredential,
  resolveAgentConfig,
  setAgentModel,
  setDefaultProvider,
  setProviderCredential
} from './auth.js';
import { orchestrateWorkspacePatch } from './engine.js';
import { RunTui } from './tui.js';
import { applyWorkspaceChanges, buildWorkspaceSnapshot } from './workspace.js';
import { getDefaultModel } from './providers.js';

function providerName(providerId) {
  return PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId;
}

function nowLabel() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function modelLabel(state) {
  return state.model ?? `(default: ${getDefaultModel(state.effectiveProvider || state.provider) ?? 'none'})`;
}

function listMultiverseTmuxSessions() {
  const result = spawnSync('tmux', ['list-sessions', '-F', '#{session_name}'], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => name.startsWith('multiverse-sec'));
}

export class DashboardTui {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.screen = null;
    this.menu = null;
    this.statusBox = null;
    this.logBox = null;
    this.header = null;
    this.footer = null;
    this.logs = [];
    this.busy = false;
    this.lastRun = null;
    this.menuItems = [
      { label: '1) API Key 연결', action: () => this.actionConnectProvider() },
      { label: '2) 기본 Provider 설정', action: () => this.actionSetDefaultProvider() },
      { label: '3) Agent Provider 할당', action: () => this.actionAssignAgentProvider() },
      { label: '4) Agent Provider 초기화', action: () => this.actionUnassignAgentProvider() },
      { label: '5) Agent 모델 설정', action: () => this.actionSetAgentModel() },
      { label: '6) Agent 모델 초기화', action: () => this.actionClearAgentModel() },
      { label: '7) Provider 로그아웃', action: () => this.actionLogoutProvider() },
      { label: '8) 오케스트레이션 실행', action: () => this.actionRunOrchestration() },
      { label: '9) Tmux 세션 정리', action: () => this.actionCleanupSessions() },
      { label: 'R) 상태 새로고침', action: () => this.refreshStatus(true) },
      { label: 'Q) 종료', action: () => this.stop(0) }
    ];
    this.done = null;
    this.donePromise = new Promise((resolve) => {
      this.done = resolve;
    });
  }

  async start() {
    if (!process.stdout.isTTY) {
      throw new Error('Dashboard TUI는 TTY 환경에서만 실행할 수 있습니다.');
    }

    this.initScreen();
    return this.donePromise;
  }

  initScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
      title: 'Multiverse Secure Dashboard'
    });

    this.screen.key(['C-c'], () => this.stop(130));
    this.screen.key(['q'], () => this.stop(0));

    this.buildLayout();
    this.bindMenu();
    this.refreshStatus(false);
    if (this.logs.length === 0) {
      this.log('대시보드 시작: 좌측 메뉴에서 기능을 선택하세요.');
    } else {
      this.logBox.setContent(this.logs.join('\n'));
      this.logBox.setScrollPerc(100);
    }
    this.screen.render();
  }

  stop(exitCode = 0) {
    this.disposeScreen();
    this.done(exitCode);
  }

  disposeScreen() {
    if (!this.screen) return;
    const screen = this.screen;
    this.screen = null;
    screen.destroy();
  }

  buildLayout() {
    this.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      style: { fg: 'white', bg: 'blue' },
      content: '{bold}Multiverse Secure Dashboard{/bold}\nCLI 기능을 한 화면에서 설정하고 연속 실행합니다.'
    });

    this.menu = blessed.list({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '35%',
      height: '55%-1',
      label: ' Menu ',
      border: 'line',
      keys: true,
      vi: true,
      mouse: true,
      style: {
        selected: { bg: 'green', fg: 'black' },
        item: { fg: 'white' },
        border: { fg: 'white' }
      },
      items: this.menuItems.map((item) => item.label),
      scrollbar: {
        ch: ' ',
        inverse: true
      }
    });

    this.statusBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: '35%',
      width: '65%',
      height: '55%-1',
      label: ' Current Configuration ',
      border: 'line',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      padding: { left: 1, right: 1 }
    });

    this.logBox = blessed.box({
      parent: this.screen,
      top: '55%+2',
      left: 0,
      width: '100%',
      height: '45%-2',
      label: ' Activity Log ',
      border: 'line',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      padding: { left: 1, right: 1 }
    });

    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: { fg: 'white', bg: 'black' },
      content: 'Enter 실행 | ↑↓ 이동 | q 종료 | r 새로고침'
    });

    this.menu.focus();
  }

  bindMenu() {
    this.menu.key(['enter'], () => {
      const index = this.menu.selected;
      const item = this.menuItems[index];
      if (!item) return;
      this.runAction(item.action);
    });

    this.screen.key(['r'], () => {
      this.runAction(() => this.refreshStatus(true));
    });
  }

  runAction(action) {
    if (this.busy) {
      this.log('이전 작업이 끝난 뒤 다시 시도하세요.');
      return;
    }

    this.busy = true;
    this.setBusyIndicator(true);

    Promise.resolve()
      .then(() => action())
      .catch((error) => {
        this.log(`오류: ${error.message || String(error)}`);
      })
      .finally(() => {
        this.busy = false;
        this.setBusyIndicator(false);
        this.refreshStatus(false);
      });
  }

  setBusyIndicator(isBusy) {
    const stateLabel = isBusy ? '{yellow-fg}BUSY{/yellow-fg}' : '{green-fg}READY{/green-fg}';
    if (!this.screen) return;
    this.header.setContent('{bold}Multiverse Secure Dashboard{/bold}\nCLI 기능을 한 화면에서 설정하고 연속 실행합니다.   상태: ' + stateLabel);
    this.screen.render();
  }

  refreshStatus(withLog) {
    const providerStates = listProviderStates();
    const agentStates = listAgentStates();
    const lines = [];

    lines.push('{bold}Providers{/bold}');
    for (const state of providerStates) {
      const status = state.configured ? '{green-fg}connected{/green-fg}' : '{yellow-fg}not connected{/yellow-fg}';
      const defaultMark = state.isDefault ? ' (default)' : '';
      const assigned = state.assignedAgents.length ? ` · agents: ${state.assignedAgents.join(', ')}` : '';
      lines.push(`- ${state.label}: ${status}${defaultMark}${assigned}`);
    }

    lines.push('');
    lines.push('{bold}Agents{/bold}');
    for (const state of agentStates) {
      const effectiveProvider = state.effectiveProvider ? providerName(state.effectiveProvider) : 'none';
      const preferredProvider = state.provider ? providerName(state.provider) : 'none';
      lines.push(`- ${state.id} (${state.label})`);
      lines.push(`  preferred provider: ${preferredProvider}`);
      lines.push(`  effective provider: ${effectiveProvider}`);
      lines.push(`  model: ${modelLabel(state)}`);
      if (state.forcedProvider) {
        lines.push(`  fallback: single provider fanout (${providerName(state.forcedProvider)})`);
      }
    }

    if (this.lastRun) {
      lines.push('');
      lines.push('{bold}Last Run{/bold}');
      lines.push(`- prompt: ${this.lastRun.prompt}`);
      lines.push(`- mode: ${this.lastRun.dryRun ? 'dry-run' : 'apply changes'}`);
      lines.push(`- winner: ${this.lastRun.winner}`);
      lines.push(`- changed files: ${this.lastRun.changedFiles}`);
    }

    this.statusBox.setContent(lines.join('\n'));
    if (withLog) {
      this.log('상태를 새로고침했습니다.');
    }
    if (!this.screen) return;
    this.screen.render();
  }

  log(message) {
    this.logs.push(`[${nowLabel()}] ${message}`);
    if (this.logs.length > 300) {
      this.logs = this.logs.slice(-300);
    }
    if (!this.screen) return;
    this.logBox.setContent(this.logs.join('\n'));
    this.logBox.setScrollPerc(100);
    this.screen.render();
  }

  async promptInput(title, { secret = false, initialValue = '' } = {}) {
    return new Promise((resolve) => {
      const modal = blessed.box({
        parent: this.screen,
        width: '70%',
        height: 9,
        top: 'center',
        left: 'center',
        border: 'line',
        label: ` ${title} `,
        tags: true,
        style: {
          border: { fg: 'cyan' },
          bg: 'black'
        }
      });

      blessed.box({
        parent: modal,
        top: 1,
        left: 1,
        width: '100%-2',
        height: 1,
        content: 'Enter 저장 / Esc 취소'
      });

      const textbox = blessed.textbox({
        parent: modal,
        inputOnFocus: true,
        multiline: false,
        keys: true,
        mouse: true,
        censor: secret,
        border: 'line',
        top: 3,
        left: 1,
        width: '100%-2',
        height: 3,
        value: initialValue,
        style: {
          border: { fg: 'white' }
        }
      });

      let settled = false;
      const close = (value) => {
        if (settled) return;
        settled = true;
        modal.destroy();
        this.menu.focus();
        this.screen.render();
        resolve(value);
      };

      textbox.on('submit', (value) => {
        close((value ?? '').trim());
      });
      textbox.on('cancel', () => {
        close(null);
      });
      textbox.key(['enter'], () => textbox.submit());
      textbox.key(['escape'], () => textbox.cancel());
      textbox.focus();
      this.screen.render();
      textbox.readInput((error) => {
        if (error) {
          close(null);
        }
      });
    });
  }

  async pickOne(title, options) {
    if (!options.length) return null;

    return new Promise((resolve) => {
      const modal = blessed.box({
        parent: this.screen,
        width: '60%',
        height: '60%',
        top: 'center',
        left: 'center',
        border: 'line',
        label: ` ${title} `,
        style: {
          border: { fg: 'cyan' },
          bg: 'black'
        }
      });

      const list = blessed.list({
        parent: modal,
        top: 1,
        left: 1,
        width: '100%-2',
        height: '100%-2',
        keys: true,
        vi: true,
        mouse: true,
        style: {
          selected: { bg: 'green', fg: 'black' }
        },
        items: options.map((option) => option.label)
      });

      const close = (value) => {
        modal.destroy();
        this.menu.focus();
        this.screen.render();
        resolve(value);
      };

      list.key(['escape', 'q'], () => close(null));
      list.key(['enter'], () => {
        const selected = options[list.selected];
        close(selected ? selected.value : null);
      });

      list.focus();
      this.screen.render();
    });
  }

  async askYesNo(title) {
    const value = await this.pickOne(title, [
      { label: 'Yes', value: true },
      { label: 'No', value: false }
    ]);
    return value === true;
  }

  configuredProviders() {
    return listProviderStates().filter((state) => state.configured);
  }

  async actionConnectProvider() {
    const provider = await this.pickOne('연결할 Provider 선택', PROVIDERS.map((item) => ({ label: item.label, value: item.id })));
    if (!provider) {
      this.log('API Key 연결을 취소했습니다.');
      return;
    }

    const key = await this.promptInput(`${providerName(provider)} API Key 입력`, { secret: true });
    if (!key) {
      this.log('API Key 입력이 비어 있어 취소했습니다.');
      return;
    }

    const makeDefault = await this.askYesNo('기본 Provider로 설정할까요?');
    const result = setProviderCredential(provider, key, makeDefault);
    this.log(`${providerName(provider)} 연결 완료 (저장 위치: ${result.storageLabel})`);
    if (makeDefault) {
      this.log(`${providerName(provider)}를 기본 Provider로 설정했습니다.`);
    }
  }

  async actionSetDefaultProvider() {
    const options = this.configuredProviders().map((item) => ({ label: item.label, value: item.id }));
    const provider = await this.pickOne('기본 Provider 선택', options);
    if (!provider) {
      this.log('기본 Provider 설정을 취소했습니다.');
      return;
    }
    setDefaultProvider(provider);
    this.log(`${providerName(provider)}를 기본 Provider로 설정했습니다.`);
  }

  async actionAssignAgentProvider() {
    const agent = await this.pickOne('할당할 Agent 선택', IMPLEMENTATION_AGENTS.map((item) => ({ label: item, value: item })));
    if (!agent) {
      this.log('Agent Provider 할당을 취소했습니다.');
      return;
    }

    const options = this.configuredProviders().map((item) => ({ label: item.label, value: item.id }));
    const provider = await this.pickOne(`${agent}에 할당할 Provider 선택`, options);
    if (!provider) {
      this.log('Agent Provider 할당을 취소했습니다.');
      return;
    }

    assignAgentProvider(agent, provider);
    this.log(`${agent}에 ${providerName(provider)}를 할당했습니다.`);
  }

  async actionUnassignAgentProvider() {
    const agent = await this.pickOne('초기화할 Agent 선택', IMPLEMENTATION_AGENTS.map((item) => ({ label: item, value: item })));
    if (!agent) {
      this.log('Agent Provider 초기화를 취소했습니다.');
      return;
    }
    clearAgentProvider(agent);
    this.log(`${agent} provider를 기본값으로 되돌렸습니다.`);
  }

  async actionSetAgentModel() {
    const agent = await this.pickOne('모델을 설정할 Agent 선택', IMPLEMENTATION_AGENTS.map((item) => ({ label: item, value: item })));
    if (!agent) {
      this.log('Agent 모델 설정을 취소했습니다.');
      return;
    }

    const current = listAgentStates().find((state) => state.id === agent);
    const model = await this.promptInput(`${agent} 모델 입력`, { initialValue: current?.model ?? '' });
    if (!model) {
      this.log('Agent 모델 설정을 취소했습니다.');
      return;
    }

    setAgentModel(agent, model);
    this.log(`${agent} 모델을 ${model}로 설정했습니다.`);
  }

  async actionClearAgentModel() {
    const agent = await this.pickOne('모델 초기화할 Agent 선택', IMPLEMENTATION_AGENTS.map((item) => ({ label: item, value: item })));
    if (!agent) {
      this.log('Agent 모델 초기화를 취소했습니다.');
      return;
    }

    clearAgentModel(agent);
    this.log(`${agent} 모델 오버라이드를 제거했습니다.`);
  }

  async actionLogoutProvider() {
    const options = this.configuredProviders().map((item) => ({ label: item.label, value: item.id }));
    const provider = await this.pickOne('로그아웃할 Provider 선택', options);
    if (!provider) {
      this.log('Provider 로그아웃을 취소했습니다.');
      return;
    }

    const confirmed = await this.askYesNo(`${providerName(provider)} 연결을 제거할까요?`);
    if (!confirmed) {
      this.log('Provider 로그아웃을 취소했습니다.');
      return;
    }

    removeProviderCredential(provider);
    this.log(`${providerName(provider)} 연결을 제거했습니다.`);
  }

  async actionRunOrchestration() {
    const prompt = await this.promptInput('요청 프롬프트 입력');
    if (!prompt) {
      this.log('오케스트레이션 실행을 취소했습니다.');
      return;
    }

    const dryRun = await this.askYesNo('Dry-run으로 실행할까요? (파일 미적용)');
    await this.runOrchestration(prompt, dryRun);
  }

  async runOrchestration(prompt, dryRun) {
    const providerStates = this.configuredProviders();
    if (providerStates.length === 0) {
      this.log('연결된 Provider가 없습니다. 먼저 API Key를 연결하세요.');
      return;
    }

    const agentConfigs = IMPLEMENTATION_AGENTS.map((agent) => {
      const config = resolveAgentConfig(agent);
      if (!config.provider || !getStoredCredential(config.provider)) {
        throw new Error(`${agent} 에이전트에 사용할 provider credential이 없습니다.`);
      }
      return config;
    });

    const snapshot = buildWorkspaceSnapshot(this.cwd);
    if (snapshot.fileCount === 0) {
      throw new Error('현재 작업 폴더에서 읽을 수 있는 텍스트 파일을 찾지 못했습니다.');
    }

    this.log(`레거시 오케스트레이션 TUI로 전환합니다: ${prompt}`);
    this.log(`모드: ${dryRun ? 'dry-run' : 'apply changes'} | 파일 컨텍스트: ${snapshot.fileCount}`);
    this.log(`에이전트: ${agentConfigs.map((cfg) => `${cfg.agent}=${providerName(cfg.provider)}:${cfg.model || getDefaultModel(cfg.provider)}`).join(', ')}`);

    this.disposeScreen();
    const runTui = new RunTui({ prompt, agentConfigs, dryRun });
    let result;
    let changedFiles = [];
    try {
      runTui.start();
      result = await orchestrateWorkspacePatch(prompt, snapshot, agentConfigs, {
        onEvent: (event) => {
          runTui.handleEvent(event);
        }
      });
      changedFiles = dryRun ? [] : applyWorkspaceChanges(this.cwd, result.finalPatch.changes);
      runTui.finish(result, changedFiles);
    } finally {
      runTui.dispose();
      this.initScreen();
    }

    this.log(`레거시 TUI 실행 완료: 승자 ${result.selection.winner} (${result.finalPatch.winningStrategy})`);
    this.log(`${dryRun ? 'Planned changes' : 'Applied changes'}: ${result.finalPatch.changes.length}개`);

    this.lastRun = {
      prompt,
      dryRun,
      winner: result.selection.winner,
      changedFiles: dryRun ? 0 : changedFiles.length
    };
  }

  async actionCleanupSessions() {
    const sessions = listMultiverseTmuxSessions();
    if (sessions.length === 0) {
      this.log('정리할 multiverse-sec tmux 세션이 없습니다.');
      return;
    }

    for (const session of sessions) {
      const result = spawnSync('tmux', ['kill-session', '-t', session], { encoding: 'utf8' });
      if (result.status !== 0) {
        throw new Error(result.stderr || `${session} 세션 종료에 실패했습니다.`);
      }
    }

    this.log(`tmux 세션 ${sessions.length}개를 정리했습니다.`);
  }
}
