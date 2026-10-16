import { Color, Graphics } from 'cc';
import { ShockwaveData } from '../Config';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const clean = hex.replace('#', '');
    return {
        r: parseInt(clean.substring(0, 2), 16),
        g: parseInt(clean.substring(2, 4), 16),
        b: parseInt(clean.substring(4, 6), 16),
    };
}

export class ShockWavePool {
    private pool: ShockwaveData[] = [];

    clear(): void {
        this.pool = [];
    }

    spawn(x: number, y: number, isSuper: boolean): void {
        if (isSuper) {
            this.pool.push({ x, y, r: 15, maxR: 100, alpha: 1.0, color: '#ff6b35', lineWidth: 6 });
        } else {
            this.pool.push({ x, y, r: 8, maxR: 55, alpha: 0.8, color: '#ffffff', lineWidth: 3 });
        }
    }

    spawnTNT(x: number, y: number): void {
        // Three rings with different sizes for layered TNT explosion effect
        this.pool.push({ x, y, r: 10, maxR: 130, alpha: 1.0, color: '#ff6600', lineWidth: 7 });
        this.pool.push({ x, y, r: 5,  maxR: 100, alpha: 0.8, color: '#ffaa00', lineWidth: 4 });
        this.pool.push({ x, y, r: 2,  maxR: 70,  alpha: 0.6, color: '#ffdd00', lineWidth: 2.5 });
    }

    spawnComboRing(x: number, y: number, combo: number): void {
        // Golden multi-ring for big combos
        const intensity = Math.min(combo / 10, 1);
        const maxRadius = 60 + intensity * 80;
        this.pool.push({ x, y, r: 10, maxR: maxRadius, alpha: 0.9, color: '#ffd700', lineWidth: 5 });
        if (combo >= 5) {
            this.pool.push({ x, y, r: 5, maxR: maxRadius * 0.7, alpha: 0.6, color: '#ffffff', lineWidth: 2.5 });
        }
    }

    update(): void {
        for (let i = this.pool.length - 1; i >= 0; i--) {
            const wave = this.pool[i];
            wave.r += (wave.maxR - wave.r) * 0.22;
            wave.alpha -= 0.055;
            if (wave.alpha <= 0) {
                this.pool.splice(i, 1);
            }
        }
    }

    draw(gfx: Graphics): void {
        for (const wave of this.pool) {
            if (wave.alpha <= 0 || wave.r <= 0) continue;
            const { r, g, b } = hexToRgb(wave.color);
            const alphaInt = Math.floor(Math.max(0, Math.min(1, wave.alpha)) * 255);
            gfx.strokeColor = new Color(r, g, b, alphaInt);
            gfx.lineWidth = wave.lineWidth;
            gfx.circle(wave.x, wave.y, wave.r);
            gfx.stroke();
        }
    }
}

export const shockWavePool = new ShockWavePool();
