/**
 * KeeperEntity.ts — 守门员：AI追踪、扑救动画、盾牌渲染
 */
import { Color, Graphics } from 'cc';
import { CONFIG } from '../Config';

export class KeeperEntity {
  x: number = 0;
  y: number = CONFIG.LAYOUT.KEEPER_Y;
  vx: number = 2.2;
  r: number = 22;
  shieldAngle: number = 0;
  hasShield: boolean = true;
  flying: boolean = false;
  vy: number = 0;
  rot: number = 0;
  diveDir: number = 0;   // 0=none, 1=right, -1=left
  diveTimer: number = 0;
  fatigueTimer: number = 0;
  alpha: number = 1.0;   // fades when flying off screen

  private baseSpeed: number = 2.2;

  reset(stage: number) {
    this.x           = 0;
    this.y           = CONFIG.LAYOUT.KEEPER_Y;
    this.baseSpeed   = 2 + stage * 0.3;
    this.vx          = this.baseSpeed * (Math.random() < 0.5 ? 1 : -1);
    this.hasShield   = stage >= 2;
    this.flying      = false;
    this.vy          = 0;
    this.rot         = 0;
    this.diveDir     = 0;
    this.diveTimer   = 0;
    this.fatigueTimer = 0;
    this.alpha       = 1.0;
    this.shieldAngle = 0;
  }

  getShieldPosition(): { x: number; y: number } {
    return {
      x: this.x + Math.cos(this.shieldAngle) * 34,
      y: this.y + Math.sin(this.shieldAngle) * 14,
    };
  }

  knockback() {
    this.flying  = true;
    this.vy      = 14 + Math.random() * 4;
    this.vx      = (Math.random() - 0.5) * 10;
    this.diveDir = 0;
    this.diveTimer = 0;
  }

