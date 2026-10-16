/**
 * BrickEntity.ts — 砖块数据、网格生成、渲染
 */
import { Color, Graphics } from 'cc';
import { BrickData, CONFIG } from '../Config';

// ── 颜色解析工具 ────────────────────────────────────────────
function hexToRgb(hex?: string): { r: number; g: number; b: number } {
  let h = (hex || '#c0392b').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return {
    r: parseInt(h.substring(0, 2), 16) || 0,
    g: parseInt(h.substring(2, 4), 16) || 0,
    b: parseInt(h.substring(4, 6), 16) || 0,
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

// ── 渲染单个少林符文玄石碑 ──────────────────────────────────────────
export function drawBrick(gfx: Graphics, b: BrickData): void {
  const x  = b.x + b.shakeX;
  const y  = b.y;
  const w  = b.w;
  const h  = b.h;

  const alpha = b.crackLevel >= 3 ? 190 : 255;

  // Hit flash override (白金破击光华)
  if (b.hitFlash > 0) {
    gfx.fillColor = new Color(255, 250, 220, alpha);
    gfx.rect(x, y, w, h);
    gfx.fill();
    return;
  }

  // 1. Base Slate Stone Fill (水墨玄青古石基底)
  const c = hexToRgb(b.color);
  // Blend with dark ink slate for rich texture
  const stoneR = Math.round(c.r * 0.45 + 16);
  const stoneG = Math.round(c.g * 0.45 + 22);
  const stoneB = Math.round(c.b * 0.45 + 32);
  gfx.fillColor = new Color(stoneR, stoneG, stoneB, alpha);
  gfx.rect(x, y, w, h);
  gfx.fill();

  // 2. Inner Ink Carving Box (内凹石刻凹槽)
  gfx.fillColor = new Color(Math.round(stoneR * 1.25), Math.round(stoneG * 1.25), Math.round(stoneB * 1.25), alpha);
  gfx.rect(x + 2, y + 2, w - 4, h - 4);
  gfx.fill();

  // 3. Specialized Type Aesthetics
  if (b.type === 'metal') {
    // ── 少林金钟罩·罗汉铁壁 ──
    // Metallic sheen band
    gfx.fillColor = new Color(220, 225, 235, 45);
    gfx.rect(x + 3, y + 3, w * 0.35, h - 6);
    gfx.fill();

    // 4 Golden Corner Rivets (四角罗汉金钉)
    const rivetColor = new Color(255, 200, 50, 220);
    gfx.fillColor = rivetColor;
    gfx.circle(x + 4, y + 4, 1.8); gfx.fill();
    gfx.circle(x + w - 4, y + 4, 1.8); gfx.fill();
    gfx.circle(x + 4, y + h - 5, 1.8); gfx.fill();
    gfx.circle(x + w - 4, y + h - 5, 1.8); gfx.fill();

    // Ancient Seal Rune: 【罡】(Shaolin Vajra Armor)
    const cx = x + w / 2;
    const cy = y + h / 2 - 1;
    gfx.strokeColor = new Color(255, 215, 0, 160);
    gfx.lineWidth = 1.2;
    // Outer rune box
    gfx.rect(cx - 7, cy - 6, 14, 12);
    gfx.stroke();
    // Inner cross lines
    gfx.moveTo(cx - 4, cy); gfx.lineTo(cx + 4, cy); gfx.stroke();
    gfx.moveTo(cx, cy - 4); gfx.lineTo(cx, cy + 4); gfx.stroke();
  } else if (b.type === 'tnt') {
    // ── 烈火霹雳·雷火神碑 ──
    // Inner glowing crimson seal box
    gfx.fillColor = new Color(185, 28, 28, 160);
    gfx.rect(x + 3, y + 3, w - 6, h - 6);
    gfx.fill();

    // Fuse flame spark at top center
    gfx.fillColor = new Color(255, 220, 50, 240);
    gfx.circle(x + w / 2, y + 3, 2.8);
    gfx.fill();
    gfx.fillColor = new Color(255, 70, 0, 180);
    gfx.circle(x + w / 2, y + 3, 4.5);
    gfx.fill();

    // Ancient Thunder Rune: 【雷】
    const cx = x + w / 2;
    const cy = y + h / 2 - 1;
    gfx.strokeColor = new Color(255, 240, 100, 220);
    gfx.lineWidth = 1.4;
    gfx.moveTo(cx - 6, cy - 4); gfx.lineTo(cx + 6, cy - 4); gfx.stroke();
    gfx.moveTo(cx, cy - 4);     gfx.lineTo(cx - 3, cy + 1); gfx.lineTo(cx + 4, cy + 1); gfx.lineTo(cx - 1, cy + 6); gfx.stroke();
  } else {
    // ── 普通符文玄石碑：刻印【封】/【玄】古篆印痕 ──
    const cx = x + w / 2;
    const cy = y + h / 2 - 1;
    const runeColor = (b.row + b.col) % 2 === 0
      ? new Color(0, 220, 255, 110)
      : new Color(255, 190, 50, 110);
    gfx.strokeColor = runeColor;
    gfx.lineWidth = 1.0;
    // Ancient seal emblem
    gfx.circle(cx, cy, 5.5);
    gfx.stroke();
    gfx.moveTo(cx - 3, cy); gfx.lineTo(cx + 3, cy); gfx.stroke();
  }

  // 4. 3D Ancient Stone Bevel Edges (石碑风化阴阳切角)
  gfx.strokeColor = new Color(255, 255, 255, 50);
  gfx.lineWidth = 1.2;
  gfx.moveTo(x, y + h); gfx.lineTo(x, y); gfx.lineTo(x + w, y);
  gfx.stroke();

  gfx.strokeColor = new Color(0, 0, 0, 95);
  gfx.lineWidth = 1.2;
  gfx.moveTo(x + w, y); gfx.lineTo(x + w, y + h); gfx.lineTo(x, y + h);
  gfx.stroke();

  // 5. Glowing Runic Energy Fracture Cracks (符文裂痕迸发流光)
  if (b.crackLevel > 0) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const crackGlow = b.type === 'tnt'
      ? new Color(255, 60, 20, 200)
      : (b.type === 'metal' ? new Color(255, 215, 0, 190) : new Color(0, 229, 255, 180));

    // Outer dark fissure
    gfx.strokeColor = new Color(10, 12, 18, 220);
    gfx.lineWidth = b.crackLevel >= 2 ? 2.5 : 1.8;
    gfx.moveTo(cx - 3, y + 2); gfx.lineTo(cx + 5, cy); gfx.lineTo(cx - 2, y + h - 3);
    gfx.stroke();

    // Inner glowing energy fracture
    gfx.strokeColor = crackGlow;
    gfx.lineWidth = 1.2;
    gfx.moveTo(cx - 3, y + 2); gfx.lineTo(cx + 5, cy); gfx.lineTo(cx - 2, y + h - 3);
    gfx.stroke();

    if (b.crackLevel >= 2) {
      gfx.strokeColor = new Color(10, 12, 18, 220);
      gfx.lineWidth = 2.2;
      gfx.moveTo(x + 4, cy - 4); gfx.lineTo(cx + 3, cy + 6); gfx.lineTo(x + w - 4, cy + 2);
      gfx.stroke();

      gfx.strokeColor = crackGlow;
      gfx.lineWidth = 1.2;
      gfx.moveTo(x + 4, cy - 4); gfx.lineTo(cx + 3, cy + 6); gfx.lineTo(x + w - 4, cy + 2);
      gfx.stroke();
    }

    if (b.crackLevel >= 3) {
      gfx.strokeColor = crackGlow;
      gfx.lineWidth = 1.4;
      gfx.moveTo(x + 2, y + 4); gfx.lineTo(cx - 4, cy + 3); gfx.lineTo(x + 6, y + h - 2);
      gfx.stroke();
      gfx.moveTo(x + w - 5, y + 5); gfx.lineTo(cx + 2, cy - 3);
      gfx.stroke();
    }
  }

  // 6. Modern Sleek HP Bar (底部竹墨生命槽)
  const hpRatio = Math.max(0, b.hp / b.maxHp);
  gfx.fillColor = new Color(10, 15, 22, 160);
  gfx.rect(x, y + h - 3, w, 3);
  gfx.fill();

  const barColor = hpRatio > 0.5 ? new Color(46, 213, 115, 220) :
                   hpRatio > 0.25 ? new Color(255, 165, 2, 220) :
                   new Color(255, 56, 56, 220);
  gfx.fillColor = barColor;
  gfx.rect(x, y + h - 3, w * hpRatio, 3);
  gfx.fill();
}
