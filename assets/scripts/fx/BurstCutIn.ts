/**
 * BurstCutIn.ts
 * ─────────────────────────────────────────────────────────────
 * 少林足球 — 必杀技特写系统 (三大技能各具截然不同、辨识度极高的神级视效)
 *
 * 三大技能专属视效：
 *  1. 【大力金刚腿·天火陨石】：烈焰飞龙神影，烈火翼翅与火舌风暴冲霄
 *  2. 【万佛千刃·影分身】：三重视差雷电分身并列齐发，周身缠绕青色闪电弧光
 *  3. 【如来神掌·山崩地裂】：神圣梵光法轮，金色如来巨掌从天而降压迫全场
 * ─────────────────────────────────────────────────────────────
 */

export interface CutInSkillInfo {
    id: 'meteor' | 'barrage' | 'earthquake';
    name: string;
    subName: string;
    quote: string;
    color: string;
    glowColor: string;
}

const SKILL_INFOS: Record<string, CutInSkillInfo> = {
    meteor: {
        id: 'meteor',
        name: '🔥 大力金刚腿·天火陨石',
        subName: '天火陨石 · 摧坚破阵',
        quote: '“真龙破阵 · 一击必杀！”',
        color: '#FF3838',
        glowColor: '#FF6B35',
    },
    barrage: {
        id: 'barrage',
        name: '⚡ 万佛千刃·影分身',
        subName: '千刃雷暴 · 万相齐发',
        quote: '“疾风掣电 · 万影破虚！”',
        color: '#00E5FF',
        glowColor: '#54A0FF',
    },
    earthquake: {
        id: 'earthquake',
        name: '✋ 如来神掌·山崩地裂',
        subName: '神威撼地 · 天翻地覆',
        quote: '“神佛降世 · 万物皆碎！”',
        color: '#FFD700',
        glowColor: '#FFFBE6',
    },
};

export class BurstCutIn {
    public active: boolean = false;
    public skillId: 'meteor' | 'barrage' | 'earthquake' = 'meteor';

    private _frame: number = 0;
    private readonly _maxFrames: number = 56; // ~0.93s 极具震撼力与观赏性的电影级必杀特写
    private _onComplete: (() => void) | null = null;
    private _rotTimer: number = 0;

    public start(skillId: 'meteor' | 'barrage' | 'earthquake', onComplete: () => void): void {
        this.active = true;
        this.skillId = skillId;
        this._frame = 0;
        this._onComplete = onComplete;
        this._rotTimer = 0;
    }

    public update(): void {
        if (!this.active) return;

        this._frame++;
        this._rotTimer += 0.07;

        if (this._frame >= this._maxFrames) {
            this.finish();
        }
    }

    /**
     * 立即完成当前特写并触发其技能实弹释放，支持快速连续释放下一个大招！
     */
    public finish(): void {
        if (!this.active) return;
        this.active = false;
        if (this._onComplete) {
            const cb = this._onComplete;
            this._onComplete = null;
            cb();
        }
    }

    /**
     * 3阶段电影级特写曲线：
     *  1. 0% ~ 16%: 凌空破虚，法相极速凝聚入画
     *  2. 16% ~ 82%: 充裕停留(~0.62s)，神魂战气平稳呼吸律动，玩家清晰鉴赏半透明法相与霸气台词
     *  3. 82% ~ 100%: 能量爆顶，全屏神芒闪烁，真实大招实弹轰入球场
     */
    private _getEnvelope(progress: number): { alpha: number; scaleMod: number } {
        if (progress < 0.16) {
            const t = progress / 0.16;
            const ease = 1 - Math.pow(1 - t, 3);
            return {
                alpha: ease * 0.92,
                scaleMod: 0.72 + ease * 0.38,
            };
        } else if (progress <= 0.82) {
            const midT = (progress - 0.16) / 0.66;
            return {
                alpha: 0.88 + 0.06 * Math.sin(midT * Math.PI * 4),
                scaleMod: 1.10 + 0.04 * Math.sin(midT * Math.PI * 2),
            };
        } else {
            const exitT = (progress - 0.82) / 0.18;
            return {
                alpha: Math.max(0, (1 - exitT) * 0.88),
                scaleMod: 1.14 + exitT * 0.22,
            };
        }
    }

