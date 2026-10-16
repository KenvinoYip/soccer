/**
 * GameManager.ts
 * ─────────────────────────────────────────────────────────────
 * 少林足球 — 核心游戏状态机与主循环
 * Cocos Creator 3.8 Component
 *
 * 核心机制：
 *  1. 底部技能即点即发：
 *     - 不需要装填瞄准！点击技能图标（或按1/2/3）直接触发大招！
 *     - 释放后统一进入 10s 冷却，冷却结束后可直接再次释放。
 *  2. 智能索敌与超爽轰炸：
 *     - [1] 金刚腿·天火陨石：直冲砖块群核心爆破穿透全线并KO门将！
 *     - [2] 万佛千刃·影分身：18发闪电足球扇形全屏暴击覆盖！
 *     - [3] 如来神掌·山崩地裂：拍碎下半层砖块，引爆连环TNT！
 *  3. 真实物理反弹与连环弹射：
 *     - 左右两壁和天花板弹性回弹；
 *     - 砖块接触面法线物理反弹，可在缝隙中连环消除；
 *     - 仅当足球坠落草坪底线时才算失球出界。
 *  4. 绝地翻盘与判负安全缓冲：
 *     - 弹药用尽时允许施展大招翻盘，结算充分缓冲避免秒判负。
 * ─────────────────────────────────────────────────────────────
 */

import { _decorator, Component, Graphics, Color } from 'cc';
import { CONFIG, BallData, BrickData } from './Config';
import { audioSystem }    from './systems/AudioSystem';
import { inputSystem }    from './systems/InputSystem';
import { physicsSystem }  from './systems/PhysicsSystem';
import { particlePool }   from './fx/ParticlePool';
import { floatTextPool }  from './fx/FloatText';
import { shockWavePool }  from './fx/ShockWave';
import { PlayerEntity }   from './entities/PlayerEntity';
import { KeeperEntity }   from './entities/KeeperEntity';
import { createBrickGrid, drawBrick, updateBrickCracks, applyWallGravity } from './entities/BrickEntity';
import { drawBackground } from './renderers/BackgroundRenderer';
import { drawBall, drawAimLine, drawBallLandingMarker } from './renderers/BallRenderer';
import { skillSystem }    from './systems/SkillSystem';
import { burstCutIn }      from './fx/BurstCutIn';

const { ccclass } = _decorator;

// ─── Game State Enum ──────────────────────────────────────────
enum GameState { PLAYING, GAME_OVER }

// ─── Combo Config ─────────────────────────────────────────────
const COMBO_THRESHOLDS = [2, 5, 10, 20];
const COMBO_MULTIPLIERS = [1.5, 2, 3, 5];

@ccclass('GameManager')
export class GameManager extends Component {

  // ── Cocos References ──────────────────────────────────────
  private gfx!: Graphics;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // ── Game State ────────────────────────────────────────────
  private state: GameState = GameState.PLAYING;
  private stage:  number = 1;
  private score:  number = 0;
  private combo:  number = 0;
  private comboTimer: number = 0;       // frames until combo resets
  private ammo:   number = 5;
  private maxAmmo: number = 5;
  private mode:   number = 0;           // 0=fire, 1=clone, 2=pierce

  // ── Input / Aim / Paddle State ─────────────────────────────
  private isCharging: boolean = false;
  private isMovingPaddle: boolean = false;
  private aimX: number = 0;
  private aimY: number = 120;           // in Cocos world coords
  private powerPos: number = 0;         // 0..1 oscillating
  private powerDir: number = 1;
  private playerVx: number = 0;
  private keysHeld: Set<string> = new Set();

  // ── Camera Shake ──────────────────────────────────────────
  private shakeTime: number = 0;
  private shakeMag:  number = 0;
  private shakeOffX: number = 0;
  private shakeOffY: number = 0;
  private flashAlpha: number = 0;

  // ── Hit Stop ──────────────────────────────────────────────
  private hitStop: number = 0;
  private _gameEndTimeout: any = null;

  // ── Entity State ──────────────────────────────────────────
  private player!: PlayerEntity;
  private keeper!: KeeperEntity;
  private bricks: BrickData[] = [];
  private balls:  BallData[]  = [];

  // ─────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────

  onLoad() {
    this.gfx = this.getComponent(Graphics)!;
    if (!this.gfx) {
      console.error('[GameManager] No Graphics component found on node!');
      return;
    }

    // Access or create transparent overlay canvas for high-res UI & text rendering
    const htmlCanvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (htmlCanvas) {
      this.canvas = htmlCanvas;
      this.setupOverlayCanvas(htmlCanvas);
    }

    // Init entities
    this.player = new PlayerEntity();
    this.keeper = new KeeperEntity();

    // Init subsystems
    if (this.canvas) {
      inputSystem.attach(this.canvas);
      inputSystem.setCallbacks(
        (x, y) => this.onPointerDown(x, y),
        (x, y) => this.onPointerMove(x, y),
        ()      => this.onPointerUp()
      );
    }

    // Init stage
    this.initStage();

    // Listen for keyboard skill shortcuts (1, 2, 3) and paddle movement (A, D, ArrowLeft, ArrowRight)
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
  }

  onDestroy() {
    if (this.canvas) inputSystem.detach(this.canvas);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    clearTimeout(this._gameEndTimeout);
    const overlay = document.getElementById('game-ui-overlay');
    if (overlay && overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  }

  private onKeyDownBound = (e: KeyboardEvent) => this.onKeyDown(e);
  private onKeyUpBound   = (e: KeyboardEvent) => this.onKeyUp(e);

  private onKeyUp(e: KeyboardEvent) {
    this.keysHeld.delete(e.code);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.state !== GameState.PLAYING) return;
    audioSystem.init();

    this.keysHeld.add(e.code);

    const keyMap: Record<string, 'meteor' | 'barrage' | 'earthquake'> = {
      '1': 'meteor',
      '2': 'barrage',
      '3': 'earthquake',
    };

    const skillId = keyMap[e.key];
    if (skillId) {
      if (skillSystem.triggerById(skillId)) {
        // 直接触发释放！
        this.castSkill(skillId);
      } else {
        const s = skillSystem.getSkill(skillId);
        audioSystem.play('shield');
        floatTextPool.spawn(s ? s.x : 0, -290, `冷却中: ${s?.currentCd.toFixed(1)}s`, '#FF6B6B', 15);
      }
    }
  }

