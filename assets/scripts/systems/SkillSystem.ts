import { Color, Graphics } from 'cc';
import { SKILL_ICONS_DATA } from './SkillAssets';

export interface SkillConfig {
    id: 'meteor' | 'barrage' | 'earthquake';
    name: string;
    fullName: string;
    subName: string;
    desc: string;
    keyHint: string;
    cd: number;           // 技能冷却时间 (秒)
    currentCd: number;    // 当前剩余冷却
    qiCost: number;       // 释放所需丹田真气消耗 (0~100)
    x: number;
    y: number;
    r: number;
    color: string;
    glowColor: string;
}

export interface SkillClickResult {
    clicked: boolean;
    triggered: boolean;
    id: 'meteor' | 'barrage' | 'earthquake' | null;
    x?: number;
    y?: number;
    reason?: 'cd' | 'qi';
    remaining?: number;
    cost?: number;
    currentQi?: number;
}

export class SkillSystem {
    // 🌟 少林丹田真气内劲系统 (Qi Energy System)
    public qi: number = 0;
    public readonly maxQi: number = 100;

    public skills: SkillConfig[] = [
        {
            id: 'meteor',
            name: '金刚腿',
            fullName: '大力金刚腿·天火陨石',
            subName: '天火陨石',
            desc: '烈焰巨龙陨石冲天破阵，秒杀门将，贯穿全线！',
            keyHint: '1',
            cd: 12,
            currentCd: 0,
            qiCost: 60,
            x: -120,
            y: -332,
            r: 29,
            color: '#FF4500',
            glowColor: '#FF6B35',
        },
        {
            id: 'barrage',
            name: '影分身',
            fullName: '万佛千刃·影分身',
            subName: '影分身',
            desc: '三重分身疾风雷电，16枚电球精准制导轰炸！',
            keyHint: '2',
            cd: 10,
            currentCd: 0,
            qiCost: 50,
            x: 0,
            y: -332,
            r: 29,
            color: '#00D2D3',
            glowColor: '#54A0FF',
        },
        {
            id: 'earthquake',
            name: '如来掌',
            fullName: '如来神掌·山崩地裂',
            subName: '如来神掌',
            desc: '神佛金掌从天而降，直接破灭下层砖墙KO门将！',
            keyHint: '3',
            cd: 15,
            currentCd: 0,
            qiCost: 100, // 需 100% 满真气方可施展终极必杀！
            x: 120,
            y: -332,
            r: 29,
            color: '#FFD700',
            glowColor: '#FFF275',
        },
    ];

    private _animTimer: number = 0;
    private _images: Record<string, HTMLImageElement> = {};

    constructor() {
        if (typeof Image !== 'undefined') {
            for (const [k, url] of Object.entries(SKILL_ICONS_DATA)) {
                const img = new Image();
                img.src = url;
                this._images[k] = img;
            }
        }
    }

    public addQi(amount: number): void {
        this.qi = Math.max(0, Math.min(this.maxQi, this.qi + amount));
    }

    public reset(initialQi: number = 0): void {
        this.qi = initialQi;
        for (const s of this.skills) {
            s.currentCd = 0;
        }
    }

    public update(dt: number): void {
        this._animTimer += dt;
        for (const s of this.skills) {
            if (s.currentCd > 0) {
                s.currentCd = Math.max(0, s.currentCd - dt);
            }
        }
    }

