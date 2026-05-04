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
import { VillageHeadScene } from './scenes/VillageHeadScene';
import { LibraryScene } from './scenes/LibraryScene';
import { BlacksmithScene } from './scenes/BlacksmithScene';
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
      width: window.innerWidth,
      height: window.innerHeight,
      pixelArt: true,
      // Wave 11 修复 · 背景色从米黄 #fdf0cf 改为暖木色 #8b4513
      // 当浏览器窗口宽 > ROOM_WIDTH × zoom(2) 时 · camera 拍不满 canvas
      // 边缘空白部分显示这个 backgroundColor · 暖木色让空白看起来像房间墙外延伸
      // 而不是突兀的米黄空地板
      backgroundColor: '#8b4513',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
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
        VillageHeadScene,
        LibraryScene,
        BlacksmithScene,
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
        background: '#1a1a1a',
      }}
    />
  );
}
