import { Color, Graphics } from 'cc';
import { ParticleData, BrickData, CONFIG } from '../Config';

function hexToColor(hex: string, alpha: number): Color {
  let clean = (hex || '#c0392b').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(255, Math.floor(alpha)));
  return new Color(r, g, b, a);
}

export class ParticlePool {
  private pool: ParticleData[] = [];
  private readonly MAX = 350;

  clear(): void {
    this.pool = [];
  }

  private spawn(p: ParticleData): void {
    if (this.pool.length < this.MAX) {
      this.pool.push(p);
    } else {
      this.pool.shift();
      this.pool.push(p);
    }
  }

  spawnSpark(x: number, y: number, count = 8, color = '#ff6b35'): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      const r = 2 + Math.random() * 3;
      const life = 20 + Math.random() * 15;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r,
        life,
        maxLife: life,
        color,
        type: 'spark',
        rot: 0,
        vRot: 0,
        w: 0,
        h: 0,
      });
    }
  }

  spawnInkSplatter(x: number, y: number, count = 10): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 7.5;
      const r = 2.0 + Math.random() * 3.2;
      const life = 24 + Math.random() * 18;
      const isRedEmber = Math.random() < 0.22;
      const color = isRedEmber ? '#e74c3c' : (i % 2 === 0 ? '#0f172a' : '#1e293b');
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r,
        life,
        maxLife: life,
        color,
        type: 'inkDrop',
        rot: angle,
        vRot: 0,
        w: r * 2.4,
        h: r,
      });
    }
  }

  spawnSmoke(x: number, y: number, count = 4): void {
    for (let i = 0; i < count; i++) {
      const vx = (Math.random() - 0.5) * 1;
      const vy = 0.5 + Math.random() * 1.0;
      const r = 8 + Math.random() * 7;
      const life = 40 + Math.random() * 20;
      this.spawn({
        x,
        y,
        vx,
        vy,
        r,
        life,
        maxLife: life,
        color: '#888888',
        type: 'smoke',
        rot: 0,
        vRot: 0,
        w: 0,
        h: 0,
      });
    }
  }

  spawnDebris(x: number, y: number, count: number, color: string, w: number, h: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      const pw = w * 0.3 + Math.random() * w * 0.7;
      const ph = h * 0.3 + Math.random() * h * 0.7;
      const rot = Math.random() * Math.PI * 2;
      const vRot = (Math.random() - 0.5) * 0.35;
      const life = 50 + Math.random() * 30;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 0,
        life,
        maxLife: life,
        color,
        type: 'debris',
        rot,
        vRot,
        w: pw,
        h: ph,
      });
    }
  }

  /**
   * 🌟 真实多边形水墨玄石爆碎系统 (Multi-Polygon Voronoi Stone Shards)
   * 将砖块真实剖解为 4~6 块带有古篆残纹的多边形立体碎石，伴随水墨墨汁飞溅！
   */
  spawnBrickShatter(brick: BrickData, impactVx: number = 0, impactVy: number = 0): void {
    const bx = brick.x;
    const by = brick.y;
    const w = brick.w;
    const h = brick.h;
    const cx = bx + w / 2;
    const cy = by + h / 2;

    // 1. 生成 5 块特征明确的多边形碎石 (Corner & Core Fragments)
    const shardsDef = [
      // 碎块 1: 左上角尖锐三角断片
      {
        poly: [
          { x: -w * 0.45, y: -h * 0.45 },
          { x: 0, y: -h * 0.45 },
          { x: -w * 0.45, y: h * 0.2 },
        ],
        offsetX: -w * 0.25,
        offsetY: -h * 0.25,
        rune: '',
      },
      // 碎块 2: 右上角四边形断片
      {
        poly: [
          { x: 0, y: -h * 0.45 },
          { x: w * 0.45, y: -h * 0.45 },
          { x: w * 0.45, y: 0 },
          { x: -w * 0.1, y: -h * 0.1 },
        ],
        offsetX: w * 0.25,
        offsetY: -h * 0.25,
        rune: '',
      },
      // 碎块 3: 中央核心符文断片 (Core Rune Talisman)
      {
        poly: [
          { x: -w * 0.2, y: -h * 0.2 },
          { x: w * 0.2, y: -h * 0.2 },
          { x: w * 0.25, y: h * 0.25 },
          { x: -w * 0.25, y: h * 0.2 },
        ],
        offsetX: 0,
        offsetY: 0,
        rune: brick.type === 'metal' ? '罡' : (brick.type === 'tnt' ? '雷' : '封'),
      },
      // 碎块 4: 左下角切角断片
      {
        poly: [
          { x: -w * 0.45, y: 0 },
          { x: -w * 0.1, y: h * 0.1 },
          { x: 0, y: h * 0.45 },
          { x: -w * 0.45, y: h * 0.45 },
        ],
        offsetX: -w * 0.25,
        offsetY: h * 0.25,
        rune: '',
      },
      // 碎块 5: 右下角厚实断片
      {
        poly: [
          { x: 0, y: 0 },
          { x: w * 0.45, y: 0 },
          { x: w * 0.45, y: h * 0.45 },
          { x: 0, y: h * 0.45 },
        ],
        offsetX: w * 0.25,
        offsetY: h * 0.25,
        rune: '',
      },
    ];

    for (let i = 0; i < shardsDef.length; i++) {
      const def = shardsDef[i];
      const shardX = cx + def.offsetX;
      const shardY = cy + def.offsetY;

      // 径向爆发速度 + 来球动量传递
      const outAngle = Math.atan2(shardY - cy, shardX - cx) + (Math.random() - 0.5) * 0.4;
      const speed = 3.5 + Math.random() * 6.5;
      const vx = Math.cos(outAngle) * speed + impactVx * 0.24;
      const vy = Math.sin(outAngle) * speed + impactVy * 0.24 + 1.8; // 向上抛出弧线

      const life = 55 + Math.floor(Math.random() * 30);

      this.spawn({
        x: shardX,
        y: shardY,
        vx,
        vy,
        r: 0,
        life,
        maxLife: life,
        color: brick.color || '#c0392b',
        type: 'stoneShard',
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.45,
        w: w * 0.5,
        h: h * 0.5,
        polygon: def.poly,
        runeChar: def.rune,
        bounces: 0,
        brickType: brick.type,
      });
    }

    // 2. 溅射 10~14 滴高烈度大写意水墨飞沫 (Calligraphy Ink Splashes)
    this.spawnInkSplatter(cx, cy, 12);

    // 3. 针对不同砖块类型的特殊粒子反馈
    if (brick.type === 'tnt') {
      this.spawnSpark(cx, cy, 16, '#ff4500');
      this.spawnSpark(cx, cy, 10, '#ffd700');
      this.spawnSmoke(cx, cy, 6);
    } else if (brick.type === 'metal') {
      this.spawnSpark(cx, cy, 18, '#ffd700');
      // 4 枚金钉四散飞溅
      for (let k = 0; k < 4; k++) {
        const rivetA = (k / 4) * Math.PI * 2;
        this.spawn({
          x: cx,
          y: cy,
          vx: Math.cos(rivetA) * 7,
          vy: Math.sin(rivetA) * 7 + 2,
          r: 2.2,
          life: 45,
          maxLife: 45,
          color: '#f59e0b',
          type: 'spark',
          rot: 0,
          vRot: 0.3,
          w: 0,
          h: 0,
        });
      }
    } else {
      // 普通砖块：青碧灵气微尘
      this.spawnSpark(cx, cy, 8, '#00e5ff');
    }
  }

  spawnFireTrail(x: number, y: number, vx: number, vy: number): void {
    for (let i = 0; i < 2; i++) {
      const px = x - vx * 0.3 + (Math.random() - 0.5) * 3;
      const py = y - vy * 0.3 + (Math.random() - 0.5) * 3;
      const r = 4 + Math.random() * 4;
      const life = 8 + Math.random() * 4;
      this.spawn({
        x: px,
        y: py,
        vx: -vx * 0.15 + (Math.random() - 0.5) * 1.5,
        vy: -vy * 0.15 + (Math.random() - 0.5) * 1.5,
        r,
        life,
        maxLife: life,
        color: '#ff4500',
        type: 'spark',
        rot: 0,
        vRot: 0,
        w: 0,
        h: 0,
      });
    }
  }

  spawnGoldExplosion(x: number, y: number, count = 20): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 10;
      const color = i % 2 === 0 ? '#ffd700' : '#ffaa00';
      const r = 3 + Math.random() * 4;
      const life = 30 + Math.random() * 15;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r,
        life,
        maxLife: life,
        color,
        type: 'spark',
        rot: 0,
        vRot: 0,
        w: 0,
        h: 0,
      });
    }
  }

  update(): void {
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.type === 'spark' || p.type === 'debris') {
        p.vy -= CONFIG.GRAVITY * 0.6;
      } else if (p.type === 'stoneShard') {
        // 碎石受重力加速下坠与空气微弱阻力
        p.vy -= CONFIG.GRAVITY * 0.78;
        p.vx *= 0.985;

        // 草地弹性碰撞反弹
        if (p.y <= CONFIG.GROUND_Y && p.vy < 0) {
          const bounces = p.bounces || 0;
          if (bounces < 3) {
            p.vy = -p.vy * 0.44;
            p.vx *= 0.68;
            p.y = CONFIG.GROUND_Y;
            p.bounces = bounces + 1;
            p.vRot *= -0.5; // 反弹变相自转
          } else {
            p.vy = 0;
            p.vx *= 0.5;
            p.y = CONFIG.GROUND_Y;
            p.vRot = 0;
          }
        }
      } else if (p.type === 'inkDrop') {
        p.vy -= CONFIG.GRAVITY * 0.42;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      if (p.type === 'debris') {
        if (p.y <= CONFIG.GROUND_Y && p.vy < 0) {
          p.vy *= -0.4;
          p.vx *= 0.75;
          p.y = CONFIG.GROUND_Y;
        }
      }

      p.rot += p.vRot;
      p.life--;

      if (p.life <= 0) {
        this.pool.splice(i, 1);
      }
    }
  }

  /**
   * 绘制系统：优先采用 2D Canvas 高清滤镜发光渲染多边形玄石与水墨，并提供 Graphics 矢量降级
   */
  draw(gfx: Graphics, ctx?: CanvasRenderingContext2D | null): void {
    if (ctx) {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const scale = Math.min(cw / 440, ch / 780);

      ctx.save();
      for (let i = 0; i < this.pool.length; i++) {
        const p = this.pool[i];
        const alpha = Math.max(0, p.life / p.maxLife);
        const cx = cw / 2 + p.x * scale;
        const cy = ch / 2 - p.y * scale;

        if (p.type === 'stoneShard' && p.polygon) {
          // ── 高清立体多边形玄石碎片 ──
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(p.rot);
          ctx.globalAlpha = alpha;

          // 1. 基底石质
          ctx.fillStyle = p.brickType === 'metal' ? '#475569' : (p.brickType === 'tnt' ? '#991B1B' : '#1E293B');
          ctx.strokeStyle = p.brickType === 'metal' ? '#F59E0B' : (p.brickType === 'tnt' ? '#F97316' : '#64748B');
          ctx.lineWidth = 1.2 * scale;

          ctx.beginPath();
          const pts = p.polygon;
          for (let k = 0; k < pts.length; k++) {
            const px = pts[k].x * scale;
            const py = pts[k].y * scale;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 2. 内部阴影切角
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          if (pts.length >= 3) {
            ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
            ctx.lineTo(pts[1].x * scale, pts[1].y * scale);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
          }

          // 3. 核心符文残印【罡】/【雷】/【封】
          if (p.runeChar) {
            ctx.fillStyle = p.brickType === 'metal' ? '#FCD34D' : (p.brickType === 'tnt' ? '#FEF08A' : '#38BDF8');
            ctx.font = `900 ${Math.round(8 * scale)}px "SimHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.runeChar, 0, 0);
          }

          ctx.restore();
        } else if (p.type === 'inkDrop') {
          // ── 大写意拉长水墨水滴 ──
          ctx.save();
          ctx.translate(cx, cy);
          ctx.globalAlpha = alpha * 0.85;
          ctx.fillStyle = p.color;

          const speed = Math.hypot(p.vx, p.vy);
          const dropAngle = Math.atan2(-p.vy, p.vx); // 注意 Y 轴方向
          ctx.rotate(dropAngle);

          // 水滴长椭圆
          const dropLen = Math.max(3, p.r * (1 + speed * 0.3)) * scale;
          const dropW = p.r * scale;

          ctx.beginPath();
          ctx.ellipse(0, 0, dropLen, dropW, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // Graphics 矢量管线 (负责 sparks, smoke, 基础 debris 降级)
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      const alpha = Math.floor((p.life / p.maxLife) * 255);

      if (p.type === 'spark') {
        gfx.fillColor = hexToColor(p.color, alpha);
        gfx.circle(p.x, p.y, p.r);
        gfx.fill();
      } else if (p.type === 'smoke') {
        gfx.fillColor = new Color(136, 136, 136, Math.floor(alpha * 0.5));
        const currentR = p.r * (1 + (1 - p.life / p.maxLife) * 0.5);
        gfx.circle(p.x, p.y, currentR);
        gfx.fill();
      } else if (p.type === 'debris' || (!ctx && p.type === 'stoneShard')) {
        gfx.fillColor = hexToColor(p.color, alpha);
        const cos = Math.cos(p.rot);
        const sin = Math.sin(p.rot);
        const hw = p.w * 0.5;
        const hh = p.h * 0.5;

        const x0 = p.x + (-hw * cos - -hh * sin);
        const y0 = p.y + (-hw * sin + -hh * cos);
        const x1 = p.x + (hw * cos - -hh * sin);
        const y1 = p.y + (hw * sin + -hh * cos);
        const x2 = p.x + (hw * cos - hh * sin);
        const y2 = p.y + (hw * sin + hh * cos);
        const x3 = p.x + (-hw * cos - hh * sin);
        const y3 = p.y + (-hw * sin + hh * cos);

        gfx.moveTo(x0, y0);
        gfx.lineTo(x1, y1);
        gfx.lineTo(x2, y2);
        gfx.lineTo(x3, y3);
        gfx.close();
        gfx.fill();
      }
    }
  }
}

export const particlePool = new ParticlePool();