    /**
     * 绘制三大截然不同的大招特写
     */
    public draw(ctx: CanvasRenderingContext2D, avatarSprite: HTMLCanvasElement | HTMLImageElement | null): void {
        if (!this.active) return;

        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const scale = Math.min(cw / 440, ch / 780);
        const info = SKILL_INFOS[this.skillId] || SKILL_INFOS.meteor;

        const progress = Math.min(1.0, this._frame / this._maxFrames);
        const cx = cw / 2;
        const cy = ch / 2 - 25 * scale;

        ctx.save();

        // ── 1. 电影级暗场背景与上下黑边 ──
        const bgAlpha = Math.min(0.85, progress < 0.16 ? (progress / 0.16) * 0.85 : progress > 0.82 ? ((1.0 - progress) / 0.18) * 0.85 : 0.85);
        ctx.fillStyle = `rgba(4, 7, 16, ${bgAlpha})`;
        ctx.fillRect(0, 0, cw, ch);

        // 电影黑边 (Top & Bottom Letterbox)
        const barH = Math.round(52 * scale);
        ctx.fillStyle = '#020408';
        ctx.fillRect(0, 0, cw, barH);
        ctx.fillRect(0, ch - barH, cw, barH);

        // 技能专属色调装饰线
        ctx.fillStyle = info.color;
        ctx.fillRect(0, barH - 2, cw, 2);
        ctx.fillRect(0, ch - barH, cw, 2);

        // ── 2. 三大技能各自独一无二的中央特写 ──
        if (this.skillId === 'meteor') {
            // ════════════════════════════════════════════════════════════
            // 技能 1：大力金刚腿·天火陨石 (烈焰飞龙神影 + 炽热赤红战气)
            // ════════════════════════════════════════════════════════════
            this._drawMeteorCutIn(ctx, cx, cy, progress, info, avatarSprite);
        } else if (this.skillId === 'barrage') {
            // ════════════════════════════════════════════════════════════
            // 技能 2：万佛千刃·影分身 (三重视差雷电分身 + 青色暴风闪电)
            // ════════════════════════════════════════════════════════════
            this._drawBarrageCutIn(ctx, cx, cy, progress, info, avatarSprite);
        } else if (this.skillId === 'earthquake') {
            // ════════════════════════════════════════════════════════════
            // 技能 3：如来神掌·山崩地裂 (神圣万丈佛光法轮 + 如来金刚巨掌降临)
            // ════════════════════════════════════════════════════════════
            this._drawEarthquakeCutIn(ctx, cx, cy, progress, info);
        }

        // ── 3. 专属国潮招式名称横幅与霸气题字 ──
        const bannerY = cy + Math.round(175 * scale);
        this._drawBanner(ctx, cx, bannerY, info, progress);

        // ── 4. 蓄力终结全屏闪光爆发 ──
        if (progress > 0.82) {
            const flashA = (progress - 0.82) / 0.18;
            ctx.fillStyle = this.skillId === 'barrage' ? `rgba(180, 240, 255, ${flashA * 0.9})` : this.skillId === 'earthquake' ? `rgba(255, 245, 180, ${flashA * 0.95})` : `rgba(255, 230, 200, ${flashA * 0.9})`;
            ctx.fillRect(0, 0, cw, ch);
        }

        ctx.restore();
    }

