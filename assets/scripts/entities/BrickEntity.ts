/**
 * BrickEntity.ts — 砖块数据、网格生成、渲染
 */
import { Color, Graphics } from 'cc';
import { BrickData, CONFIG } from '../Config';

// ── 颜色解析工具 ────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

// ── 砖块颜色对 ──────────────────────────────────────────────
const NORMAL_COLORS = [
  ['#c0392b', '#922b21'],
  ['#8e44ad', '#6c3483'],
  ['#2471a3', '#1a5276'],
  ['#117a65', '#0e6655'],
];

// ── 创建关卡砖块网格 ─────────────────────────────────────────
export function createBrickGrid(stage: number, _W: number): BrickData[] {
  const rows     = Math.min(8, 5 + Math.floor((stage - 1) / 2));
  const cols     = 7;
  const wallW    = 380;
  const wallH    = Math.min(160, 115 + rows * 7); // 高度适中整洁：150-160px
  const bw       = wallW / cols;
  const bh       = wallH / rows;
  const startX   = -wallW / 2;
  const wallTop  = CONFIG.WALL_TOP;  // 290 in Cocos Y-up
  const startY   = wallTop - wallH;  // 砖墙底部约 130 左右，大幅拉开与人物的垂直缓冲距离

  const tntRate   = Math.min(0.22, 0.06 + stage * 0.025);
  const metalRate = Math.min(0.30, 0.08 + stage * 0.030);
  const normalHp  = 80  + stage * 25;
  const metalHp   = 250 + stage * 60;
  const tntHp     = 40;

  const colorPair = NORMAL_COLORS[(stage - 1) % NORMAL_COLORS.length];
  const bricks: BrickData[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rand = Math.random();
      let type: 'normal' | 'metal' | 'tnt' = 'normal';
      let hp   = normalHp;
      let color = (r + c) % 2 === 0 ? colorPair[0] : colorPair[1];

      if (rand < tntRate) {
        type = 'tnt';  hp = tntHp;   color = '#e67e22';
      } else if (rand < tntRate + metalRate) {
        type = 'metal'; hp = metalHp; color = '#7f8c8d';
      }

      bricks.push({
        col: c, row: r,
        x: startX + c * bw,
        y: startY + r * bh,
        targetY: startY + r * bh,
        vy: 0,
        w: bw - 2,
        h: bh - 2,
        type, hp, maxHp: hp,
        color,
        hitFlash: 0, shakeX: 0, crackLevel: 0,
      });
    }
  }
  return bricks;
}

// ── 更新裂缝等级 ─────────────────────────────────────────────
export function updateBrickCracks(b: BrickData): void {
  const ratio = b.hp / b.maxHp;
  if      (ratio <= 0.0)  b.crackLevel = 4;
  else if (ratio <= 0.25) b.crackLevel = 3;
  else if (ratio <= 0.50) b.crackLevel = 2;
  else if (ratio <= 0.75) b.crackLevel = 1;
  else                    b.crackLevel = 0;
}

// ── 砖块掉落重排 ─────────────────────────────────────────────
export function applyWallGravity(bricks: BrickData[], _wallTop: number, wallBottom: number): void {
  for (let c = 0; c < 7; c++) {
    const col = bricks.filter(b => b.col === c).sort((a, b) => a.y - b.y);
    col.forEach((b, idx) => {
      const targetY = wallBottom + idx * (b.h + 2);
      if (Math.abs(b.y - targetY) > 0.5) {
        b.targetY = targetY;
        b.vy = 0;
      }
    });
  }
}

// ── 渲染单个砖块 ─────────────────────────────────────────────
export function drawBrick(gfx: Graphics, b: BrickData): void {
  const x  = b.x + b.shakeX;
  const y  = b.y;
  const w  = b.w;
  const h  = b.h;

  const alpha = b.crackLevel >= 3 ? 180 : 255;

  // Hit flash override
  if (b.hitFlash > 0) {
    gfx.fillColor = new Color(255, 255, 255, alpha);
    gfx.rect(x, y, w, h);
    gfx.fill();
  } else {
    // Base fill
    const c = hexToRgb(b.color);
    gfx.fillColor = new Color(c.r, c.g, c.b, alpha);
    gfx.rect(x, y, w, h);
    gfx.fill();

    // Metal shimmer effect
    if (b.type === 'metal') {
      gfx.fillColor = new Color(200, 200, 210, 60);
      gfx.rect(x + 1, y + 1, w * 0.4, h - 2);
      gfx.fill();
      gfx.fillColor = new Color(255, 255, 255, 30);
      gfx.rect(x + 1, y + 1, w - 2, 3);
      gfx.fill();
    }
  }

  // 3D Bevel — top-left light edges
  gfx.strokeColor = new Color(255, 255, 255, 60);
  gfx.lineWidth = 1.5;
  gfx.moveTo(x, y + h);
  gfx.lineTo(x, y);
  gfx.lineTo(x + w, y);
  gfx.stroke();

  // Bottom-right dark edges
  gfx.strokeColor = new Color(0, 0, 0, 70);
  gfx.lineWidth = 1.5;
  gfx.moveTo(x + w, y);
  gfx.lineTo(x + w, y + h);
  gfx.lineTo(x, y + h);
  gfx.stroke();

  // TNT label
  if (b.type === 'tnt' && b.hitFlash <= 0) {
    // Draw fuse spark dot
    gfx.fillColor = new Color(255, 220, 0, 220);
    gfx.circle(x + w / 2, y + 4, 3);
    gfx.fill();
    // Inner red box
    gfx.fillColor = new Color(180, 40, 20, 200);
    gfx.rect(x + 4, y + 8, w - 8, h - 14);
    gfx.fill();
  }

  // Crack lines
  if (b.crackLevel > 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const ca = b.crackLevel >= 3 ? 200 : b.crackLevel >= 2 ? 150 : 100;
    gfx.strokeColor = new Color(20, 10, 10, ca);
    gfx.lineWidth = b.crackLevel >= 2 ? 2 : 1;

    // Crack pattern 1
    gfx.moveTo(cx - 3, y + 2);
    gfx.lineTo(cx + 5, cy);
    gfx.lineTo(cx - 2, y + h - 3);
    gfx.stroke();

    if (b.crackLevel >= 2) {
      gfx.moveTo(x + 4, cy - 4);
      gfx.lineTo(cx + 3, cy + 6);
      gfx.lineTo(x + w - 4, cy + 2);
      gfx.stroke();
    }

    if (b.crackLevel >= 3) {
      gfx.moveTo(x + 2, y + 4);
      gfx.lineTo(cx - 4, cy + 3);
      gfx.lineTo(x + 6, y + h - 2);
      gfx.stroke();
      gfx.moveTo(x + w - 5, y + 5);
      gfx.lineTo(cx + 2, cy - 3);
      gfx.stroke();
    }
  }

  // HP bar (3px at bottom of brick)
  const hpRatio = Math.max(0, b.hp / b.maxHp);
  gfx.fillColor = new Color(0, 0, 0, 120);
  gfx.rect(x, y + h - 3, w, 3);
  gfx.fill();
  const barColor = hpRatio > 0.5 ? new Color(46, 213, 115, 200) :
                   hpRatio > 0.25 ? new Color(255, 165, 2, 200) :
                   new Color(255, 50, 50, 200);
  gfx.fillColor = barColor;
  gfx.rect(x, y + h - 3, w * hpRatio, 3);
  gfx.fill();
}