  update(balls: { x: number; y: number; vx: number; vy: number }[], _stage: number) {
    this.shieldAngle += 0.06;

    if (this.flying) {
      this.x   += this.vx;
      this.y   += this.vy;
      this.vy  -= CONFIG.GRAVITY * 1.2;
      this.rot += 0.18;
      if (this.y < -CONFIG.H / 2 - 60) {
        // Respawn keeper at top after flying off
        this.reset(_stage);
        this.y = CONFIG.WALL_TOP + 20;
      }
      return;
    }

    // Cool-down timers
    if (this.fatigueTimer > 0) this.fatigueTimer--;
    if (this.diveTimer > 0) {
      // Actively diving
      this.x += this.diveDir * 9;
      this.x = Math.max(-190, Math.min(190, this.x));
      this.diveTimer--;
      if (this.diveTimer === 0) this.fatigueTimer = 65;
      return;
    }

    // ── AI: predict ball interception ──────────────────────
    let targetX = this.x; // default: stay put
    let nearestBallDist = Infinity;

    for (const ball of balls) {
      // Only track balls moving toward keeper (upward in Y-up coords = positive vy)
      if (ball.vy <= 0) continue;
      const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
      if (dist < nearestBallDist) {
        nearestBallDist = dist;
        // Predict where ball will be when it reaches keeper's Y
        const dy = this.y - ball.y;
        if (Math.abs(ball.vy) > 0.1) {
          const t = dy / ball.vy;
          targetX = ball.x + ball.vx * t;
        } else {
          targetX = ball.x;
        }
        // Clamp prediction to bounds
        targetX = Math.max(-185, Math.min(185, targetX));
      }
    }

    // Move toward predicted intercept point
    const dx    = targetX - this.x;
    const speed = this.fatigueTimer > 0 ? this.baseSpeed * 0.5 : this.baseSpeed;
    const step  = nearestBallDist < Infinity ? speed * 1.0 : speed * 0.7;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), step);

    // Bounce off walls
    if (this.x < -185) { this.x = -185; this.vx = Math.abs(this.vx); }
    if (this.x >  185) { this.x =  185; this.vx = -Math.abs(this.vx); }

    // Trigger dive if ball is close
    if (nearestBallDist < 65 && this.fatigueTimer === 0) {
      const nearestBall = balls.find(b => Math.hypot(b.x - this.x, b.y - this.y) < 65);
      if (nearestBall) {
        this.diveDir   = nearestBall.x > this.x ? 1 : -1;
        this.diveTimer = 18;
      }
    }
  }

  draw(gfx: Graphics) {
    gfx.fillColor = new Color(255, 255, 255, Math.round(this.alpha * 255));

    // Apply rotation for flying state
    const cosR = this.flying ? Math.cos(this.rot) : 1;
    const sinR = this.flying ? Math.sin(this.rot) : 0;

    // Helper: draw in keeper-local coords with optional rotation
    const kx = this.x;
    const ky = this.y;

    // Shadow
    gfx.fillColor = new Color(0, 0, 0, 50);
    gfx.circle(kx, ky - 36, 18);
    gfx.fill();

    // ── Body (jersey) ─────────────────────────────────────
    const bodyAlpha = Math.round(this.alpha * 255);

    // Dive tilt
    const tilt = this.diveDir !== 0 ? this.diveDir * 0.35 : 0;
    const bodyX = kx + Math.sin(tilt) * 12;
    const bodyY = ky + (this.diveDir !== 0 ? 4 : 0);

    gfx.fillColor = new Color(231, 76, 60, bodyAlpha);
    gfx.rect(bodyX - 14, bodyY - 32, 28, 32);
    gfx.fill();

    // Jersey stripe
    gfx.fillColor = new Color(255, 255, 255, 160);
    gfx.rect(bodyX - 14, bodyY - 22, 28, 5);
    gfx.fill();

    // ── Head ──────────────────────────────────────────────
    const headX = bodyX;
    const headY = bodyY - 44;
    gfx.fillColor = new Color(255, 218, 121, bodyAlpha);
    gfx.circle(headX, headY, 14);
    gfx.fill();

    // Eyes (angry)
    gfx.fillColor = new Color(30, 20, 20, bodyAlpha);
    gfx.circle(headX - 4, headY, 3);
    gfx.fill();
    gfx.circle(headX + 4, headY, 3);
    gfx.fill();

    // Angry brows
    gfx.strokeColor = new Color(80, 40, 20, bodyAlpha);
    gfx.lineWidth = 2;
    gfx.moveTo(headX - 8, headY - 6);
    gfx.lineTo(headX - 2, headY - 4);
    gfx.stroke();
    gfx.moveTo(headX + 2, headY - 4);
    gfx.lineTo(headX + 8, headY - 6);
    gfx.stroke();

    // ── Legs ──────────────────────────────────────────────
    gfx.fillColor = new Color(50, 50, 80, bodyAlpha);
    if (this.diveDir !== 0) {
      // Dive pose: one leg extended
      gfx.rect(bodyX - 10, bodyY, 10, 20);
      gfx.fill();
      gfx.rect(bodyX + 2, bodyY, 10, 14);
      gfx.fill();
    } else {
      gfx.rect(bodyX - 12, bodyY, 10, 22);
      gfx.fill();
      gfx.rect(bodyX + 2, bodyY, 10, 22);
      gfx.fill();
    }

    // ── Shield (orbiting golden disc) ─────────────────────
    if (this.hasShield && !this.flying) {
      const sx = kx + Math.cos(this.shieldAngle) * 34;
      const sy = ky + Math.sin(this.shieldAngle) * 14;

      // Glow
      gfx.fillColor = new Color(255, 215, 0, 60);
      gfx.circle(sx, sy, 22);
      gfx.fill();

      // Main shield
      gfx.fillColor = new Color(241, 196, 15, bodyAlpha);
      // Draw 5-pointed star shape
      const pts = 5;
      const outerR = 16, innerR = 8;
      for (let i = 0; i < pts * 2; i++) {
        const angle = (i * Math.PI) / pts - Math.PI / 2;
        const rad   = i % 2 === 0 ? outerR : innerR;
        const px    = sx + Math.cos(angle) * rad;
        const py    = sy + Math.sin(angle) * rad;
        if (i === 0) gfx.moveTo(px, py);
        else         gfx.lineTo(px, py);
      }
      gfx.fill();

      // Shield border
      gfx.strokeColor = new Color(211, 84, 0, bodyAlpha);
      gfx.lineWidth = 2;
      gfx.circle(sx, sy, 16);
      gfx.stroke();
    }
  }
}