    /**
     * Hit test for skill icons:
     * 同时核验技能冷却 (Cooldown) 与丹田真气消耗 (Qi Cost)！
     */
    public checkClick(x: number, y: number): SkillClickResult {
        if (y <= -292 && y >= -390) {
            let target: SkillConfig | undefined;
            if (x < -55) {
                target = this.skills.find(s => s.id === 'meteor');
            } else if (x > 55) {
                target = this.skills.find(s => s.id === 'earthquake');
            } else {
                target = this.skills.find(s => s.id === 'barrage');
            }

            if (target) {
                if (target.currentCd > 0) {
                    return {
                        clicked: true,
                        triggered: false,
                        id: target.id,
                        x: target.x,
                        y: target.y,
                        reason: 'cd',
                        remaining: target.currentCd,
                    };
                }
                if (this.qi < target.qiCost) {
                    return {
                        clicked: true,
                        triggered: false,
                        id: target.id,
                        x: target.x,
                        y: target.y,
                        reason: 'qi',
                        cost: target.qiCost,
                        currentQi: this.qi,
                    };
                }
                return {
                    clicked: true,
                    triggered: true,
                    id: target.id,
                    x: target.x,
                    y: target.y,
                };
            }
        }

        // 按钮圆形扩展检测 (半径扩展 15px)
        for (const s of this.skills) {
            const dist = Math.hypot(x - s.x, y - s.y);
            if (dist <= s.r + 15) {
                if (s.currentCd > 0) {
                    return { clicked: true, triggered: false, id: s.id, x: s.x, y: s.y, reason: 'cd', remaining: s.currentCd };
                }
                if (this.qi < s.qiCost) {
                    return { clicked: true, triggered: false, id: s.id, x: s.x, y: s.y, reason: 'qi', cost: s.qiCost, currentQi: this.qi };
                }
                return { clicked: true, triggered: true, id: s.id, x: s.x, y: s.y };
            }
        }
        return { clicked: false, triggered: false, id: null };
    }

    /**
     * 扣除真气并启动冷却
     */
    public startCooldown(id: 'meteor' | 'barrage' | 'earthquake'): void {
        const s = this.skills.find(sk => sk.id === id);
        if (s) {
            this.qi = Math.max(0, this.qi - s.qiCost);
            s.currentCd = s.cd;
        }
    }

    /**
     * 快捷键判定：同时满足非冷却且真气充盈
     */
    public triggerById(id: 'meteor' | 'barrage' | 'earthquake'): boolean {
        const s = this.skills.find(sk => sk.id === id);
        if (s && s.currentCd <= 0 && this.qi >= s.qiCost) {
            return true;
        }
        return false;
    }

    public getSkill(id: 'meteor' | 'barrage' | 'earthquake'): SkillConfig | undefined {
        return this.skills.find(s => s.id === id);
    }

