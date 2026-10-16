import { Graphics } from 'cc';
import { FloatTextData } from '../Config';

export class FloatTextPool {
    private pool: FloatTextData[] = [];

    clear(): void {
        this.pool = [];
    }

    spawn(x: number, y: number, text: string, color: string, size: number, vy = -2.2): void {
        this.pool.push({ x, y, text, color, size, alpha: 1.0, vy, life: 45 });
    }

    spawnDamage(x: number, y: number, dmg: number, isSuper: boolean): void {
        if (isSuper) {
            this.spawn(x, y, `【破】-${dmg}`, '#ff3838', 21, -2.8);
        } else {
            this.spawn(x, y, `-${dmg}`, '#ffffff', 14);
        }
    }

    spawnCombo(x: number, y: number, combo: number): void {
        const size = Math.min(28, 15 + combo * 0.5);
        this.spawn(x, y, `【連】${combo}x连击!`, '#ffd700', size, -2.8);
    }

    spawnStageText(x: number, y: number, stage: number): void {
        this.spawn(x, y, `【少林】第 ${stage} 重天`, '#00eeff', 24, -1.5);
    }

    spawnMessage(x: number, y: number, msg: string): void {
        this.spawn(x, y, msg, '#aaffaa', 18, -1.2);
    }

    update(): void {
        for (let i = this.pool.length - 1; i >= 0; i--) {
            const item = this.pool[i];
            item.y += item.vy;
            item.alpha -= 1 / 45;
            item.life--;
            if (item.life <= 0) {
                this.pool.splice(i, 1);
            }
        }
    }

    /**
     * Draw floating texts with calligraphy martial seal stamps using raw canvas 2D context.
     * Cocos Y-up to canvas Y-down: canvasY = canvasHeight/2 - cocosY
     */
    draw(_gfx: Graphics, ctx: CanvasRenderingContext2D): void {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const scale = Math.min(cw / 440, ch / 780);

        for (const item of this.pool) {
            const a = Math.max(0, Math.min(1, item.alpha));
            if (a <= 0) continue;
            const cx = cw / 2 + item.x * scale;
            const cy = ch / 2 - item.y * scale;

            ctx.save();
            ctx.globalAlpha = a;
            const fontSize = Math.max(10, Math.round(item.size * scale));
            ctx.font = `900 ${fontSize}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Check if text has martial seal stamp format like 【破】 or 【連】
            const sealMatch = item.text.match(/^【(.*?)】(.*)$/);
            if (sealMatch) {
                const sealChar = sealMatch[1];
                const restText = sealMatch[2];

                // Measure widths for tight seal box alignment
                const sealW = ctx.measureText(`【${sealChar}】`).width;
                const restW = ctx.measureText(restText).width;
                const totalW = sealW + restW;
                const startX = cx - totalW / 2;

                const sealBoxX = startX + sealW * 0.12;
                const sealBoxY = cy - fontSize * 0.55;
                const sealBoxW = sealW * 0.76;
                const sealBoxH = fontSize * 1.1;

                // 1. Vermilion Calligraphy Seal Stamp Box (朱砂红印框)
                ctx.fillStyle = '#C0392B';
                ctx.shadowColor = '#E74C3C';
                ctx.beginPath();
                if (typeof (ctx as any).roundRect === 'function') {
                    (ctx as any).roundRect(sealBoxX, sealBoxY, sealBoxW, sealBoxH, 3 * scale);
                } else {
                    ctx.rect(sealBoxX, sealBoxY, sealBoxW, sealBoxH);
                }
                ctx.fill();

                ctx.strokeStyle = '#FADBD8';
                ctx.lineWidth = 1.2 * scale;
                ctx.stroke();

                // 2. White Seal Character inside stamp box
                ctx.fillStyle = '#FFFFFF';
                ctx.shadowBlur = 0;
                ctx.fillText(sealChar, sealBoxX + sealBoxW / 2, cy);

                // 3. Rest of Text in item.color
                ctx.fillStyle = item.color;
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 6;
                ctx.fillText(restText, startX + sealW + restW / 2, cy);
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2;
                ctx.strokeText(restText, startX + sealW + restW / 2, cy);
            } else {
                ctx.fillStyle = item.color;
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.fillText(item.text, cx, cy);

                // Stroke outline for readability
                ctx.strokeStyle = 'rgba(0,0,0,0.7)';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 0;
                ctx.strokeText(item.text, cx, cy);
            }
            ctx.restore();
        }
    }
}

export const floatTextPool = new FloatTextPool();
