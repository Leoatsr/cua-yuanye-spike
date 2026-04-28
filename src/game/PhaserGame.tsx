import * as Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { BootScene } from './scenes/BootScene';
import { MainScene } from './scenes/MainScene';
import { InteriorScene } from './scenes/InteriorScene';
import { SproutCityScene } from './scenes/SproutCityScene';
import { GovHillScene } from './scenes/GovHillScene';
import { VisionTowerScene } from './scenes/VisionTowerScene';
import { CouncilHallScene } from './scenes/CouncilHallScene';
import { MirrorPavilionScene } from './scenes/MirrorPavilionScene';
import { GrandPlazaScene } from './scenes/GrandPlazaScene';
import { HomeScene } from './scenes/HomeScene';
import { KaiyuanLouScene } from './scenes/KaiyuanLouScene';
import { ShengwenTaiScene } from './scenes/ShengwenTaiScene';
import { DuliangGeScene } from './scenes/DuliangGeScene';
import { YincaiFangScene } from './scenes/YincaiFangScene';
import { SisuanSuoScene } from './scenes/SisuanSuoScene';
import { YishiTingScene } from './scenes/YishiTingScene';
import { WangqiLouScene } from './scenes/WangqiLouScene';
import { GongdeTangScene } from './scenes/GongdeTangScene';

export function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1280,
      height: 720,
      pixelArt: true,
      backgroundColor: '#1a1a1a',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [
        BootScene,
        MainScene,
        InteriorScene,
        SproutCityScene,
        GovHillScene,
        VisionTowerScene,
        CouncilHallScene,
        MirrorPavilionScene,
        GrandPlazaScene,
        HomeScene,
        KaiyuanLouScene,
        ShengwenTaiScene,
        DuliangGeScene,
        YincaiFangScene,
        SisuanSuoScene,
        YishiTingScene,
        WangqiLouScene,
        GongdeTangScene,
      ],
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
      }}
    />
  );
}
