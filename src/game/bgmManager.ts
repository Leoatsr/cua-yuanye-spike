import * as Phaser from 'phaser';

/**
 * 全局 BGM 单例
 *
 * 保证全工程任意时刻只有 1 个 BGM sound instance 在播。
 *
 * 用法 (每个 scene create() 末尾):
 *   bgmManager.play(this, 'bgm-village');
 *
 * 内部逻辑:
 *   - 同 key 已在播 → 什么都不做 (避免 scene 切换时无意义重启 · 听感连续)
 *   - 不同 key → fadeOut 旧的 + add 新的 + fadeIn
 *   - 静默 scene (内景) 调 bgmManager.stop(this) 让它安静
 *
 * 不再让任何 scene 自己 sound.add('bgm-*') · 全部走这里。
 */
class BGMManager {
  private current: Phaser.Sound.BaseSound | null = null;
  private currentKey: string | null = null;
  private volume = 0.4;

  /** 播放指定 BGM key · 同 key 跳过 · 不同 key 切换 */
  play(scene: Phaser.Scene, key: string, volume?: number) {
    if (volume !== undefined) this.volume = volume;

    // 同 key 已在播 · 什么都不做
    if (this.currentKey === key && this.current && this.current.isPlaying) {
      return;
    }

    // 切到不同 key · 先停旧的
    this.stopInternal();

    // 用任意 scene 的 sound manager 加新 instance
    // (Phaser sound manager 是全局的 · 任何 scene 拿到的都是同一个 SoundManager)
    const sound = scene.sound.add(key, { loop: true, volume: this.volume });
    sound.play();
    this.current = sound;
    this.currentKey = key;
  }

  /** 静默当前 BGM (内景用) */
  stop(_scene?: Phaser.Scene) {
    this.stopInternal();
  }

  private stopInternal() {
    if (this.current) {
      try {
        this.current.stop();
        this.current.destroy();
      } catch {
        // 可能 scene 已被销毁 · sound 引用失效 · 忽略
      }
      this.current = null;
      this.currentKey = null;
    }
  }

  /** 设置音量 · 影响当前播放 + 后续 */
  setVolume(v: number) {
    this.volume = v;
    if (this.current && 'setVolume' in this.current) {
      (this.current as Phaser.Sound.WebAudioSound).setVolume(v);
    }
  }

  getCurrentKey(): string | null {
    return this.currentKey;
  }
}

export const bgmManager = new BGMManager();
