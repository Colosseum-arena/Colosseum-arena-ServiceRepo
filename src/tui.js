import blessed from 'blessed';
import { getProviderMeta } from './auth.js';
import { getDefaultModel } from './providers.js';

function providerLabel(provider) {
  return getProviderMeta(provider)?.label ?? provider ?? 'unset';
}

function modelLabel(config) {
  return config.model || getDefaultModel(config.provider) || 'unknown-model';
}

function stageLabel(state) {
  if (state.finalPatch) return 'Complete';
  if (state.selection) return 'Refining Winner';
  if (state.critiques.length > 0) return 'Debate Running';
  if (state.proposals.length > 0) return 'Planning Round';
  return 'Preparing';
}

function joinLines(lines) {
  return lines.filter((line) => line !== null && line !== undefined).join('\n');
}

function agentPanelLines(config, proposal, critique) {
  const lines = [
    `{bold}${config.label}{/bold}`,
    `agent: ${config.agent}`,
    `provider: ${providerLabel(config.provider)}`,
    `model: ${modelLabel(config)}`,
    `status: ${proposal ? 'plan ready' : 'thinking'}`
  ];

  if (config.forcedProvider) {
    lines.push('fallback: single-provider fanout');
  }

  if (!proposal) {
    lines.push('', 'waiting for proposal...');
    return lines;
  }

  lines.push('');
  lines.push('{bold}Strategy{/bold}');
  lines.push(proposal.strategy);
  lines.push('');
  lines.push('{bold}Summary{/bold}');
  lines.push(proposal.summary);

  if (proposal.plan?.length) {
    lines.push('');
    lines.push('{bold}Plan{/bold}');
    for (const step of proposal.plan) {
      lines.push(`- ${step}`);
    }
  }

  if (proposal.reasons?.length) {
    lines.push('');
    lines.push('{bold}Opinion{/bold}');
    for (const reason of proposal.reasons) {
      lines.push(`- ${reason}`);
    }
  }

  if (critique) {
    lines.push('');
    lines.push('{bold}Vote{/bold}');
    lines.push(`${config.agent} -> ${critique.preferredAgent}`);
  }

  return lines;
}

function debatePanelLines(state, prompt, dryRun) {
  const lines = [
    `{bold}Prompt{/bold}`,
    prompt,
    '',
    `{bold}Stage{/bold}`,
    stageLabel(state),
    `mode: ${dryRun ? 'dry-run' : 'apply changes'}`,
    ''
  ];

  lines.push('{bold}Debate{/bold}');
  if (state.critiques.length === 0) {
    lines.push('waiting for proposals...');
  } else {
    for (const critique of state.critiques) {
      lines.push(`${critique.agent} -> ${critique.preferredAgent}`);
      for (const point of critique.debatePoints ?? []) {
        lines.push(`- debate: ${point}`);
      }
      for (const issue of critique.issues ?? []) {
        lines.push(`- issue: ${issue}`);
      }
      for (const idea of critique.mergeIdeas ?? []) {
        lines.push(`- merge: ${idea}`);
      }
      lines.push('');
    }
  }

  if (state.selection) {
    lines.push('{bold}Winner{/bold}');
    lines.push(`- selected: ${state.selection.winner}`);
    lines.push(`- strategy: ${state.selection.proposal?.strategy ?? 'unknown'}`);
    lines.push(`- votes: ${JSON.stringify(state.selection.votes)}`);
    lines.push('');
  }

  if (state.finalPatch) {
    lines.push('{bold}Resolution{/bold}');
    lines.push(state.finalPatch.summary);
    for (const point of state.finalPatch.debateResolution ?? []) {
      lines.push(`- ${point}`);
    }
    lines.push('');
    lines.push(`{bold}${dryRun ? 'Planned Changes' : 'Applied Changes'}{/bold}`);
    for (const change of state.finalPatch.changes ?? []) {
      lines.push(`- ${change.action}: ${change.path}`);
    }
  }

  return lines;
}

export class RunTui {
  constructor({ prompt, agentConfigs, dryRun }) {
    this.prompt = prompt;
    this.agentConfigs = agentConfigs;
    this.dryRun = dryRun;
    this.state = {
      proposals: [],
      critiques: [],
      selection: null,
      finalPatch: null
    };
    this.active = false;
    this.screen = null;
    this.boxes = [];
    this.focusedPane = 0;
    this.closedEarly = false;
  }