    /** 1. 烈焰飞龙金刚腿特写 */
    private _drawMeteorCutIn(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number, info: CutInSkillInfo, sprite: any): void {
        const rayCount = 16;
        ctx.save();
        ctx.translate(cx, cy);

        // 赤焰光芒
        for (let i = 0; i < rayCount; i++) {
            const ang = (i * Math.PI * 2) / rayCount + this._rotTimer * 1.2;
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 69, 0, 0.4)' : 'rgba(255, 165, 2, 0.28)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * 280, Math.sin(ang) * 280);
            ctx.stroke();
        }

        // 双层神威冲击波光环
        const ringPulse = (this._rotTimer * 20) % 180;
        ctx.strokeStyle = 'rgba(255, 107, 53, 0.5)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 60 + ringPulse, 0, Math.PI * 2);
        ctx.stroke();

        // 烈焰武尊单人冲击法相 (半透明巨大化冲击)
        if (sprite) {
            const env = this._getEnvelope(progress);
            ctx.scale(env.scaleMod, env.scaleMod);
            ctx.globalAlpha = Math.max(0, Math.min(1, env.alpha));

            // 火焰残影 (外层炽热光晕)
            ctx.save();
            ctx.globalAlpha = env.alpha * 0.45;
            ctx.filter = 'drop-shadow(0px 0px 35px #FF4500) brightness(160%)';
            ctx.drawImage(sprite, -110, -110, 220, 220);
            ctx.restore();

            // 火焰主体
            ctx.shadowColor = '#FF4500';
            ctx.shadowBlur = 35;
            ctx.drawImage(sprite, -110, -110, 220, 220);
        }
        ctx.restore();
    }

    /** 2. 三重雷电影分身特写 */
    private _drawBarrageCutIn(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number, info: CutInSkillInfo, sprite: any): void {
        ctx.save();
        ctx.translate(cx, cy);

        // 闪电雷光背景弧线
        for (let i = 0; i < 10; i++) {
            const ang = (i * Math.PI * 2) / 10 + this._rotTimer * 1.6;
            const x1 = Math.cos(ang) * 70;
            const y1 = Math.sin(ang) * 70;
            const x2 = Math.cos(ang) * 280;
            const y2 = Math.sin(ang) * 280;
            const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 45;
            const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 45;

            ctx.strokeStyle = i % 2 === 0 ? 'rgba(0, 229, 255, 0.55)' : 'rgba(84, 160, 255, 0.4)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(mx, my);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // 三重视差分身（左分身、右分身、中军主力分身）！
        if (sprite) {
            const env = this._getEnvelope(progress);
            ctx.scale(env.scaleMod, env.scaleMod);

            // A. 左侧雷电分身 (青色幽影)
            ctx.save();
            ctx.translate(-75, -15);
            ctx.scale(0.88, 0.88);
            ctx.globalAlpha = env.alpha * 0.7;
            ctx.filter = 'drop-shadow(0px 0px 22px #00D2D3) hue-rotate(180deg) brightness(130%)';
            ctx.drawImage(sprite, -100, -100, 200, 200);
            ctx.restore();

            // B. 右侧雷电分身 (青色幽影)
            ctx.save();
            ctx.translate(75, -15);
            ctx.scale(0.88, 0.88);
            ctx.globalAlpha = env.alpha * 0.7;
            ctx.filter = 'drop-shadow(0px 0px 22px #00D2D3) hue-rotate(180deg) brightness(130%)';
            ctx.drawImage(sprite, -100, -100, 200, 200);
            ctx.restore();

            // C. 中路真身法相
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, env.alpha));
            ctx.shadowColor = '#00E5FF';
            ctx.shadowBlur = 38;
            ctx.drawImage(sprite, -110, -110, 220, 220);
            ctx.restore();
        }
        ctx.restore();
    }

    /** 3. 如来金刚巨掌降临特写 (完全不同：纯粹的神圣巨佛金掌印) */
    private _drawEarthquakeCutIn(ctx: CanvasRenderingContext2D, cx: number, cy: number, progress: number, info: CutInSkillInfo): void {
        ctx.save();
        ctx.translate(cx, cy);

        // A. 旋转的神圣金光梵文法轮 (Holy Mandala Rays)
        const spokeCount = 20;
        for (let i = 0; i < spokeCount; i++) {
            const ang = (i * Math.PI * 2) / spokeCount + this._rotTimer * 0.8;
            ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 215, 0, 0.45)' : 'rgba(255, 245, 150, 0.28)';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(ang) * 290, Math.sin(ang) * 290);
            ctx.stroke();
        }

        // B. 同心佛光法印光环
        for (const r of [55, 100, 150]) {
            ctx.strokeStyle = 'rgba(255, 220, 50, 0.38)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // C. 巨大化从天而降的【金光如来神掌印】！
        const env = this._getEnvelope(progress);
        const palmScale = env.scaleMod * 1.05;

        ctx.save();
        ctx.scale(palmScale, palmScale);
        ctx.globalAlpha = Math.max(0, Math.min(1, env.alpha));
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 45;

        // 绘制巨型神圣金色掌印（手掌与五指）
        ctx.fillStyle = 'rgba(255, 225, 60, 0.94)';

        // 掌心基座
        ctx.beginPath();
        ctx.roundRect(-55, -20, 110, 85, 25);
        ctx.fill();

        // 五根金刚神指
        const fingers = [
            { x: -44, y: -70, w: 18, h: 65 },  // 大拇指
            { x: -22, y: -95, w: 18, h: 90 },  // 食指
            { x: 0,   y: -108, w: 20, h: 105 }, // 中指 (最长)
            { x: 22,  y: -95, w: 18, h: 90 },  // 无名指
            { x: 44,  y: -75, w: 18, h: 70 },  // 小指
        ];
        for (const f of fingers) {
            ctx.beginPath();
            ctx.roundRect(f.x - f.w / 2, f.y, f.w, f.h, 9);
            ctx.fill();
        }

        // 掌心万字符/佛光核心光环
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 20, 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
        ctx.restore();
    }

    /** 绘制底部招式横幅 */
    private _drawBanner(ctx: CanvasRenderingContext2D, cx: number, bannerY: number, info: CutInSkillInfo, progress: number): void {
        const scale = Math.min(ctx.canvas.width / 440, ctx.canvas.height / 780);
        const bannerW = Math.min(ctx.canvas.width * 0.92, 340 * scale);
        const bannerH = 46 * scale;

        // 横幅入场动画 (前 16% 向上滑入，之后稳定悬浮)
        const slideOffset = progress < 0.16 ? (1 - progress / 0.16) * 20 * scale : 0;
        const bannerAlpha = progress < 0.16 ? (progress / 0.16) : progress > 0.82 ? Math.max(0, (1 - (progress - 0.82) / 0.18)) : 1.0;

        ctx.save();
        ctx.translate(cx, bannerY + slideOffset);
        ctx.globalAlpha = bannerAlpha;

        // 横幅半透明底板
        ctx.fillStyle = 'rgba(10, 15, 28, 0.88)';
        ctx.beginPath();
        ctx.roundRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 8 * scale);
        ctx.fill();

        // 金色招式外框
        ctx.strokeStyle = info.color;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.roundRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 8 * scale);
        ctx.stroke();

        // 主招式名
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const titleFontSize = Math.max(13, Math.round(19 * scale));
        ctx.font = `900 ${titleFontSize}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
        ctx.fillStyle = info.id === 'barrage' ? '#E0F7FA' : info.id === 'earthquake' ? '#FFFBE6' : '#FFF275';
        ctx.shadowColor = info.color;
        ctx.shadowBlur = 8 * scale;
        ctx.fillText(info.name, 0, -4 * scale);

        // 霸气台词小注
        const quoteFontSize = Math.max(9, Math.round(11 * scale));
        ctx.font = `bold ${quoteFontSize}px 'PingFang SC', sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 4 * scale;
        ctx.fillText(info.quote, 0, 14 * scale);

        ctx.restore();
    }
}

export const burstCutIn = new BurstCutIn();
