import { Color, Graphics } from 'cc';
import { SKILL_ICONS_DATA } from './SkillAssets';

export interface SkillConfig {
    id: 'meteor' | 'barrage' | 'earthquake';
    name: string;
    fullName: string;
    subName: string;
    desc: string;
    keyHint: string;
    cd: number;           // Cooldown duration: 10s
    currentCd: number;    // Each skill's independent cooldown timer
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
    remaining?: number;
}

export class SkillSystem {
    // 独立冷却：每个技能各自独立计时，互不干扰！冷却倒计时直接显示在技能图标内部！
    public skills: SkillConfig[] = [
        {
            id: 'meteor',
            name: '金刚腿',
            fullName: '大力金刚腿·天火陨石',
            subName: '天火陨石',
            desc: '烈焰巨龙陨石冲天破阵，秒杀门将，贯穿全线！',
            keyHint: '1',
            cd: 10,
            currentCd: 0,
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
            cd: 10,
            currentCd: 0,
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

    public update(dt: number): void {
        this._animTimer += dt;
        for (const s of this.skills) {
            if (s.currentCd > 0) {
                // 每个技能各自独立扣除冷却
                s.currentCd = Math.max(0, s.currentCd - dt);
            }
        }
    }

    /**
     * Hit test for skill icons.
     * 精确界定底部技能栏感应区 (y: -390 ~ -292)，决不遮挡或干扰力度槽 (y: -272) 与瞄准发射区！
     * 每个技能各自独立判断冷却与就绪，一个技能冷却绝不影响其他技能的使用！
     */
    public checkClick(x: number, y: number): SkillClickResult {
        // 1. 底部技能栏专属精准感应区 (y: -390 ~ -292)
        // 技能中心分别为：x = -120 (金刚腿), x = 0 (影分身), x = +120 (如来神掌)
        // 边界平分点为：x = -55 与 x = +55
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
                        remaining: target.currentCd,
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

        // 2. 按钮圆形扩展检测 (半径扩展 15px，提供极佳的手指触控体验)
        for (const s of this.skills) {
            const dist = Math.hypot(x - s.x, y - s.y);
            if (dist <= s.r + 15) {
                if (s.currentCd > 0) {
                    return { clicked: true, triggered: false, id: s.id, x: s.x, y: s.y, remaining: s.currentCd };
                }
                return { clicked: true, triggered: true, id: s.id, x: s.x, y: s.y };
            }
        }
        return { clicked: false, triggered: false, id: null };
    }

    /**
     * 单独扣除指定技能的冷却时间（绝对不会影响其他技能）
     */
    public startCooldown(id: 'meteor' | 'barrage' | 'earthquake'): void {
        const s = this.skills.find(sk => sk.id === id);
        if (s) {
            s.currentCd = s.cd; // 独立进入 10s 冷却
        }
    }

    /**
     * 键盘快捷键触发判断
     */
    public triggerById(id: 'meteor' | 'barrage' | 'earthquake'): boolean {
        const s = this.skills.find(sk => sk.id === id);
        if (s && s.currentCd <= 0) {
            return true;
        }
        return false;
    }

    public getSkill(id: 'meteor' | 'barrage' | 'earthquake'): SkillConfig | undefined {
        return this.skills.find(s => s.id === id);
    }

    /**
     * 绘制技能按钮：
     * - 冷却倒计时直接显示在技能圆形图标正内部！
     * - 每个技能各自独立倒计时与扇形扫光，就绪时独立高亮！
     */
    public draw(gfx: Graphics, ctx?: CanvasRenderingContext2D | null): void {
        const time = this._animTimer;

        if (ctx) {
            const cw = ctx.canvas.width;
            const ch = ctx.canvas.height;
            const scale = Math.min(cw / 440, ch / 780);

            for (const s of this.skills) {
                const cx = cw / 2 + s.x * scale;
                const cy = ch / 2 - s.y * scale; // Convert Y-up to Canvas Y-down
                const isReady = s.currentCd <= 0;
                const r = s.r * scale;
                const img = this._images[s.id];

                ctx.save();

                // 1. Soft shadow under button
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy + 3 * scale, r + 3 * scale, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 8 * scale;
                ctx.fill();
                ctx.restore();

                // 2. Button backplate & glowing aura
                ctx.save();
                if (isReady) {
                    const pulse = Math.sin(time * 5 + (s.id === 'meteor' ? 0 : s.id === 'barrage' ? 2 : 4)) * 2.5 * scale;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r + 3.5 * scale + pulse, 0, Math.PI * 2);
                    ctx.strokeStyle = s.glowColor;
                    ctx.lineWidth = 3 * scale;
                    ctx.shadowColor = s.glowColor;
                    ctx.shadowBlur = 10 * scale;
                    ctx.stroke();

                    // Metallic rim
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = '#121622';
                    ctx.fill();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.8 * scale;
                    ctx.stroke();
                } else {
                    // Dark cooldown base
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fillStyle = '#0A0C12';
                    ctx.fill();
                    ctx.strokeStyle = '#3C4655';
                    ctx.lineWidth = 1.8 * scale;
                    ctx.stroke();

                    // Sweeping cooldown progress arc (10s -> 0s)
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
                ctx.restore();

                // 3. Circular Clipped PNG Icon
                if (img && img.complete && img.naturalWidth > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(cx, cy, r - 2 * scale, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();

                    if (!isReady) {
                        ctx.filter = 'grayscale(85%) brightness(28%)';
                    }
                    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
                    ctx.restore();
                }

                // 4. Cooldown overlay & glowing countdown number
                if (!isReady) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
                    ctx.beginPath();
                    ctx.arc(cx, cy, r - 2 * scale, 0, Math.PI * 2);
                    ctx.fill();

                    // Glowing countdown number
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const cdFontSize = Math.max(12, Math.round(16 * scale));
                    ctx.font = `900 ${cdFontSize}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
                    ctx.fillStyle = '#FFE600';
                    ctx.shadowColor = 'rgba(0,0,0,1)';
                    ctx.shadowBlur = 8 * scale;
                    ctx.fillText(`${s.currentCd.toFixed(1)}s`, cx, cy);

                    // Tip text
                    const tipFontSize = Math.max(8, Math.round(9 * scale));
                    ctx.font = `bold ${tipFontSize}px 'PingFang SC', sans-serif`;
                    ctx.fillStyle = '#94A3B8';
                    ctx.shadowBlur = 3 * scale;
                    ctx.fillText('冷却中', cx, cy + Math.round(13 * scale));
                    ctx.restore();
                } else {
                    // Ready tag
                    ctx.save();
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    const readyFontSize = Math.max(9, Math.round(10 * scale));
                    ctx.font = `900 ${readyFontSize}px 'PingFang SC', sans-serif`;
                    ctx.fillStyle = '#4ADE80';
                    ctx.shadowColor = 'rgba(0,0,0,0.9)';
                    ctx.shadowBlur = 4 * scale;
                    ctx.fillText('就绪', cx, cy - r - Math.round(5 * scale));
                    ctx.restore();
                }

                // 5. Name badge pill below button
                const badgeW = Math.round(52 * scale);
                const badgeH = Math.round(15 * scale);
                const badgeY = cy + r + Math.round(11 * scale);

                ctx.save();
                ctx.fillStyle = isReady ? 'rgba(15, 23, 42, 0.92)' : 'rgba(10, 12, 16, 0.85)';
                ctx.beginPath();
                ctx.roundRect(cx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4 * scale);
                ctx.fill();
                ctx.strokeStyle = isReady ? s.color : '#475569';
                ctx.lineWidth = 1.3 * scale;
                ctx.stroke();

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const nameFontSize = Math.max(10, Math.round(11 * scale));
                ctx.font = `900 ${nameFontSize}px 'PingFang SC', sans-serif`;
                ctx.fillStyle = isReady ? '#FFFFFF' : '#64748B';
                ctx.shadowColor = 'rgba(0,0,0,0.9)';
                ctx.shadowBlur = 4 * scale;
                ctx.fillText(s.name, cx, badgeY);
                ctx.restore();

                // 6. Key shortcut [1], [2], [3]
                ctx.save();
                const keyFontSize = Math.max(8, Math.round(9 * scale));
                ctx.font = `900 ${keyFontSize}px monospace`;
                ctx.fillStyle = isReady ? '#FFD700' : '#475569';
                ctx.fillText(`[${s.keyHint}]`, cx - r + Math.round(8 * scale), cy - r + Math.round(6 * scale));
                ctx.restore();

                ctx.restore();
            }
        } else {
            // Fallback to Graphics layer if ctx is not available
            this._drawGraphicsFallback(gfx, time);
        }
    }

    private _drawGraphicsFallback(gfx: Graphics, time: number): void {
        for (const s of this.skills) {
            const isReady = s.currentCd <= 0;
            const sx = s.x;
            const sy = s.y;
            const sr = s.r;

            // Soft shadow under button
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

                gfx.strokeColor = new Color(255, 255, 255, 230);
                gfx.lineWidth = 2;
                gfx.circle(sx, sy, sr);
                gfx.stroke();
            } else {
                gfx.fillColor = new Color(10, 12, 18, 240);
                gfx.circle(sx, sy, sr);
                gfx.fill();

                gfx.strokeColor = new Color(60, 70, 85, 180);
                gfx.lineWidth = 2;
                gfx.circle(sx, sy, sr);
                gfx.stroke();

                const progress = s.currentCd / s.cd;
                const startAng = -Math.PI / 2;
                const endAng = startAng + (1 - progress) * Math.PI * 2;
                gfx.strokeColor = new Color(255, 220, 50, 240);
                gfx.lineWidth = 4.5;
                gfx.arc(sx, sy, sr - 1, startAng, endAng, false);
                gfx.stroke();
            }

            const badgeW = 52;
            const badgeH = 15;
            const badgeY = sy - sr - 11;

            gfx.fillColor = isReady ? new Color(15, 23, 42, 235) : new Color(10, 12, 16, 210);
            gfx.roundRect(sx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
            gfx.fill();

            const { r: cr, g: cg, b: cb } = this.hexToRgb(s.color);
            gfx.strokeColor = isReady ? new Color(cr, cg, cb, 230) : new Color(70, 80, 95, 160);
            gfx.lineWidth = 1.3;
            gfx.roundRect(sx - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 4);
            gfx.stroke();
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