  start() {
    if (!process.stdout.isTTY) return;

    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      dockBorders: true,
      autoPadding: false,
      title: 'Multiverse Secure TUI'
    });

    this.screen.key(['C-c'], () => {
      this.dispose();
      process.exit(130);
    });

    this.screen.key(['tab'], () => {
      this.focusPane((this.focusedPane + 1) % 4);
    });

    this.screen.key(['1', '2', '3', '4'], (_, key) => {
      this.focusPane(Number(key.full) - 1);
    });

    this.screen.key(['q'], () => {
      this.closedEarly = true;
      this.dispose();
    });

    this.screen.key(['j', 'down'], () => {
      this.currentBox()?.scroll(1);
      this.screen.render();
    });

    this.screen.key(['k', 'up'], () => {
      this.currentBox()?.scroll(-1);
      this.screen.render();
    });

    this.screen.key(['g'], () => {
      this.currentBox()?.setScroll(0);
      this.screen.render();
    });

    this.screen.key(['G'], () => {
      const box = this.currentBox();
      if (box) {
        box.setScrollPerc(100);
        this.screen.render();
      }
    });

    this.buildLayout();
    this.active = true;
    this.focusPane(0);
    this.render();
  }

  buildLayout() {
    const header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      tags: true,
      style: {
        fg: 'white'
      }
    });

    const topHeight = '48%-1';
    const topWidth = '33%-1';
    const topY = 3;

    const alphaBox = blessed.box({
      parent: this.screen,
      top: topY,
      left: 0,
      width: topWidth,
      height: topHeight,
      border: 'line',
      label: ' Agent Alpha ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      keys: false,
      vi: false,
      padding: {
        left: 1,
        right: 1
      }
    });

    const betaBox = blessed.box({
      parent: this.screen,
      top: topY,
      left: '33%',
      width: topWidth,
      height: topHeight,
      border: 'line',
      label: ' Agent Beta ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      padding: {
        left: 1,
        right: 1
      }
    });

    const gammaBox = blessed.box({
      parent: this.screen,
      top: topY,
      left: '66%',
      width: topWidth,
      height: topHeight,
      border: 'line',
      label: ' Agent Gamma ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      padding: {
        left: 1,
        right: 1
      }
    });

    const debateBox = blessed.box({
      parent: this.screen,
      top: '48%+3',
      left: 0,
      width: '100%',
      height: '52%-3',
      border: 'line',
      label: ' Debate Arena / Final Result ',
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        inverse: true
      },
      padding: {
        left: 1,
        right: 1
      }
    });

    const footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      tags: true,
      style: {
        fg: 'white'
      }
    });

    this.boxes = [alphaBox, betaBox, gammaBox, debateBox];
    this.header = header;
    this.footer = footer;
  }

  currentBox() {
    return this.boxes[this.focusedPane] ?? null;
  }

  focusPane(index) {
    this.focusedPane = index;
    this.boxes.forEach((box, boxIndex) => {
      box.style.border = {
        fg: boxIndex === index ? 'green' : 'white'
      };
      box.style.label = {
        fg: boxIndex === index ? 'green' : 'white',
        bold: true
      };
    });
    this.screen.render();
  }

  handleEvent(event) {
    if (event.type === 'proposal') {
      this.state.proposals = event.proposals;
    } else if (event.type === 'critique') {
      this.state.critiques = event.critiques;
    } else if (event.type === 'selection') {
      this.state.selection = event.selection;
    } else if (event.type === 'final') {
      this.state.finalPatch = event.finalPatch;
    }
    this.render();
  }

  render() {
    if (!this.active || !this.screen || this.closedEarly) return;

    this.header.setContent(joinLines([
      '{bold}Multiverse Secure TUI{/bold}',
      `{cyan-fg}Stage{/}: ${stageLabel(this.state)}    {green-fg}Focus{/}: ${this.focusedPane === 3 ? 'debate' : this.agentConfigs[this.focusedPane]?.agent ?? 'unknown'}`
    ]));

    const proposalsByAgent = new Map(this.state.proposals.map((proposal) => [proposal.agent, proposal]));
    const critiquesByAgent = new Map(this.state.critiques.map((critique) => [critique.agent, critique]));

    this.agentConfigs.forEach((config, index) => {
      const proposal = proposalsByAgent.get(config.agent);
      const critique = critiquesByAgent.get(config.agent);
      this.boxes[index].setContent(joinLines(agentPanelLines(config, proposal, critique)));
    });

    this.boxes[3].setContent(joinLines(debatePanelLines(this.state, this.prompt, this.dryRun)));
    this.footer.setContent('{bold}Controls{/bold}: Tab/1/2/3/4 focus  j/k or Up/Down scroll  g/G top/bottom  q hide TUI');

    this.screen.render();
  }

  finish(result) {
    if (!this.active || !this.screen || this.closedEarly) return;
    this.state.selection = result.selection;
    this.state.finalPatch = result.finalPatch;
    this.render();
  }

  dispose() {
    if (!this.screen) return;
    const screen = this.screen;
    this.screen = null;
    this.active = false;
    screen.destroy();
  }
}