  private setupOverlayCanvas(webglCanvas: HTMLCanvasElement): void {
    if (!webglCanvas || !webglCanvas.parentElement) return;
    webglCanvas.parentElement.style.position = 'relative';

    let overlay = document.getElementById('game-ui-overlay') as HTMLCanvasElement;
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'game-ui-overlay';
      overlay.style.position = 'absolute';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '9999';
      webglCanvas.parentElement.appendChild(overlay);
    }
    const updateSize = () => {
      if (!webglCanvas || !webglCanvas.parentElement) return;
      webglCanvas.parentElement.style.position = 'relative';
      const rect = webglCanvas.getBoundingClientRect();
      const parentRect = webglCanvas.parentElement.getBoundingClientRect();

      // 精确吸附在 WebGL 游戏画布上，避免任何错位与黑边影响
      overlay.style.position = 'absolute';
      overlay.style.left = (rect.left - parentRect.left) + 'px';
      overlay.style.top = (rect.top - parentRect.top) + 'px';
      overlay.style.width = (rect.width || webglCanvas.clientWidth) + 'px';
      overlay.style.height = (rect.height || webglCanvas.clientHeight) + 'px';

      // 缓冲区严格等于实际显示像素，1:1 像素点阵，彻底杜绝任何拉伸或画面变形！
      overlay.width = Math.round(rect.width) || webglCanvas.clientWidth || 440;
      overlay.height = Math.round(rect.height) || webglCanvas.clientHeight || 780;
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    this.ctx = overlay.getContext('2d')!;
  }

  // ─────────────────────────────────────────────────────────
  // Stage Management
  // ─────────────────────────────────────────────────────────

  private initStage() {
    clearTimeout(this._gameEndTimeout);
    this.balls = [];
    particlePool.clear();
    floatTextPool.clear();
    shockWavePool.clear();

    // Ammo formulas
    this.maxAmmo = Math.max(4, 8 - Math.floor(this.stage / 2));
    this.ammo    = this.maxAmmo;

    // Bricks
    this.bricks = createBrickGrid(this.stage, CONFIG.W);

    // Reset keeper
    this.keeper.reset(this.stage);

    // Reset player position & momentum
    this.player.reset(0, CONFIG.GROUND_Y);
    this.playerVx = 0;
    this.isMovingPaddle = false;
    this.keysHeld.clear();

    // Reset aim & power bar
    this.powerPos = 0;
    this.powerDir = 1;
    this.isCharging = false;
    this.aimX = 0;
    this.aimY = 120;

    this.state = GameState.PLAYING;
    console.log(`[GameManager] Stage ${this.stage} started. Ammo: ${this.ammo}, Bricks: ${this.bricks.length}`);
  }

  // ─────────────────────────────────────────────────────────
  // Input Handlers
  // ─────────────────────────────────────────────────────────

  private onPointerDown(x: number, y: number) {
    if (this.state !== GameState.PLAYING) return;
    audioSystem.init();

    // 1. 点击底部技能：不需要装填，直接释放！
    const clickRes = skillSystem.checkClick(x, y);
    if (clickRes.clicked) {
      if (clickRes.triggered) {
        // 直接释放该技能！
        this.castSkill(clickRes.id!);
      } else {
        // 处于 10s 冷却中
        audioSystem.play('shield');
        floatTextPool.spawn(clickRes.x || 0, (clickRes.y || -330) + 40, `冷却中: ${clickRes.remaining?.toFixed(1)}s`, '#FF6B6B', 15);
      }
      return;
    }

    // 2. 特写动效播放期间，点击屏幕任意区域可立即快进引爆实弹！
    if (burstCutIn.active) {
      burstCutIn.finish();
      return;
    }

    // 3. 当场上有足球在飞行回弹时：拖拽/点击控制李小龙横向身法走位，准备截球！
    if (this.balls.length > 0) {
      this.isMovingPaddle = true;
      this.player.targetX = Math.max(-185, Math.min(185, x));
      return;
    }

    // 4. 场上无球时：拖拽瞄准击发足球（起手速度平缓）
    if (this.ammo <= 0) {
      audioSystem.play('shield');
      floatTextPool.spawn(0, -90, '⚽ 足球已耗尽！点击底部就绪技能直接绝杀！', '#FF6B6B', 16);
      return;
    }

    this.isCharging = true;
    this.aimX = x;
    this.aimY = Math.max(y, CONFIG.GROUND_Y + 70);
    this.powerPos = 0;
    this.powerDir = 1;
    this.player.startCharge();
  }

  private onPointerMove(x: number, y: number) {
    // 场上有球时，手指移动即滑动李小龙
    if (this.balls.length > 0) {
      this.player.targetX = Math.max(-185, Math.min(185, x));
      return;
    }
    if (!this.isCharging) return;
    this.aimX = x;
    this.aimY = Math.max(y, CONFIG.GROUND_Y + 70);
  }

  private onPointerUp() {
    this.isMovingPaddle = false;
    if (!this.isCharging) return;
    this.isCharging = false;
    this.fireBall();
  }

  // ─────────────────────────────────────────────────────────
  // Ultimate Skills Execution (大招特写与直接攻击目标)
  // ─────────────────────────────────────────────────────────

