import { Color, Graphics } from 'cc';
import { ParticleData, CONFIG } from '../Config';

function hexToColor(hex: string, alpha: number): Color {
  let clean = hex.replace('#', '').trim();
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
  private readonly MAX = 200;

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

  draw(gfx: Graphics): void {
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
      } else if (p.type === 'debris') {
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