    /**
     * 绘制技能按钮与【少林丹田真气槽】
     */
    public draw(gfx: Graphics, ctx?: CanvasRenderingContext2D | null): void {
        const time = this._animTimer;

        if (ctx) {
            const cw = ctx.canvas.width;
            const ch = ctx.canvas.height;
            const scale = Math.min(cw / 440, ch / 780);

            // ── 0. 绘制【少林丹田真气槽】(Shaolin Dantian Qi Bar) ──
            this._drawQiBar(ctx, cw, ch, scale, time);

            // ── 1. 绘制三大必杀技图标 ──
            for (const s of this.skills) {
                const cx = cw / 2 + s.x * scale;
                const cy = ch / 2 - s.y * scale;
                const hasCooldown = s.currentCd > 0;
                const hasEnoughQi = this.qi >= s.qiCost;
                const isReady = !hasCooldown && hasEnoughQi;
                const r = s.r * scale;
                const img = this._images[s.id];

                ctx.save();

                // 阴影
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy + 3 * scale, r + 3 * scale, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 8 * scale;
                ctx.fill();
                ctx.restore();

                // 底板与辉光外环
                ctx.save();
                if (isReady) {
                    const pulse = Math.sin(time * 6 + (s.id === 'meteor' ? 0 : s.id === 'barrage' ? 2 : 4)) * 3 * scale;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r + 3.5 * scale + pulse, 0, Math.PI * 2);
                    ctx.strokeStyle = s.glowColor;
                    ctx.lineWidth = 3.5 * scale;
                    ctx.shadowColor = s.glowColor;
                    ctx.shadowBlur = 12 * scale;
                    ctx.stroke();

                    // 鎏金边框
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = '#121622';
                    ctx.fill();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2 * scale;
                    ctx.stroke();
                } else {
                    // 暗金冷灰未就绪底座
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = '#0A0C12';
                    ctx.fill();
                    ctx.strokeStyle = hasEnoughQi ? '#4A5568' : '#2D3748';
                    ctx.lineWidth = 1.8 * scale;
                    ctx.stroke();

                    // 冷却倒计时圆弧 (仅在 CD 时扫光)
                    if (hasCooldown) {
                        const progress = s.currentCd / s.cd;
                        const startAng = -Math.PI / 2;
                        const endAng = startAng + (1 - progress) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.arc(cx, cy, r - 1 * scale, startAng, endAng, false);
                        ctx.strokeStyle = '#FFD700';
                        ctx.lineWidth = 4 * scale;
                        ctx.shadowColor = '#FFD700';
                        ctx.shadowBlur = 6 * scale;
                        ctx.stroke();
                    }
                }
                ctx.restore();

                // 裁切图标
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, r - 2 * scale, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();

                    if (!isReady) {
                        ctx.filter = hasCooldown ? 'grayscale(85%) brightness(25%)' : 'grayscale(45%) brightness(45%)';
                    }
                    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
                    ctx.restore();
                }

                // 冷却中数字或未就绪蒙层
                if (hasCooldown) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, r - 2 * scale, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = `900 ${Math.round(18 * scale)}px "PingFang SC", sans-serif`;
                    ctx.fillStyle = '#FFF275';
                    ctx.shadowColor = '#F59E0B';
                    ctx.shadowBlur = 6 * scale;
                    ctx.fillText(`${Math.ceil(s.currentCd)}s`, cx, cy);
                    ctx.restore();
                } else if (!hasEnoughQi) {
                    // 真气不足蒙层
                    ctx.save();
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, r - 2 * scale, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // 技能名称与快捷键徽章
                const badgeW = 60 * scale;
                const badgeH = 16 * scale;
                const badgeY = cy + r + 13 * scale;

                ctx.save();
                ctx.fillStyle = isReady ? 'rgba(15, 23, 42, 0.92)' : 'rgba(10, 14, 22, 0.85)';
                ctx.strokeStyle = isReady ? s.color : '#475569';
                ctx.lineWidth = 1.2 * scale;
                ctx.beginPath();
                this._roundRect(ctx, cx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4 * scale);
                ctx.fill();
                ctx.stroke();

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${Math.round(10 * scale)}px "PingFang SC", sans-serif`;
                ctx.fillStyle = isReady ? '#FFFFFF' : '#94A3B8';
                ctx.fillText(`[${s.keyHint}] ${s.name}`, cx, badgeY);
                ctx.restore();

                // 消耗真气标记 (⚡50 / ⚡60 / ⚡100)
                const costY = cy - r - 9 * scale;
                ctx.save();
                ctx.fillStyle = hasEnoughQi ? '#FCD34D' : '#94A3B8';
                ctx.font = `bold ${Math.round(9 * scale)}px "PingFang SC", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = hasEnoughQi ? '#F59E0B' : 'transparent';
                ctx.shadowBlur = hasEnoughQi ? 4 * scale : 0;
                ctx.fillText(`⚡${s.qiCost}真气`, cx, costY);
                ctx.restore();

                ctx.restore();
            }
        } else {
            this._drawGraphicsFallback(gfx, time);
        }
    }

    /**
     * 绘制少林丹田真气能量槽
     */
    private _drawQiBar(
        ctx: CanvasRenderingContext2D,
        cw: number,
        ch: number,
        scale: number,
        time: number
    ): void {
        const barW = 270 * scale;
        const barH = 10 * scale;
        const barX = cw / 2 - barW / 2;
        // 位于技能按钮正上方
        const barY = ch / 2 - (-280) * scale;
        const ratio = this.qi / this.maxQi;
        const isFull = this.qi >= this.maxQi;

        ctx.save();

        // 1. 底框阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        this._roundRect(ctx, barX - 1, barY - 1, barW + 2, barH + 2, 5 * scale);
        ctx.fill();

        // 2. 底槽背景
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = isFull ? '#FCD34D' : '#334155';
        ctx.lineWidth = isFull ? 2 * scale : 1.2 * scale;
        ctx.beginPath();
        this._roundRect(ctx, barX, barY, barW, barH, 4 * scale);
        ctx.fill();
        ctx.stroke();

        // 3. 真气流光填充 (Crimson -> Amber Gold -> Holy Gold)
        if (ratio > 0.01) {
            ctx.save();
            ctx.beginPath();
            this._roundRect(ctx, barX + 1 * scale, barY + 1 * scale, (barW - 2 * scale) * ratio, barH - 2 * scale, 3 * scale);
            ctx.clip();

            const grad = ctx.createLinearGradient(barX, barY, barX + barW * ratio, barY);
            grad.addColorStop(0, '#DC2626');
            grad.addColorStop(0.6, '#F59E0B');
            grad.addColorStop(1, '#FEF08A');

            ctx.fillStyle = grad;
            ctx.fillRect(barX, barY, barW * ratio, barH);

            // 流动真气波纹
            const flowOffset = (time * 60) % (barW * 0.4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.fillRect(barX + flowOffset, barY, 15 * scale, barH);
            ctx.restore();
        }

        // 4. 满气爆裂光晕 (Full Qi Lightning Pulse)
        if (isFull) {
            const glow = Math.sin(time * 8) * 3 * scale;
            ctx.strokeStyle = '#FEF08A';
            ctx.lineWidth = 1.8 * scale;
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 12 * scale;
            ctx.beginPath();
            this._roundRect(ctx, barX - glow, barY - glow, barW + glow * 2, barH + glow * 2, 6 * scale);
            ctx.stroke();
        }

        // 5. 丹田真气文字标记
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.round(9.5 * scale)}px "PingFang SC", sans-serif`;
        if (isFull) {
            ctx.fillStyle = '#FFFBEB';
            ctx.shadowColor = '#F59E0B';
            ctx.shadowBlur = 6 * scale;
            ctx.fillText('🔥 丹田真气鼎盛 (100%) ! 可施如来神掌 !', cw / 2, barY - 9 * scale);
        } else {
            ctx.fillStyle = '#CBD5E1';
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillText(`⚡ 丹田真气: ${Math.round(this.qi)}% (连击/完美接球积攒)`, cw / 2, barY - 9 * scale);
        }

        ctx.restore();
    }

    private _roundRect(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
    ): void {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.arcTo(x + w, y, x + w, y + radius, radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
        ctx.lineTo(x + radius, y + h);
        ctx.arcTo(x, y + h, x, y + h - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
    }

    private _drawGraphicsFallback(gfx: Graphics, time: number): void {
        for (const s of this.skills) {
            const hasCooldown = s.currentCd > 0;
            const isReady = !hasCooldown && this.qi >= s.qiCost;
            const sx = s.x;
            const sy = s.y;
            const sr = s.r;

            gfx.fillColor = new Color(0, 0, 0, 110);
            gfx.circle(sx, sy - 4, sr + 4);
            gfx.fill();

            if (isReady) {
                const pulse = Math.sin(time * 5 + (s.id === 'meteor' ? 0 : s.id === 'barrage' ? 2 : 4)) * 3;
                const { r: gr, g: gg, b: gb } = this.hexToRgb(s.glowColor);

                gfx.strokeColor = new Color(gr, gg, gb, 200 + Math.floor(pulse * 18));
                gfx.lineWidth = 3.5;
                gfx.circle(sx, sy, sr + 4 + pulse);
                gfx.stroke();

                gfx.fillColor = new Color(18, 22, 34, 240);
                gfx.circle(sx, sy, sr);
                gfx.fill();
            } else {
                gfx.fillColor = new Color(10, 12, 18, 240);
                gfx.circle(sx, sy, sr);
                gfx.fill();

                gfx.strokeColor = new Color(60, 70, 85, 180);
                gfx.lineWidth = 2;
                gfx.circle(sx, sy, sr);
                gfx.stroke();

                if (hasCooldown) {
                    const progress = s.currentCd / s.cd;
                    const startAng = -Math.PI / 2;
                    const endAng = startAng + (1 - progress) * Math.PI * 2;
                    gfx.strokeColor = new Color(255, 220, 50, 240);
                    gfx.lineWidth = 4.5;
                    gfx.arc(sx, sy, sr - 1, startAng, endAng, false);
                    gfx.stroke();
                }
            }
        }
    }

    private hexToRgb(hex: string): { r: number; g: number; b: number } {
        const clean = hex.replace('#', '');
        return {
            r: parseInt(clean.substring(0, 2), 16) || 255,
            g: parseInt(clean.substring(2, 4), 16) || 255,
            b: parseInt(clean.substring(4, 6), 16) || 255,
        };
    }
}

export const skillSystem = new SkillSystem();
