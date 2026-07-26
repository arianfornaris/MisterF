import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The browser client is intentionally plain JavaScript and is bundled
// separately from the TypeScript server.
// @ts-expect-error No TypeScript declaration is generated for client modules.
import { TutorPlanView } from '../../src/client/chat/ui/TutorPlanView.js';

type EventListener = () => void;

class FakeClassList {
  private readonly values = new Set<string>();

  add(...classNames: string[]): void {
    for (const className of classNames) {
      this.values.add(className);
    }
  }

  contains(className: string): boolean {
    return this.values.has(className);
  }

  remove(...classNames: string[]): void {
    for (const className of classNames) {
      this.values.delete(className);
    }
  }

  replaceFrom(className: string): void {
    this.values.clear();
    this.add(...className.split(/\s+/).filter(Boolean));
  }
}

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  readonly listeners = new Map<string, EventListener>();
  innerHTML = '';
  tagName: string;
  textContent = '';

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  set className(value: string) {
    this.classList.replaceFrom(value);
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  addEventListener(eventName: string, listener: EventListener): void {
    this.listeners.set(eventName, listener);
  }

  click(): void {
    this.listeners.get('click')?.();
  }

  replaceChildren(...children: FakeElement[]): void {
    this.children.splice(0, this.children.length, ...children);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

const initialPlan = {
  steps: [
    { id: 'introduce', label: 'Introduce the topic', status: 'active' },
    { id: 'practice', label: 'Practice the pattern', status: 'pending' },
  ],
  summary: 'A short practice plan',
  title: 'Present perfect practice',
};

function getFirstActionButton(panelEl: FakeElement): FakeElement {
  const body = panelEl.children[0];
  const actionGroup = body.children[1];
  return actionGroup.children[0];
}

describe('TutorPlanView', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: (tagName: string) => new FakeElement(tagName),
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders a newly visible plan minimized with its active step', () => {
    const panelEl = new FakeElement('section');
    const view = new TutorPlanView({ panelEl });

    view.render(initialPlan);

    expect(panelEl.classList.contains('d-none')).toBe(false);
    expect(panelEl.children).toHaveLength(1);
    expect(panelEl.children[0].classList.contains('tutor-plan-minimized')).toBe(true);
    expect(panelEl.children[0].children[0].children[1].textContent).toBe(
      'Introduce the topic',
    );
  });

  it('allows manual expansion and preserves it across plan updates', () => {
    const panelEl = new FakeElement('section');
    const view = new TutorPlanView({ panelEl });
    view.render(initialPlan);

    getFirstActionButton(panelEl).click();
    expect(panelEl.children).toHaveLength(2);

    view.render({
      ...initialPlan,
      steps: [
        { id: 'introduce', label: 'Introduce the topic', status: 'done' },
        { id: 'practice', label: 'Practice the pattern', status: 'active' },
      ],
    });

    expect(panelEl.children).toHaveLength(2);
  });

  it('resets to minimized after clearing the plan', () => {
    const panelEl = new FakeElement('section');
    const view = new TutorPlanView({ panelEl });
    view.render(initialPlan);
    getFirstActionButton(panelEl).click();

    view.render(null);
    expect(panelEl.classList.contains('d-none')).toBe(true);

    view.render(initialPlan);
    expect(panelEl.children).toHaveLength(1);
    expect(panelEl.children[0].classList.contains('tutor-plan-minimized')).toBe(true);
  });

  it('resets an expanded completed plan before rendering the next plan', () => {
    const panelEl = new FakeElement('section');
    const view = new TutorPlanView({ panelEl });
    view.render(initialPlan);
    getFirstActionButton(panelEl).click();

    view.render({
      ...initialPlan,
      steps: initialPlan.steps.map((step) => ({ ...step, status: 'done' })),
    });
    expect(panelEl.children).toHaveLength(2);

    view.render({
      steps: [
        { id: 'review', label: 'Review the result', status: 'active' },
        { id: 'apply', label: 'Apply it independently', status: 'pending' },
      ],
      title: 'Follow-up plan',
    });

    expect(panelEl.children).toHaveLength(1);
    expect(panelEl.children[0].classList.contains('tutor-plan-minimized')).toBe(true);
  });
});
