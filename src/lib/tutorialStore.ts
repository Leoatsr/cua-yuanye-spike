import { EventBus } from '../game/EventBus';
import {
  ACTIVE_STEPS,
  TUTORIAL_STEPS,
  type TutorialStep,
} from './tutorialSteps';

/**
 * 互动教程状态机
 *
 * - 持久化进度到 localStorage
 * - 监听各种事件 + 玩家移动 / 位置 / scene 切换
 * - 自动推进 step
 * - 支持跳过 / 重置 / 暂停
 */

interface TutorialState {
  active: boolean;          // 教程是否激活中
  currentStepId: number | null;  // 当前 step（null = 未开始）
  completedStepIds: number[];    // 已完成的 step
  skipped: boolean;          // 玩家选择跳过
  startedAt: number | null;
}

const STORAGE_KEY = 'cua-yuanye-tutorial-v1';

const DEFAULT_STATE: TutorialState = {
  active: false,
  currentStepId: null,
  completedStepIds: [],
  skipped: false,
  startedAt: null,
};

class TutorialManager {
  private state: TutorialState = DEFAULT_STATE;
  private listeners = new Set<() => void>();
  private movementAccumulated = 0;
  private lastPosition: { x: number; y: number } | null = null;
  private listenersBound = false;

  // ============================================================================
  // 持久化
  // ============================================================================