  private castSkill(id: 'meteor' | 'barrage' | 'earthquake') {
    if (this.state !== GameState.PLAYING) return;

    // 若前一个大招特写仍在播放，立即完成实弹爆发，无缝衔接当前大招！绝不丢弃任何操作！
    if (burstCutIn.active) {
      burstCutIn.finish();
    }

    // 独立冷却：当前技能立即进入 10s 独立冷却，其他两个技能完全不受影响！
    skillSystem.startCooldown(id);

    // 武僧瞬间跃入高空绝杀动作姿态！
    this.player.kick(true);
    audioSystem.play(id === 'meteor' ? 'superKick' : id === 'barrage' ? 'combo' : 'tnt');
    this.triggerShake(12, 8);

    // 触发必杀法相特写动效 (半透明武魂神影降临，~0.4s后爆发真实技能)
    burstCutIn.start(id, () => {
      this._executeSkillBlast(id);
    });
  }

  private _executeSkillBlast(id: 'meteor' | 'barrage' | 'earthquake') {
    if (this.state !== GameState.PLAYING) return;

    const px = CONFIG.PLAYER_X;
    const py = CONFIG.GROUND_Y + 25;

    if (id === 'meteor') {
      // 1. 大力金刚腿·天火陨石：三枚巨型陨石直捣黄龙，垂直向上贯穿全场
      audioSystem.play('superKick');
      this.player.kick(true);
      this.triggerShake(24, 20);
      this.flashAlpha = 0.65;

      shockWavePool.spawn(px, py, true);
      particlePool.spawnGoldExplosion(px, py, 35);
      floatTextPool.spawn(0, -80, '🔥 大力金刚腿·天火陨石!!', '#FF3838', 26, -1.8);

      // 三道天火陨石齐发：中路绝对垂直冲顶KO门将，左路与右路微扬角覆盖全墙
      const meteorConfigs = [
        { xOffset: 0,   vx: 0,    vy: 32, r: 32, dmg: 650 }, // 中路巨型主力陨石
        { xOffset: -25, vx: -3.8, vy: 31, r: 24, dmg: 480 }, // 左侧分翼陨石
        { xOffset: 25,  vx: 3.8,  vy: 31, r: 24, dmg: 480 }, // 右侧分翼陨石
      ];

      for (const m of meteorConfigs) {
        const ball: BallData = {
          x: px + m.xOffset,
          y: py,
          vx: m.vx,
          vy: m.vy,
          r: m.r,
          rot: 0,
          dmg: m.dmg,
          pierceLeft: 999, // 贯穿全线！
          isSuper: true,
          mode: 0,
          trail: []
        };
        this.balls.push(ball);
      }

    } else if (id === 'barrage') {
      // 2. 万佛千刃·影分身：16枚雷电足球精准智能索敌，直扑每一块存活砖块
      audioSystem.play('combo');
      this.player.kick(false);
      this.triggerShake(16, 10);
      this.flashAlpha = 0.45;

      shockWavePool.spawn(px, py, false);
      particlePool.spawnSpark(px, py, 25, '#00E5FF');
      floatTextPool.spawn(0, -80, '⚡ 万佛千刃·影分身暴雨!!', '#00E5FF', 26, -1.8);

      const count = 16;
      const aliveBricks = this.bricks.filter(b => b.hp > 0);

      for (let i = 0; i < count; i++) {
        let targetX = 0;
        let targetY = 70;

        if (aliveBricks.length > 0) {
          // 直接将目标分配给存活砖块！
          const b = aliveBricks[i % aliveBricks.length];
          targetX = b.x + b.w / 2;
          targetY = b.y + b.h / 2;
        } else {
          // 向上高扬角散布
          targetX = (i - count / 2) * 18;
          targetY = 220;
        }

        // 精准弹道动力学解算：dx = vx * t, dy = vy * t - 0.5 * g * t^2
        const tdx = targetX - px;
        const tdy = targetY - py;
        const dist = Math.hypot(tdx, tdy) || 1;
        const frames = Math.max(10, Math.round(dist / 22));

        const bvx = tdx / frames;
        const bvy = (tdy + 0.5 * CONFIG.GRAVITY * frames * frames) / frames;

        const ball: BallData = {
          x: px,
          y: py,
          vx: bvx,
          vy: bvy,
          r: 12,
          rot: Math.random() * Math.PI,
          dmg: 180,
          pierceLeft: 3,
          isSuper: false,
          mode: 1, // 闪电分身模式
          trail: []
        };
        this.balls.push(ball);
      }

    } else if (id === 'earthquake') {
      // 3. 如来神掌·山崩地裂：从天而降直接打击敌阵，拍碎砖墙KO门将
      audioSystem.play('tnt');
      audioSystem.play('boom');
      this.player.kick(true);
      this.triggerShake(32, 24);
      this.flashAlpha = 0.85;

      // 佛掌从天而降轰击全墙：左中右三重神圣金色震波与全屏金色爆轰
      shockWavePool.spawn(0, CONFIG.WALL_BOTTOM + 50, true);
      shockWavePool.spawn(-110, CONFIG.WALL_BOTTOM + 30, true);
      shockWavePool.spawn(110, CONFIG.WALL_BOTTOM + 30, true);
      shockWavePool.spawnTNT(0, CONFIG.WALL_BOTTOM + 30);
      particlePool.spawnGoldExplosion(0, CONFIG.WALL_BOTTOM + 40, 50);
      particlePool.spawnGoldExplosion(-100, CONFIG.WALL_BOTTOM + 40, 25);
      particlePool.spawnGoldExplosion(100, CONFIG.WALL_BOTTOM + 40, 25);
      floatTextPool.spawn(0, CONFIG.WALL_BOTTOM - 45, '✋ 如来神掌·万佛朝宗!!', '#FFD700', 32, -1.8);

      // 直接震飞扑倒守门员
      this.keeper.knockback();

      // 直接重创砖块：下半部全部击碎，上半部全体重创
      const tntQueue: { x: number; y: number }[] = [];
      let bricksCrushed = 0;

      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const b = this.bricks[i];
        if (b.y <= CONFIG.WALL_BOTTOM + 85) {
          // 下半层直接粉碎
          b.hp -= 420;
          b.hitFlash = 14;
          b.shakeX = (Math.random() - 0.5) * 20;
          updateBrickCracks(b);
          bricksCrushed++;
        } else {
          // 上半层遭受强烈神掌余波冲击
          b.hp -= 180;
          b.hitFlash = 10;
          b.shakeX = (Math.random() - 0.5) * 12;
          updateBrickCracks(b);
          bricksCrushed++;
        }

        if (b.hp <= 0) {
          if (b.type === 'tnt') tntQueue.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
          particlePool.spawnDebris(b.x + b.w / 2, b.y + b.h / 2, 7, b.color, b.w * 0.7, b.h * 0.7);
          this.bricks.splice(i, 1);
        }
      }

      // 引爆所有 TNT
      for (const tnt of tntQueue) {
        this.triggerImpact(tnt.x, tnt.y, 450, true, 130);
      }

      if (bricksCrushed > 0) {
        this.addCombo(bricksCrushed, 0, CONFIG.WALL_BOTTOM + 30);
        applyWallGravity(this.bricks, CONFIG.WALL_TOP, CONFIG.WALL_BOTTOM);
      }

      this.scheduleGameEndCheck(1200);
    }
  }

  // ─────────────────────────────────────────────────────────
  // Regular Ball Firing (普通射门，保证仰角向上)
  // ─────────────────────────────────────────────────────────

  private fireBall() {
    if (this.ammo <= 0) return;
    this.ammo--;

    const modeCfg = CONFIG.MODES[this.mode];
    const zone = this.getPowerZone(this.powerPos);

    const isSuper = zone === 'RED';
    const dmgMultiplier = isSuper ? 2.8 : zone === 'YELLOW' ? 1.5 : 1.0;
    const speedMultiplier = isSuper ? 1.4 : zone === 'YELLOW' ? 1.15 : 1.0;

    // 起手第一脚速度平缓（70%），给玩家充分反应时间就位准备接球
    const firstShotSpeedRatio = 0.70;
    const baseDmg   = Math.round(100 * modeCfg.dmgMultiplier * dmgMultiplier);
    const baseSpeed = CONFIG.BALL_MAX_SPEED * modeCfg.speedMultiplier * speedMultiplier * firstShotSpeedRatio;

    const startX = this.player.x;
    const startY = CONFIG.GROUND_Y + 20;
    const dx = this.aimX - startX;
    // 强制最小仰角：dy 保证向上至少 90px，避免横向贴地射出
    const dy = Math.max(90, this.aimY - startY);
    const mainAngle = Math.atan2(dy, dx);

    const angles: number[] = [];
    if (this.mode === 1) {
      angles.push(mainAngle - CONFIG.MODES[1].spreadRad!);
      angles.push(mainAngle);
      angles.push(mainAngle + CONFIG.MODES[1].spreadRad!);
    } else {
      angles.push(mainAngle);
    }

    for (const ang of angles) {
      const ball: BallData = {
        x: startX,
        y: startY,
        vx: Math.cos(ang) * baseSpeed,
        vy: Math.sin(ang) * baseSpeed,
        r: isSuper ? 18 : 13,
        rot: 0,
        dmg: this.mode === 1 ? Math.round(baseDmg * 0.75) : baseDmg,
        pierceLeft: isSuper ? 4 : this.mode === 2 ? CONFIG.MODES[2].pierces! : 3, // Bounces up to 3 times
        isSuper,
        mode: this.mode,
        trail: [],
        volleyCount: 0,
        speedMult: firstShotSpeedRatio
      };
      this.balls.push(ball);
    }

    // SFX + VFX
    audioSystem.play(isSuper ? 'superKick' : 'wata');
    if (isSuper) {
      this.triggerShake(14, 10);
      this.flashAlpha = 0.35;
      shockWavePool.spawn(startX, startY, true);
      particlePool.spawnGoldExplosion(startX, startY - 10, 15);
      floatTextPool.spawn(startX, startY + 30, '⚡ 飞龙绝杀!', '#FFD700', 22);
    } else {
      shockWavePool.spawn(startX, startY, false);
      particlePool.spawnSpark(startX, startY, 6, '#ff8c00');
      floatTextPool.spawn(startX, startY + 25, '🥋 WATA~! (起手70%球速)', '#FFE600', 16, -1.8);
    }

    this.player.kick(isSuper);
  }

  // ─────────────────────────────────────────────────────────
  // Impact Resolution
  // ─────────────────────────────────────────────────────────

  private triggerImpact(x: number, y: number, dmg: number, isSuper: boolean, radiusOverride?: number) {
    const radius = radiusOverride ?? (isSuper ? 85 : 50);

    this.hitStop = isSuper ? 4 : 2;
    this.triggerShake(isSuper ? 14 : 7, isSuper ? 12 : 5);
    if (isSuper) this.flashAlpha = 0.35;

    audioSystem.play('boom');
    shockWavePool.spawn(x, y, isSuper);
    particlePool.spawnSpark(x, y, isSuper ? 14 : 8, isSuper ? '#ff4500' : '#ffa500');
    particlePool.spawnSmoke(x, y, isSuper ? 6 : 3);

    const tntQueue: { x: number; y: number }[] = [];
    let bricksHit = 0;

    for (let i = this.bricks.length - 1; i >= 0; i--) {
      const b = this.bricks[i];
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      const dist = Math.hypot(cx - x, cy - y);

      if (dist <= radius + Math.max(b.w, b.h) * 0.5) {
        const falloff = dist < 20 ? 1 : Math.max(0.35, 1 - dist / (radius * 1.3));
        const actualDmg = Math.ceil(dmg * falloff);
        b.hp -= actualDmg;
        b.hitFlash = 8;
        b.shakeX = (Math.random() - 0.5) * 12;
        updateBrickCracks(b);
        bricksHit++;

        if (b.hp <= 0) {
          if (b.type === 'tnt') tntQueue.push({ x: cx, y: cy });
          particlePool.spawnDebris(cx, cy, 5, b.color, b.w * 0.6, b.h * 0.6);
          this.bricks.splice(i, 1);
        }
      }
    }

    // Chain-detonate TNTs
    for (const tnt of tntQueue) {
      setTimeout(() => {
        floatTextPool.spawn(tnt.x, tnt.y + 20, '🧨 连环TNT!', '#ffa502', 20);
        audioSystem.play('tnt');
        shockWavePool.spawnTNT(tnt.x, tnt.y);
        this.triggerImpact(tnt.x, tnt.y, 400, true, 120);
      }, 60);
    }

    if (bricksHit > 0) {
      this.addCombo(bricksHit, x, y);
      applyWallGravity(this.bricks, CONFIG.WALL_TOP, CONFIG.WALL_BOTTOM);
    }

    const scoreGain = Math.round(dmg * bricksHit * this.getComboMultiplier() * 0.8);
    if (scoreGain > 0) this.score += scoreGain;

    floatTextPool.spawnDamage(x, y, dmg, isSuper);

    this.scheduleGameEndCheck(800);
  }

  // ─────────────────────────────────────────────────────────
  // Combo System
  // ─────────────────────────────────────────────────────────

  private addCombo(bricksHit: number, x: number, y: number) {
    const prevCombo = this.combo;
    this.combo += bricksHit;
    this.comboTimer = 100;

    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.combo >= COMBO_THRESHOLDS[i] && prevCombo < COMBO_THRESHOLDS[i]) {
        audioSystem.play('combo');
        floatTextPool.spawnCombo(x, y - 30, this.combo);

        if (this.combo >= 10) {
          this.flashAlpha = Math.max(this.flashAlpha, 0.25);
          particlePool.spawnGoldExplosion(x, y, 20);
        }
        break;
      }
    }

    if (this.combo >= 2) {
      floatTextPool.spawnCombo(x + (Math.random() - 0.5) * 30, y - 50, this.combo);
    }
  }

  private getComboMultiplier(): number {
    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.combo >= COMBO_THRESHOLDS[i]) return COMBO_MULTIPLIERS[i];
    }
    return 1.0;
  }

  // ─────────────────────────────────────────────────────────
  // Safe Stage Victory / Defeat Check
  // ─────────────────────────────────────────────────────────

  private scheduleGameEndCheck(delayMs: number = 800) {
    if (this.state !== GameState.PLAYING) return;

    if (this.bricks.length === 0) {
      this.state = GameState.GAME_OVER;
      setTimeout(() => this.onVictory(), 500);
      return;
    }

    clearTimeout(this._gameEndTimeout);
    this._gameEndTimeout = setTimeout(() => {
      if (this.state !== GameState.PLAYING) return;

      if (this.bricks.length === 0) {
        this.state = GameState.GAME_OVER;
        this.onVictory();
      } else if (
        this.ammo <= 0 &&
        this.balls.length === 0 &&
        !this.isCharging
      ) {
        // 如果还有任何技能处于就绪可用状态，绝不判负！保留翻盘绝杀机会！
        const hasReadySkill = skillSystem.skills.some(s => s.currentCd <= 0);
        if (hasReadySkill) {
          return;
        }

        // 仅当弹药耗尽、场上无球、且无任何技能可用时，才判负
        this.state = GameState.GAME_OVER;
        this.onDefeat();
      }
    }, delayMs);
  }

  private onVictory() {
    console.log(`[GameManager] Stage ${this.stage} cleared! Score: ${this.score}`);
    audioSystem.play('crowd');
    floatTextPool.spawn(0, 50, '🎉 关卡大捷！PERFECT!', '#FFE033', 30);
    this.stage++;
    setTimeout(() => this.initStage(), 2200);
  }

  private onDefeat() {
    console.log(`[GameManager] Stage ${this.stage} failed. Bricks left: ${this.bricks.length}`);
    audioSystem.play('shield');
    floatTextPool.spawn(0, 50, '💔 闯关失败，重新挑战！', '#FF4757', 28);
    setTimeout(() => this.initStage(), 2200);
  }

  // ─────────────────────────────────────────────────────────
  // Camera Shake
  // ─────────────────────────────────────────────────────────

  private triggerShake(duration: number, magnitude: number) {
    this.shakeTime = Math.max(this.shakeTime, duration);
    this.shakeMag  = Math.max(this.shakeMag, magnitude);
  }

  private updateShake() {
    if (this.shakeTime > 0) {
      this.shakeTime--;
      this.shakeOffX = (Math.random() - 0.5) * this.shakeMag;
      this.shakeOffY = (Math.random() - 0.5) * this.shakeMag;
      this.shakeMag *= 0.88;
    } else {
      this.shakeOffX = 0;
      this.shakeOffY = 0;
    }
  }

  private getPowerZone(pos: number): 'GREEN' | 'YELLOW' | 'RED' {
    const zones = CONFIG.POWER_ZONES;
    if (pos >= zones.RED[0] && pos <= zones.RED[1])       return 'RED';
    if (pos >= zones.YELLOW[0] && pos <= zones.YELLOW[1]) return 'YELLOW';
    return 'GREEN';
  }

  // ─────────────────────────────────────────────────────────
  // Main Update Loop
  // ─────────────────────────────────────────────────────────

  update(dt: number) {
    // 1. Skill cooldowns (10s timer)
    skillSystem.update(dt || 0.016);

    // 2. 必杀技特写·半透明武魂法相降临动效
    burstCutIn.update();
    if (burstCutIn.active) {
      // 电影特写期间暂停战场时间，渲染武魂动效
      this.render();
      return;
    }

    // 3. Hit stop freeze
    if (this.hitStop > 0) { this.hitStop--; return; }

    // 3. Power bar oscillation
    if (this.isCharging) {
      this.powerPos += this.powerDir * 0.032;
      if (this.powerPos >= 1) { this.powerPos = 1; this.powerDir = -1; }
      if (this.powerPos <= 0) { this.powerPos = 0; this.powerDir = 1; }
    }

    // 4. Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer === 0) this.combo = 0;
    }

    // 4. Keyboard paddle controls (A / D / Left / Right)
    const moveLeft = this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft');
    const moveRight = this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight');
    if (moveLeft && !moveRight) {
      this.player.targetX = Math.max(-185, this.player.targetX - 8.5);
    } else if (moveRight && !moveLeft) {
      this.player.targetX = Math.min(185, this.player.targetX + 8.5);
    }

    // 5. Entities (compute playerVx for kick spin/momentum)
    const prevPx = this.player.x;
    this.player.update();
    this.playerVx = this.player.x - prevPx;

    this.keeper.update(this.balls, this.stage);

    // 6. Ball physics & boundaries
    const halfW = CONFIG.CANVAS.HALF_W;
    const halfH = CONFIG.CANVAS.HALF_H;

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      physicsSystem.moveBall(ball, CONFIG.GRAVITY);

      // Fire trail particles
      if (ball.isSuper || ball.mode === 0 || (ball.volleyCount && ball.volleyCount >= 2)) {
        particlePool.spawnFireTrail(ball.x, ball.y, ball.vx, ball.vy);
      }

      // ── Wall boundary bouncing (Left / Right / Top) ──
      if (ball.x - ball.r < -halfW) {
        ball.x = -halfW + ball.r;
        ball.vx = -ball.vx * CONFIG.PHYSICS.WALL_ELASTICITY;
        particlePool.spawnSpark(ball.x, ball.y, 4, '#ffdd59');
        audioSystem.play('kick');
      } else if (ball.x + ball.r > halfW) {
        ball.x = halfW - ball.r;
        ball.vx = -ball.vx * CONFIG.PHYSICS.WALL_ELASTICITY;
        particlePool.spawnSpark(ball.x, ball.y, 4, '#ffdd59');
        audioSystem.play('kick');
      }

      if (ball.y + ball.r > halfH) {
        ball.y = halfH - ball.r;
        ball.vy = -ball.vy * CONFIG.PHYSICS.WALL_ELASTICITY;
        particlePool.spawnSpark(ball.x, ball.y, 4, '#ffdd59');
        audioSystem.play('kick');
      }

      // ── Goalkeeper collision ──
      if (!this.keeper.flying) {
        const keeperHitZone = { x: this.keeper.x, y: this.keeper.y, r: this.keeper.r + 8 };
        if (physicsSystem.checkBallKeeperCollision(ball, keeperHitZone)) {
          const shieldPos = this.keeper.getShieldPosition();
          const shieldBlocked = this.keeper.hasShield &&
            Math.hypot(ball.x - shieldPos.x, ball.y - shieldPos.y) < ball.r + 18;

          if (shieldBlocked) {
            audioSystem.play('shield');
            floatTextPool.spawn(ball.x, ball.y + 20, '🛡️ 守门员格挡!', '#f1c40f', 16);
            physicsSystem.reflectBallOffKeeper(ball, this.keeper);
          } else if (!ball.isSuper && ball.dmg < 300) {
            audioSystem.play('shield');
            physicsSystem.reflectBallOffKeeper(ball, this.keeper);
          } else {
            // Super ball or meteor knocks keeper out!
            this.keeper.knockback();
            floatTextPool.spawn(ball.x, ball.y, '💥 飞身扑街 KO!', '#ff4757', 22);
            particlePool.spawnSpark(ball.x, ball.y, 14, '#ff6b35');
          }
        }
      }

      // ── Brick collision ──
      let brickHit = false;
      for (let j = this.bricks.length - 1; j >= 0; j--) {
        const b = this.bricks[j];
        if (physicsSystem.checkBallBrickCollision(ball, b)) {
          brickHit = true;

          if (ball.isSuper || ball.dmg >= 300) {
            // Penetrating explosion
            this.triggerImpact(ball.x, ball.y, ball.dmg, true);
            ball.pierceLeft--;
            if (ball.pierceLeft <= 0) {
              this.balls.splice(i, 1);
              this.scheduleGameEndCheck();
            }
          } else {
            // Realistic brick bounce
            physicsSystem.resolveBallBrickBounce(ball, b);
            this.triggerImpact(ball.x, ball.y, ball.dmg, false, 35);
            ball.pierceLeft--;
            if (ball.pierceLeft <= 0) {
              this.balls.splice(i, 1);
              this.scheduleGameEndCheck();
            }
          }
          break;
        }
      }

      // ── Kung Fu Interception & Volley Kick (接球连踢第二脚，无需耗费新球！) ──
      const isDescending = ball.vy < 0;
      const inCatchZone = ball.y >= CONFIG.GROUND_Y - 25 && ball.y <= CONFIG.GROUND_Y + 40;
      const dxToPlayer = ball.x - this.player.x;
      const catchHalfWidth = 44;

      if (!brickHit && isDescending && inCatchZone && Math.abs(dxToPlayer) <= catchHalfWidth) {
        ball.volleyCount = (ball.volleyCount || 0) + 1;
        const count = ball.volleyCount;

        // 打砖块力学反弹：依据球落在李小龙左侧、中间或右侧计算弹射仰角
        const offset = dxToPlayer / catchHalfWidth; // -1 to 1
        let reboundAngle = (Math.PI / 2) - offset * (Math.PI / 3.6) - Math.max(-0.25, Math.min(0.25, this.playerVx * 0.04));
        reboundAngle = Math.max(0.42, Math.min(Math.PI - 0.42, reboundAngle));

        // 连踢层级强化（速度与伤害随连击递增）：
        // 第1脚起手：0.70x 速度，1.00x 伤害
        // 第2脚截击：0.85x 速度，1.25x 伤害
        // 第3脚连击：1.00x 速度，1.60x 伤害
        // 第4脚凌空：1.15x 速度，2.00x 伤害
        // 第5脚+无影：1.25x 速度，2.50x 伤害
        const speedTiers = [0.70, 0.85, 1.00, 1.15, 1.25];
        const speedRatio = speedTiers[Math.min(count, speedTiers.length - 1)];
        const dmgTiers = [1.0, 1.25, 1.6, 2.0, 2.5];
        const dmgMult = dmgTiers[Math.min(count, dmgTiers.length - 1)];

        const modeCfg = CONFIG.MODES[ball.mode] || CONFIG.MODES[0];
        const baseKickSpeed = CONFIG.BALL_MAX_SPEED * modeCfg.speedMultiplier;
        const newSpeed = baseKickSpeed * speedRatio;

        ball.vx = Math.cos(reboundAngle) * newSpeed;
        ball.vy = Math.sin(reboundAngle) * newSpeed;
        ball.y = CONFIG.GROUND_Y + 28; // 弹起脱离草地判定区
        ball.dmg = Math.round(100 * modeCfg.dmgMultiplier * dmgMult);
        ball.pierceLeft = Math.max(ball.pierceLeft, 3); // 恢复穿透与弹跳次数

        if (count >= 2) {
          ball.isSuper = true; // 连击化身金光烈焰球
        }

        // 李小龙标志性凌空飞踢姿态 + 拳风音效 + 震屏
        const isSuperKick = count >= 2;
        this.player.kick(isSuperKick);
        audioSystem.play(isSuperKick ? 'superKick' : 'wata');
        this.triggerShake(isSuperKick ? 12 : 7, isSuperKick ? 9 : 5);
        shockWavePool.spawn(ball.x, ball.y, isSuperKick);
        particlePool.spawnSpark(ball.x, ball.y, 10 + count * 3, isSuperKick ? '#FFD700' : '#FF9F1C');

        if (count === 1) {
          floatTextPool.spawn(this.player.x, this.player.y + 45, '⚡ 连环截击! 速度提升!', '#FFE600', 18, -1.8);
        } else if (count === 2) {
          floatTextPool.spawn(this.player.x, this.player.y + 45, '🔥 2连踢! 威力暴涨!', '#FFA502', 20, -1.8);
        } else if (count === 3) {
          floatTextPool.spawn(this.player.x, this.player.y + 45, '💥 3连踢·真功夫! 火力全开!', '#FF4757', 22, -1.8);
        } else {
          floatTextPool.spawn(this.player.x, this.player.y + 45, `🥋 ${count}连爆踢·无影脚!!`, '#FF0055', 24, -1.8);
        }

        continue;
      }

      // ── Out of Bounds: Only lost when falling past Bruce Lee below pitch bottom ──
      if (!brickHit && (ball.y + ball.r < -halfH || ball.y < CONFIG.GROUND_Y - 45)) {
        this.balls.splice(i, 1);
        audioSystem.play('shield');
        floatTextPool.spawn(ball.x, -260, '❌ 未能接住失球', '#94A3B8', 14, -1.5);
        this.scheduleGameEndCheck();
      }
    }

    // 7. FX Updates
    particlePool.update();
    floatTextPool.update();
    shockWavePool.update();

    // 8. Screen shake decay
    this.updateShake();
    this.flashAlpha = Math.max(0, this.flashAlpha - 0.04);

    // 9. Render Frame
    this.render();
  }

  // ─────────────────────────────────────────────────────────
  // Render Pipeline
  // ─────────────────────────────────────────────────────────

  private render() {
    const gfx = this.gfx;
    gfx.clear();

    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    }

    if (this.shakeOffX !== 0 || this.shakeOffY !== 0) {
      this.node.setPosition(this.shakeOffX, this.shakeOffY, 0);
    } else {
      this.node.setPosition(0, 0, 0);
    }

    const W = CONFIG.W, H = CONFIG.H;

    // 1. Stadium Background
    drawBackground(gfx, W, H, this.flashAlpha, this.shakeOffX, this.shakeOffY);

    // 1.5. Dynamic Landing Target Indicator (草地截球落点预警光圈与准星)
    drawBallLandingMarker(gfx, this.balls, this.player.x);

    // 2. Bricks with Physics Gravity Falling
    for (const b of this.bricks) {
      if (b.targetY !== undefined && b.y > b.targetY) {
        b.vy = (b.vy || 0) - 0.7;
        b.y += b.vy;
        if (b.y <= b.targetY) {
          b.y = b.targetY;
          b.vy = 0;
        }
      }
      b.shakeX *= -0.55;
      if (b.hitFlash > 0) b.hitFlash--;
      drawBrick(gfx, b);
    }

    // 3. Aim trajectory (when charging regular ball - starts from Bruce Lee's actual location with gentle 70% speed)
    if (this.isCharging) {
      const startX = this.player.x;
      const startY = CONFIG.GROUND_Y + 20;
      const dx = this.aimX - startX;
      const dy = this.aimY - startY;
      const len = Math.hypot(dx, dy) || 1;
      const zone = this.getPowerZone(this.powerPos);
      const isSuper = zone === 'RED';
      const modeCfg = CONFIG.MODES[this.mode];
      const speed = CONFIG.BALL_MAX_SPEED * modeCfg.speedMultiplier * (isSuper ? 1.4 : 1.0) * 0.70;

      const trajectory = physicsSystem.predictTrajectory(
        startX, startY,
        (dx / len) * speed,
        (dy / len) * speed,
        CONFIG.GRAVITY, 36
      );
      drawAimLine(gfx, trajectory, isSuper);
    }

    // 4. Goalkeeper
    this.keeper.draw(gfx);

    // 5. Balls
    for (const ball of this.balls) {
      drawBall(gfx, ball);
    }

    // 6. Particles
    particlePool.draw(gfx);

    // 7. Player (Real Anime Hero Character Sprite)
    this.player.draw(gfx, this.ctx);

    // 8. Shockwaves
    shockWavePool.draw(gfx);

    // 9. Floating texts & damage numbers on 2D overlay
    if (this.ctx) {
      floatTextPool.draw(gfx, this.ctx);
    }

    // 10. HUD (Power bar, Ammo, Top Status Bar)
    this.drawHUD(gfx);

    // 11. Ultimate Skills Buttons (Direct Click to Cast, 10s CD)
    skillSystem.draw(gfx, this.ctx);

    // 12. 必杀技特写·半透明武魂神影 (Burst Cut-In Martial Avatar)
    if (this.ctx) {
      burstCutIn.draw(this.ctx, this.player.getAvatarSprite());
    }
  }

  // ─────────────────────────────────────────────────────────
  // HUD Rendering
  // ─────────────────────────────────────────────────────────

  private drawHUD(gfx: Graphics) {
    const W = CONFIG.W;
    const groundY = CONFIG.GROUND_Y;

    // ── Power Bar ────────────────────────────────────────────
    const barW = 220, barH = 14;
    const barX = -barW / 2;
    const barY = groundY - 32;

    // Background track
    gfx.fillColor = new Color(20, 20, 30, 220);
    gfx.rect(barX, barY, barW, barH);
    gfx.fill();

    // Green zone
    gfx.fillColor = new Color(46, 213, 115, 200);
    gfx.rect(barX, barY, barW * 0.65, barH);
    gfx.fill();

    // Yellow zone
    gfx.fillColor = new Color(255, 165, 2, 200);
    gfx.rect(barX + barW * 0.65, barY, barW * 0.2, barH);
    gfx.fill();

    // Red zone (super)
    gfx.fillColor = new Color(255, 55, 55, 220);
    gfx.rect(barX + barW * 0.85, barY, barW * 0.15, barH);
    gfx.fill();

    // Border
    gfx.strokeColor = new Color(255, 255, 255, 180);
    gfx.lineWidth = 1.5;
    gfx.rect(barX, barY, barW, barH);
    gfx.stroke();

    // Marker
    const markerX = barX + this.powerPos * barW;
    const zone = this.getPowerZone(this.powerPos);
    const markerColor = zone === 'RED'
      ? new Color(255, 80, 80, 255)
      : zone === 'YELLOW'
      ? new Color(255, 200, 0, 255)
      : new Color(255, 255, 255, 255);

    gfx.fillColor = markerColor;
    gfx.rect(markerX - 3, barY - 5, 6, barH + 10);
    gfx.fill();

    // ── Ammo circles (bottom pitch) ───────────────────────────
    const ammoStartX = -W / 2 + 20;
    const ammoY = groundY + 22;
    for (let i = 0; i < this.maxAmmo; i++) {
      const ax = ammoStartX + i * 20;
      if (i < this.ammo) {
        gfx.fillColor = new Color(255, 255, 255, 240);
      } else {
        gfx.fillColor = new Color(60, 70, 90, 180);
      }
      gfx.circle(ax, ammoY, 6.5);
      gfx.fill();
      gfx.strokeColor = new Color(40, 50, 70, 220);
      gfx.lineWidth = 1.5;
      gfx.circle(ax, ammoY, 6.5);
      gfx.stroke();
    }

    // ── High-Res Canvas 2D Top Header HUD ─────────────────────
    if (this.ctx) {
      const ctx = this.ctx;
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const scale = Math.min(cw / 440, ch / 780);

      ctx.save();
      // Top Status Bar Background
      const headerH = Math.round(55 * scale);
      ctx.fillStyle = 'rgba(10, 14, 26, 0.85)';
      ctx.fillRect(0, 0, cw, headerH);

      // Bottom accent line
      ctx.fillStyle = '#EAB308';
      ctx.fillRect(0, headerH - Math.max(1, Math.round(2 * scale)), cw, Math.max(1, Math.round(2 * scale)));

      // Stage & Score (Left)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const stageFontSize = Math.max(12, Math.round(16 * scale));
      ctx.font = `900 ${stageFontSize}px 'PingFang SC', sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`关卡 ${this.stage}`, Math.round(16 * scale), Math.round(24 * scale));

      const scoreFontSize = Math.max(10, Math.round(13 * scale));
      ctx.font = `bold ${scoreFontSize}px 'PingFang SC', sans-serif`;
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(`得分: ${this.score}`, Math.round(84 * scale), Math.round(25 * scale));

      // Remaining Balls (Right)
      ctx.textAlign = 'right';
      const ammoFontSize = Math.max(10, Math.round(14 * scale));
      ctx.font = `bold ${ammoFontSize}px 'PingFang SC', sans-serif`;
      ctx.fillStyle = this.ammo > 0 ? '#4ADE80' : '#F87171';
      ctx.fillText(`⚽ 剩余足球: ${this.ammo} / ${this.maxAmmo}`, cw - Math.round(16 * scale), Math.round(25 * scale));

      // Center Instructional Prompt
      ctx.textAlign = 'center';
      const promptFontSize = Math.max(8, Math.round(11 * scale));
      ctx.font = `bold ${promptFontSize}px 'PingFang SC', sans-serif`;
      if (this.ammo <= 0 && this.balls.length === 0) {
        ctx.fillStyle = '#F87171';
        ctx.fillText('⚠️ 足球已耗尽！点击底部可用技能直接释放绝地反击！', cw / 2, Math.round(42 * scale));
      } else if (this.balls.length > 0) {
        ctx.fillStyle = '#FBBF24';
        ctx.fillText('🥋 左右拖拽或按A/D控制李小龙走位！接住回弹球可无限连踢升级！', cw / 2, Math.round(42 * scale));
      } else if (this.isCharging) {
        ctx.fillStyle = '#6EE7B7';
        ctx.fillText('🎯 瞄准中... 松手击发！(起手70%球速，做好截球准备)', cw / 2, Math.round(42 * scale));
      } else {
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText('👆 拖拽瞄准击发首球 | 左右移动截接回弹 | 点击技能直接释放', cw / 2, Math.round(42 * scale));
      }

      ctx.restore();
    }
  }
}