  load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TutorialState;
        this.state = { ...DEFAULT_STATE, ...parsed };
      }
    } catch {
      this.state = { ...DEFAULT_STATE };
    }
  }

  save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // ignore
    }
  }

  // ============================================================================
  // 状态查询
  // ============================================================================

  isActive(): boolean {
    return this.state.active;
  }

  isSkipped(): boolean {
    return this.state.skipped;
  }

  getCurrentStep(): TutorialStep | null {
    if (!this.state.active || this.state.currentStepId === null) return null;
    return TUTORIAL_STEPS.find((s) => s.id === this.state.currentStepId) ?? null;
  }

  getCompletedCount(): number {
    return this.state.completedStepIds.length;
  }

  getActiveTotalCount(): number {
    return ACTIVE_STEPS.length;
  }

  getProgress(): { completed: number; total: number; percent: number } {
    const total = ACTIVE_STEPS.length;
    const completedActive = this.state.completedStepIds.filter((id) =>
      ACTIVE_STEPS.some((s) => s.id === id)
    ).length;
    return {
      completed: completedActive,
      total,
      percent: total > 0 ? Math.round((completedActive / total) * 100) : 0,
    };
  }

  isAllActiveCompleted(): boolean {
    return ACTIVE_STEPS.every((s) =>
      this.state.completedStepIds.includes(s.id)
    );
  }

  hasEverStarted(): boolean {
    return this.state.startedAt !== null;
  }

  // ============================================================================
  // 教程控制
  // ============================================================================

  /** 自动启动（首次进游戏触发）*/
  autoStartIfNeeded(): void {
    // 已经开始过 / 跳过过 / 全完成 → 不再自动启动
    if (this.hasEverStarted()) return;
    if (this.state.skipped) return;
    if (this.isAllActiveCompleted()) return;
    this.start();
  }

  start(): void {
    this.state.active = true;
    this.state.skipped = false;
    if (this.state.startedAt === null) {
      this.state.startedAt = Date.now();
    }
    // 找下一个未完成的 active step
    const next = this.findNextStep();
    this.state.currentStepId = next?.id ?? null;
    if (this.state.currentStepId === null) {
      this.state.active = false; // 没 step 可做，关闭
    }
    this.save();
    this.notify();
    this.bindListeners();
  }

  /** 跳过整个教程 */
  skip(): void {
    this.state.active = false;
    this.state.skipped = true;
    this.state.currentStepId = null;
    this.save();
    this.notify();
  }

  /** 重置（从手册"重新开始"按钮触发）*/
  reset(): void {
    this.state = { ...DEFAULT_STATE };
    this.save();
    this.notify();
  }

  /** 关闭当前教程提示但不算跳过 */
  pause(): void {
    this.state.active = false;
    this.save();
    this.notify();
  }

  /** 标记当前 step 完成 + 推进到下一个 */
  completeCurrentStep(): void {
    if (this.state.currentStepId === null) return;
    if (!this.state.completedStepIds.includes(this.state.currentStepId)) {
      this.state.completedStepIds.push(this.state.currentStepId);
    }
    // 找下一个
    const next = this.findNextStep();
    this.state.currentStepId = next?.id ?? null;
    if (this.state.currentStepId === null) {
      // 全完成
      this.state.active = false;
      EventBus.emit('show-toast', {
        message: '🎉 恭喜！你已完成所有教程',
        type: 'success',
      });
    }
    this.save();
    this.notify();
  }

  /** 手动推进（manual 类型 step 玩家点"我已完成"）*/
  manualAdvance(): void {
    const step = this.getCurrentStep();
    if (!step) return;
    if (step.completion !== 'manual') return;
    this.completeCurrentStep();
  }

  /** 重置 movement accumulator（外部调用，用于切换 step 后清零）*/
  resetMovementAccumulator(): void {
    this.movementAccumulated = 0;
    this.lastPosition = null;
  }

  // ============================================================================
  // 完成检测（由 EventBus 触发）
  // ============================================================================

  private bindListeners(): void {
    if (this.listenersBound) return;
    this.listenersBound = true;

    // 通用 event 监听 — 监听所有可能的 step trigger 事件
    const eventNames = new Set<string>();
    for (const step of TUTORIAL_STEPS) {
      if (
        step.completion === 'event' ||
        step.completion === 'event-with-data'
      ) {
        const name = step.completionData?.eventName as string | undefined;
        if (name) eventNames.add(name);
      }
    }
    for (const eventName of eventNames) {
      EventBus.on(eventName, (data: unknown) => {
        this.onEvent(eventName, data);
      });
    }

    // Scene 切换
    EventBus.on('chat-scene-changed', (data: unknown) => {
      const d = data as { sceneKey?: string };
      if (d?.sceneKey) {
        this.onSceneChange(d.sceneKey);
      }
    });

    // 玩家移动 — 通过 player-position-update 事件
    EventBus.on('player-position-update', (data: unknown) => {
      const d = data as { x?: number; y?: number };
      if (typeof d?.x === 'number' && typeof d?.y === 'number') {
        this.onMovement(d.x, d.y);
      }
    });
  }

  private onEvent(eventName: string, _data: unknown): void {
    if (!this.state.active) return;
    const step = this.getCurrentStep();
    if (!step) return;
    if (step.completion !== 'event' && step.completion !== 'event-with-data')
      return;
    if (step.completionData?.eventName !== eventName) return;

    // 简单 event：直接完成
    if (step.completion === 'event') {
      this.completeCurrentStep();
    }
    // event-with-data：可扩展
  }

  private onSceneChange(sceneKey: string): void {
    if (!this.state.active) return;
    const step = this.getCurrentStep();
    if (!step) return;
    if (step.completion !== 'scene-change') return;
    if (step.completionData?.sceneKey !== sceneKey) return;
    this.completeCurrentStep();
  }

  private onMovement(x: number, y: number): void {
    if (!this.state.active) return;
    const step = this.getCurrentStep();
    if (!step) return;
    if (step.completion !== 'movement') return;

    if (this.lastPosition === null) {
      this.lastPosition = { x, y };
      return;
    }

    const dx = x - this.lastPosition.x;
    const dy = y - this.lastPosition.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 排除瞬移（场景切换时位置突变）
    if (dist < 50) {
      this.movementAccumulated += dist;
    }
    this.lastPosition = { x, y };

    const required = (step.completionData?.distance as number) ?? 200;
    if (this.movementAccumulated >= required) {
      this.movementAccumulated = 0;
      this.completeCurrentStep();
    }
  }

  // ============================================================================
  // 辅助
  // ============================================================================

  /** 找下一个未完成的 active step */
  private findNextStep(): TutorialStep | null {
    for (const step of ACTIVE_STEPS) {
      if (!this.state.completedStepIds.includes(step.id)) {
        return step;
      }
    }
    return null;
  }

  // ============================================================================
  // React 订阅（用于 Overlay 重新渲染）
  // ============================================================================

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export const tutorialManager = new TutorialManager();

if (typeof window !== 'undefined') {
  (window as unknown as { __tutorial: TutorialManager }).__tutorial =
    tutorialManager;
}
