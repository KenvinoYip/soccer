import { Color, Graphics } from 'cc';
import { HERO_SPRITE_DATA, HERO_KICK_SPRITE_DATA, NINJA_KICK_SPRITE_DATA } from './HeroAsset';

function hexToColor(hex: string, alpha: number = 255): Color {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return new Color(r, g, b, Math.round(Math.max(0, Math.min(255, alpha))));
}

export type KickType = 'side' | 'bicycle' | 'spin' | 'shadowless';

/**
 * High-End 2D Anime Hero Sprite Player
 * - Bruce Lee Jeet Kune Do Multi-Action Repertoire:
 *   1. Ready / Idle Stance (Springy footwork & nose wipe taunt)
 *   2. Flying Dragon Side Kick (飞龙侧踢)
 *   3. Aerial Inverted Bicycle Dual-Feet Kick (倒挂金钩·双飞破空)
 *   4. 360° Whirlwind Spinning Kick (狂暴旋风回旋踢)
 *   5. Foshan Shadowless Rapid-Fire Kick (佛山无影连环脚)
 * - Automatic background transparency keying
 * - Dynamic kick angle tilt, martial Ki flame aura, and ground contact shadow
 */
export class PlayerEntity {
    public x: number = 0;
    public y: number = -240;
    public targetX: number = 0;
    public vx: number = 0;

    public kickFrame: number = 0; // 0=idle, 1=charge, 2=kick, 3=followthrough
    public kickTimer: number = 0;
    public maxKickTimer: number = 20;
    public currentKickType: KickType = 'side';
    public isCharging: boolean = false;
    public auraAlpha: number = 0;
    public isSuper: boolean = false;

    private _animTimer: number = 0;
    private _gestureTimer: number = 0; // Bruce Lee nose-rub / taunt gesture timer
    private _isGesturing: boolean = false;

    // Real Character Sprite Images & Keyed Transparent Canvases
    private _heroImg: HTMLImageElement | null = null;
    private _transparentCanvas: HTMLCanvasElement | null = null;

    private _heroKickImg: HTMLImageElement | null = null;
    private _transparentKickCanvas: HTMLCanvasElement | null = null;

    constructor(x: number = 0, y: number = -240) {
        this.x = x;
        this.targetX = x;
        this.y = y;
        this._initHeroSprites();
    }

    public reset(x: number = 0, y: number = -240): void {
        this.x = x;
        this.targetX = x;
        this.y = y;
        this.vx = 0;
        this.kickFrame = 0;
        this.kickTimer = 0;
        this.maxKickTimer = 20;
        this.currentKickType = 'side';
        this.isCharging = false;
        this.auraAlpha = 0;
        this.isSuper = false;
        this._gestureTimer = 0;
        this._isGesturing = false;
    }

    private _initHeroSprites(): void {
        if (typeof Image === 'undefined') return;

        // 1. Bruce Lee Jeet Kune Do Ready Stance Sprite
        const imgIdle = new Image();
        imgIdle.onload = () => {
            this._heroImg = imgIdle;
            this._transparentCanvas = this._keyOutWhite(imgIdle);
        };
        imgIdle.src = HERO_SPRITE_DATA;
        if (imgIdle.complete && imgIdle.naturalWidth > 0) {
            this._heroImg = imgIdle;
            this._transparentCanvas = this._keyOutWhite(imgIdle);
        }

        // 2. Ninja Must Die Style Action Kick Sprite
        const imgKick = new Image();
        imgKick.onload = () => {
            this._heroKickImg = imgKick;
            this._transparentKickCanvas = this._keyOutWhite(imgKick);
        };
        imgKick.src = NINJA_KICK_SPRITE_DATA || HERO_KICK_SPRITE_DATA;
        if (imgKick.complete && imgKick.naturalWidth > 0) {
            this._heroKickImg = imgKick;
            this._transparentKickCanvas = this._keyOutWhite(imgKick);
        }
    }

    private _keyOutWhite(img: HTMLImageElement): HTMLCanvasElement | null {
        try {
            const offscreen = document.createElement('canvas');
            offscreen.width = img.width;
            offscreen.height = img.height;
            const octx = offscreen.getContext('2d');
            if (octx) {
                octx.drawImage(img, 0, 0);
                const idata = octx.getImageData(0, 0, offscreen.width, offscreen.height);
                const d = idata.data;
                for (let i = 0; i < d.length; i += 4) {
                    const r = d[i];
                    const g = d[i + 1];
                    const b = d[i + 2];
                    // Clean background keying with edge antialiasing
                    if (r > 240 && g > 240 && b > 240) {
                        d[i + 3] = 0;
                    } else if (r > 218 && g > 218 && b > 218) {
                        const factor = (255 - (r + g + b) / 3) / 37;
                        d[i + 3] = Math.round(Math.max(0, Math.min(255, d[i + 3] * factor)));
                    }
                }
                octx.putImageData(idata, 0, 0);
                return offscreen;
            }
        } catch {
            // Fallback if canvas security blocks
        }
        return null;
    }

    /** Expose the high-res kick sprite for the Ultimate Cut-in Avatar */
    public getAvatarSprite(): HTMLCanvasElement | HTMLImageElement | null {
        return this._transparentKickCanvas || this._heroKickImg || this._transparentCanvas || this._heroImg;
    }

    public startCharge(): void {
        this.isCharging = true;
        this.kickFrame = 1;
        this.auraAlpha = Math.max(0.5, this.auraAlpha);
    }

    public stopCharge(): void {
        this.isCharging = false;
        if (this.kickFrame === 1 && this.kickTimer <= 0) {
            this.kickFrame = 0;
        }
    }

    public kick(isSuper: boolean = false, kickType: KickType = 'side'): void {
        this.isCharging = false;
        this.isSuper = isSuper;
        this.currentKickType = kickType;
        this.maxKickTimer = (kickType === 'spin' || kickType === 'bicycle') ? 24 : 20;
        this.kickTimer = this.maxKickTimer;
        this.kickFrame = 2;
        this.auraAlpha = isSuper ? 1.0 : 0.8;
    }

    public update(): void {
        this._animTimer += 0.08;

        // Smooth horizontal position tracking towards targetX (clamped [-185, 185])
        this.targetX = Math.max(-185, Math.min(185, this.targetX));
        const dx = this.targetX - this.x;
        this.vx = dx * 0.38;
        this.x += this.vx;

        // Periodic Bruce Lee thumb-flick / nose-rub gesture cycle (~every 4.5s)
        if (this.kickFrame === 0 && !this.isCharging) {
            this._gestureTimer++;
            if (this._gestureTimer > 250) {
                this._isGesturing = true;
                if (this._gestureTimer > 295) {
                    this._isGesturing = false;
                    this._gestureTimer = 0;
                }
            } else {
                this._isGesturing = false;
            }
        } else {
            this._isGesturing = false;
            this._gestureTimer = 0;
        }

        if (this.kickTimer > 0) {
            this.kickTimer--;
            if (this.kickTimer > Math.floor(this.maxKickTimer * 0.38)) {
                this.kickFrame = 2; // Explosive martial kick in mid-air
            } else if (this.kickTimer > 0) {
                this.kickFrame = 3; // Follow-through landing
            } else {
                this.kickFrame = this.isCharging ? 1 : 0;
                this.isSuper = false;
            }
        } else if (this.isCharging) {
            this.kickFrame = 1;
        } else {
            this.kickFrame = 0;
        }

        if (this.isCharging) {
            this.auraAlpha = 0.8 + 0.2 * Math.sin(this._animTimer * 5);
        } else if (this.kickTimer > 0 && this.isSuper) {
            this.auraAlpha = Math.max(0, this.kickTimer / this.maxKickTimer);
        } else {
            this.auraAlpha = Math.max(0, this.auraAlpha - 0.04);
        }
    }

    public draw(gfx: Graphics, ctx?: CanvasRenderingContext2D | null): void {
        const px = this.x;
        // Bruce Lee Jeet Kune Do rhythmic butterfly footwork hop (轻快敏捷碎步跳跃)
        let hopY = 0;
        let swayX = 0;

        if (this.kickFrame === 0 && !this.isCharging) {
            if (this._isGesturing) {
                // Signature nose-flick taunt pose (擦鼻亮相，停顿微晃)
                hopY = 1.5;
                swayX = 2.0;
            } else {
                // Springy Bruce Lee double-bounce footwork
                const hopPhase = (this._animTimer * 6.5) % (Math.PI * 2);
                hopY = Math.max(0, Math.sin(hopPhase)) * 4.8 + Math.sin(hopPhase * 2) * 1.5;
                swayX = Math.sin(this._animTimer * 3.2) * 2.8;
            }
        } else if (this.isCharging) {
            // Charging crouch drop (蓄势下沉，龙伏深潭)
            hopY = -6.0;
            swayX = (Math.random() - 0.5) * 2.2; // High-tension vibration
        }

        const py = this.y + hopY;
        const currentPx = px + swayX;

        // 1. Dynamic shadow on Graphics (stretches & shrinks with hops and jumps)
        this._drawShadow(gfx, px, this.y, hopY);

        // 2. Battle Qi Aura (Golden flames & dragon sparks) on Graphics
        if (this.isCharging || this.auraAlpha > 0.04 || this.isSuper) {
            this._drawAura(gfx, currentPx, py);
        }

        // 3. Draw Real High-Res Anime Character Sprite on 2D Overlay Canvas
        const hasSprite = !!(this._transparentCanvas || this._heroImg || this._transparentKickCanvas || this._heroKickImg);
        if (ctx && hasSprite) {
            const cw = ctx.canvas.width;
            const ch = ctx.canvas.height;
            const scale = Math.min(cw / 440, ch / 780);
            const cx = cw / 2 + currentPx * scale;
            const cy = ch / 2 - py * scale;

            ctx.save();

            if (this.kickFrame >= 2) {
                // ── A. Bruce Lee Multi-Action Martial Arts Kicks (多招式真功夫特写) ──
                const kickSource = this._transparentKickCanvas || this._heroKickImg;
                if (kickSource) {
                    const progress = 1 - (this.kickTimer / (this.maxKickTimer || 20));
                    this._drawActionKick(ctx, kickSource, cx, cy, scale, progress);
                } else {
                    this._drawIdleSprite(ctx, cx, cy, scale);
                }
            } else {
                // ── B. Bruce Lee Jeet Kune Do Combat Guard (截拳道灵动戒备姿态) ──
                this._drawIdleSprite(ctx, cx, cy, scale);
            }

            ctx.restore();
        } else if (!hasSprite) {
            // Fallback: draw stylish Shaolin monk on Graphics if sprites not yet ready
            this._drawVectorFallback(gfx, currentPx, py);
        }

        // 4. Specialized foot energy flash & martial VFX
        if (this.kickFrame >= 2) {
            this._drawKickVFX(gfx);
        }
    }

    private _drawActionKick(
        ctx: CanvasRenderingContext2D,
        kickSource: HTMLCanvasElement | HTMLImageElement,
        cx: number,
        cy: number,
        scale: number,
        progress: number
    ): void {
        const kw = 175;
        const kh = 175;

        switch (this.currentKickType) {
            case 'bicycle': {
                // ── 倒挂金钩·凌空背跃双脚踢出 (Inverted Bicycle Kick / 背着地双脚踢出) ──
                // 跳跃轨迹：高空大弧度背飞后跃 (跃起高达76px)
                const jumpY = -76 * Math.sin(Math.min(1, progress * 1.3) * Math.PI) * scale;
                const jumpX = -10 * Math.sin(progress * Math.PI) * scale;
                const activeCx = cx + jumpX;
                const activeCy = cy + jumpY;

                // 身体倾角：完全倒挂横背向地，双脚直指长空！
                // 角度约 -120° ~ -135° (-2.18 ~ -2.35 rad)
                const kickAngle = -2.18 + (1 - progress) * 0.22;
                const kickScale = (this.isSuper ? 1.22 : 1.14) * scale;

                // 1. 绘制“双脚踢出”的剪刀脚双飞残影 (展现两只脚同时凌空暴射)
                ctx.save();
                ctx.translate(activeCx + 22 * scale, activeCy - 12 * scale);
                ctx.rotate(kickAngle + 0.18);
                ctx.scale(kickScale * 0.96, kickScale * 0.96);
                ctx.globalAlpha = 0.52;
                ctx.shadowColor = this.isSuper ? '#FFD700' : '#FF6B35';
                ctx.shadowBlur = 12 * scale;
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                ctx.restore();

                // 2. 绘制主体倒挂身躯
                ctx.save();
                ctx.translate(activeCx, activeCy);
                ctx.rotate(kickAngle);
                ctx.scale(kickScale, kickScale);
                ctx.shadowColor = this.isSuper ? '#FFE600' : '#FF9F1C';
                ctx.shadowBlur = (this.isSuper ? 18 : 10) * scale;
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                ctx.restore();

                // 3. 双脚脚尖双喷射天火火箭尾焰 (烈焰向下推进，排空起跳)
                if (progress < 0.8) {
                    const foot1X = activeCx + 38 * scale;
                    const foot1Y = activeCy - 58 * scale;
                    const foot2X = activeCx + 18 * scale;
                    const foot2Y = activeCy - 44 * scale;

                    this._drawFootFlameJet(ctx, foot1X, foot1Y, scale, this.isSuper);
                    this._drawFootFlameJet(ctx, foot2X, foot2Y, scale * 0.85, this.isSuper);
                }
                break;
            }

            case 'spin': {
                // ── 360° 狂暴旋风回旋踢·神龙摆尾 (Whirlwind Spinning Kick) ──
                const jumpY = -50 * Math.sin(progress * Math.PI) * scale;
                const activeCx = cx;
                const activeCy = cy + jumpY;

                // 360° 旋转角速度 (完整一周旋转)
                const spinAngle = progress * Math.PI * 2 + 0.15;
                const kickScale = (1.12 + 0.08 * Math.sin(spinAngle * 2)) * scale * (this.isSuper ? 1.16 : 1.05);

                // 1. 旋风残影 1 (滞后 0.38 rad)
                ctx.save();
                ctx.translate(activeCx, activeCy);
                ctx.rotate(spinAngle - 0.38);
                ctx.scale(kickScale * 0.95, kickScale * 0.95);
                ctx.globalAlpha = 0.38;
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur = 14 * scale;
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                ctx.restore();

                // 2. 旋风残影 2 (滞后 0.72 rad)
                ctx.save();
                ctx.translate(activeCx, activeCy);
                ctx.rotate(spinAngle - 0.72);
                ctx.scale(kickScale * 0.90, kickScale * 0.90);
                ctx.globalAlpha = 0.22;
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 10 * scale;
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                ctx.restore();

                // 3. 回旋踢主体
                ctx.save();
                ctx.translate(activeCx, activeCy);
                ctx.rotate(spinAngle);
                ctx.scale(kickScale, kickScale);
                ctx.shadowColor = this.isSuper ? '#FFE600' : '#FF9F1C';
                ctx.shadowBlur = 14 * scale;
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                ctx.restore();
                break;
            }

            case 'shadowless': {
                // ── 佛山无影连环脚 (Foshan Shadowless Multi-Kick) ──
                const midAirY = -46 * scale;
                const vibX = Math.sin(this.kickTimer * 3.2) * 12 * scale;
                const activeCx = cx + vibX;
                const activeCy = cy + midAirY;
                const kickScale = (this.isSuper ? 1.20 : 1.12) * scale;

                // 三道炫彩高频影分身残影 (青蓝、赤红、辉金)
                const ghosts = [
                    { offX: -26 * scale, offY: 4 * scale, alpha: 0.35, color: '#00E5FF' },
                    { offX: -14 * scale, offY: -4 * scale, alpha: 0.50, color: '#FF3838' },
                    { offX: 14 * scale, offY: 2 * scale, alpha: 0.50, color: '#FFD700' }
                ];
                for (const g of ghosts) {
                    ctx.save();
                    ctx.translate(activeCx + g.offX, activeCy + g.offY);
                    ctx.rotate(0.12);
                    ctx.scale(kickScale, kickScale);
                    ctx.globalAlpha = g.alpha;
                    ctx.shadowColor = g.color;
                    ctx.shadowBlur = 12 * scale;
                    ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                    ctx.restore();
                }

                // 主体飞踢
                ctx.save();
                ctx.translate(activeCx, activeCy);
                ctx.rotate(0.12);
                ctx.scale(kickScale, kickScale);
                ctx.shadowColor = '#FFE600';
                ctx.shadowBlur = 16 * scale;
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                ctx.restore();
                break;
            }

            case 'side':
            default: {
                // ── 经典凌空飞龙侧踢 ──
                const midAirY = this.kickFrame === 2 ? -44 * scale : -20 * scale;
                const midAirX = this.kickFrame === 2 ? 16 * scale : 6 * scale;
                ctx.translate(cx + midAirX, cy + midAirY);

                const kickAngle = this.kickFrame === 2 ? 0.14 : 0.04;
                ctx.rotate(kickAngle);
                const kickScale = (this.isSuper ? 1.18 : 1.10) * scale;
                ctx.scale(kickScale, kickScale);
                ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
                break;
            }
        }

        // ── 踢击瞬间足尖暴射破空足球 (Soccer Ball Launch Blast) ──
        if (progress < 0.75) {
            let blastFootX = cx;
            let blastFootY = cy;
            let blastAngle = -0.55;

            if (this.currentKickType === 'bicycle') {
                const jumpY = -76 * Math.sin(Math.min(1, progress * 1.3) * Math.PI) * scale;
                blastFootX = cx + 42 * scale;
                blastFootY = cy + jumpY - 62 * scale;
                blastAngle = -Math.PI * 0.45;
            } else if (this.currentKickType === 'spin') {
                const jumpY = -50 * Math.sin(progress * Math.PI) * scale;
                blastFootX = cx + 38 * scale;
                blastFootY = cy + jumpY - 32 * scale;
                blastAngle = -0.65;
            } else if (this.currentKickType === 'shadowless') {
                blastFootX = cx + 36 * scale;
                blastFootY = cy - 42 * scale;
                blastAngle = -0.58;
            } else {
                blastFootX = cx + 45 * scale;
                blastFootY = cy - 48 * scale;
                blastAngle = -0.52;
            }

            this._drawKickBallBlast(ctx, blastFootX, blastFootY, scale, blastAngle, progress, this.isSuper);
        }
    }

    private _drawKickBallBlast(
        ctx: CanvasRenderingContext2D,
        ballX: number,
        ballY: number,
        scale: number,
        angle: number,
        progress: number,
        isSuper: boolean
    ): void {
        ctx.save();
        ctx.translate(ballX, ballY);
        ctx.rotate(angle);

        const ballR = 14 * scale * (1 + (1 - progress) * 0.25);
        const alpha = Math.max(0, Math.min(1, (0.75 - progress) / 0.5));

        ctx.globalAlpha = alpha;

        // 1. Concentric Ink Shockwave & Calligraphy Speed Slashes
        ctx.strokeStyle = isSuper ? '#FFE600' : '#11161F';
        ctx.lineWidth = 3.5 * scale;
        ctx.shadowColor = isSuper ? '#FF8800' : '#FF3838';
        ctx.shadowBlur = 12 * scale;
        ctx.beginPath();
        ctx.arc(0, 0, ballR * 1.8, -0.8, 0.8);
        ctx.stroke();

        // 2. Ink Calligraphy Speed Slashes trailing behind the soccer ball
        ctx.strokeStyle = isSuper ? '#FFA500' : '#222831';
        ctx.lineWidth = 2.0 * scale;
        ctx.beginPath();
        ctx.moveTo(-ballR * 0.8, -ballR * 0.9);
        ctx.lineTo(-ballR * 3.0, -ballR * 0.5);
        ctx.moveTo(-ballR * 0.8, ballR * 0.9);
        ctx.lineTo(-ballR * 3.0, ballR * 0.5);
        ctx.moveTo(-ballR * 1.2, 0);
        ctx.lineTo(-ballR * 3.8, 0);
        ctx.stroke();

        // 3. Soccer Ball Base Body
        const grad = ctx.createRadialGradient(-ballR * 0.3, -ballR * 0.3, ballR * 0.1, 0, 0, ballR);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.7, '#E2E8F0');
        grad.addColorStop(1, '#94A3B8');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, ballR, 0, Math.PI * 2);
        ctx.fill();

        // 4. Classic Black & Gold Pentagon Patches
        ctx.fillStyle = isSuper ? '#8B4513' : '#1E293B';
        ctx.strokeStyle = isSuper ? '#FFD700' : '#CBD5E1';
        ctx.lineWidth = 1.0 * scale;

        const rot = progress * 6.0;
        for (let i = 0; i < 5; i++) {
            const pAngle = rot + (i * Math.PI * 2) / 5;
            const dist = ballR * 0.55;
            const px = Math.cos(pAngle) * dist;
            const py = Math.sin(pAngle) * dist;
            const patchR = ballR * 0.28;

            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const a = pAngle + (j * Math.PI * 2) / 5;
                const x = px + Math.cos(a) * patchR;
                const y = py + Math.sin(a) * patchR;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // Center patch
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
            const a = rot + (j * Math.PI * 2) / 5;
            const x = Math.cos(a) * (ballR * 0.32);
            const y = Math.sin(a) * (ballR * 0.32);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    private _drawFootFlameJet(ctx: CanvasRenderingContext2D, fx: number, fy: number, scale: number, isSuper: boolean): void {
        ctx.save();
        const coreColor = isSuper ? '#FFFFFF' : '#FFF9D2';
        const flameColor = isSuper ? '#FFE600' : '#FF6B35';
        const outerColor = isSuper ? '#FF3838' : '#D35400';

        // 喷射火焰向斜下方喷吐动力，推举身躯冲天
        ctx.fillStyle = outerColor;
        ctx.beginPath();
        ctx.moveTo(fx - 7 * scale, fy);
        ctx.lineTo(fx + 7 * scale, fy);
        ctx.lineTo(fx, fy + 26 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = flameColor;
        ctx.beginPath();
        ctx.moveTo(fx - 4 * scale, fy);
        ctx.lineTo(fx + 4 * scale, fy);
        ctx.lineTo(fx, fy + 18 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(fx, fy, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Neo-Ink Wash Shaolin Shadow Ninja Idle Stance (潮酷新国风少林暗影英雄)
     * - Dark shadow shinobi body with martial readiness
     * - Razor-sharp glowing amber/crimson visor eyes
     * - Giant billowing crimson hero scarf with wind cloth physics
     * - Saffron gold Shaolin martial belt & clean white leg wraps
     * - Waiting 3D Yin-Yang soccer ball spinning at foot
     */
    private _drawIdleSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number = 1.0): void {
        const px = cx;
        const crouchY = (this.isCharging ? 6 : 0) * scale;
        const py = cy - 25 * scale + crouchY;

        ctx.save();
        ctx.translate(px, py);

        const anim = this._animTimer;
        const hop = this.isCharging ? 0 : Math.sin(anim * 6.5) * 1.8 * scale;
        const sway = this.isCharging ? (Math.random() - 0.5) * 1.5 * scale : Math.sin(anim * 3.2) * 1.2 * scale;
        const scarfWave1 = Math.sin(anim * 4.8);
        const scarfWave2 = Math.cos(anim * 4.8 + 1.2);

        // ── 1. The Waiting Soccer Ball at Foot (足边蓄势待发足球) ──
        const ballX = 22 * scale;
        const ballY = 24 * scale;
        const ballR = 13 * scale;

        // Ball ground contact shadow
        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 25, 0.45)';
        ctx.beginPath();
        ctx.ellipse(ballX, ballY + ballR * 0.9, ballR * 0.9, ballR * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Soccer ball sphere
        ctx.save();
        const ballGrad = ctx.createRadialGradient(
            ballX - ballR * 0.35, ballY - ballR * 0.35, ballR * 0.1,
            ballX, ballY, ballR
        );
        ballGrad.addColorStop(0, '#FFFFFF');
        ballGrad.addColorStop(0.65, '#E2E8F0');
        ballGrad.addColorStop(1, '#94A3B8');
        ctx.fillStyle = ballGrad;
        if (this.isCharging) {
            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 15 * scale;
        }
        ctx.beginPath();
        ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
        ctx.fill();

        // Soccer ball pentagons (spinning when charging)
        const ballSpin = this.isCharging ? anim * 4.5 : anim * 0.8;
        ctx.fillStyle = this.isCharging ? '#A04000' : '#1E293B';
        ctx.strokeStyle = this.isCharging ? '#FFD700' : '#CBD5E1';
        ctx.lineWidth = 1.0 * scale;

        // Center patch
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
            const a = ballSpin + (j * Math.PI * 2) / 5;
            const x = ballX + Math.cos(a) * (ballR * 0.32);
            const y = ballY + Math.sin(a) * (ballR * 0.32);
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 5 Outer patches
        for (let i = 0; i < 5; i++) {
            const pAngle = ballSpin + (i * Math.PI * 2) / 5;
            const dist = ballR * 0.62;
            const pxPos = ballX + Math.cos(pAngle) * dist;
            const pyPos = ballY + Math.sin(pAngle) * dist;
            const patchR = ballR * 0.28;

            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const a = pAngle + (j * Math.PI * 2) / 5;
                const x = pxPos + Math.cos(a) * patchR;
                const y = pyPos + Math.sin(a) * patchR;
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // Charging golden dragon Qi around ball
        if (this.isCharging) {
            ctx.strokeStyle = '#FFE600';
            ctx.lineWidth = 2.0 * scale;
            ctx.beginPath();
            ctx.arc(ballX, ballY, ballR + 4 * scale, anim * 3, anim * 3 + Math.PI * 1.2);
            ctx.stroke();

            ctx.strokeStyle = '#FF6B35';
            ctx.lineWidth = 1.5 * scale;
            ctx.beginPath();
            ctx.arc(ballX, ballY, ballR + 7 * scale, -anim * 3.5, -anim * 3.5 + Math.PI);
            ctx.stroke();
        }
        ctx.restore();

        // ── 2. Ultra-Long Crimson Hero Scarf (超长飘逸赤红大围巾) ──
        const neckX = -4 * scale + sway;
        const neckY = -36 * scale + hop;

        ctx.save();
        ctx.shadowColor = '#C0392B';
        ctx.shadowBlur = 8 * scale;

        // Scarf Layer 1: Dark Crimson Deep Shadow Silk
        ctx.fillStyle = '#781515';
        ctx.beginPath();
        ctx.moveTo(neckX, neckY);
        ctx.bezierCurveTo(
            neckX - 28 * scale, neckY - 14 * scale + scarfWave1 * 5,
            neckX - 58 * scale, neckY - 34 * scale + scarfWave2 * 8,
            neckX - 92 * scale, neckY - 58 * scale + scarfWave1 * 12
        );
        ctx.lineTo(neckX - 86 * scale, neckY - 68 * scale + scarfWave1 * 12);
        ctx.bezierCurveTo(
            neckX - 52 * scale, neckY - 44 * scale + scarfWave2 * 8,
            neckX - 24 * scale, neckY - 24 * scale + scarfWave1 * 5,
            neckX, neckY - 6 * scale
        );
        ctx.closePath();
        ctx.fill();

        // Scarf Layer 2: Main Billowing Blood Red Ribbon
        ctx.fillStyle = '#C0392B';
        ctx.beginPath();
        ctx.moveTo(neckX + 2 * scale, neckY);
        ctx.bezierCurveTo(
            neckX - 25 * scale, neckY - 18 * scale + scarfWave1 * 6,
            neckX - 54 * scale, neckY - 40 * scale + scarfWave2 * 10,
            neckX - 88 * scale, neckY - 64 * scale + scarfWave1 * 14
        );
        // Forked swallowtail tip
        ctx.lineTo(neckX - 102 * scale, neckY - 72 * scale + scarfWave1 * 16);
        ctx.lineTo(neckX - 86 * scale, neckY - 60 * scale + scarfWave1 * 14);
        ctx.lineTo(neckX - 96 * scale, neckY - 52 * scale + scarfWave1 * 14);
        ctx.bezierCurveTo(
            neckX - 50 * scale, neckY - 32 * scale + scarfWave2 * 9,
            neckX - 22 * scale, neckY - 12 * scale + scarfWave1 * 5,
            neckX, neckY - 2 * scale
        );
        ctx.closePath();
        ctx.fill();

        // Scarf Layer 3: Vibrant Vermilion Wind Crest Highlight
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.moveTo(neckX + 1 * scale, neckY - 2 * scale);
        ctx.bezierCurveTo(
            neckX - 24 * scale, neckY - 20 * scale + scarfWave1 * 6,
            neckX - 52 * scale, neckY - 42 * scale + scarfWave2 * 10,
            neckX - 85 * scale, neckY - 66 * scale + scarfWave1 * 14
        );
        ctx.lineTo(neckX - 82 * scale, neckY - 62 * scale + scarfWave1 * 14);
        ctx.bezierCurveTo(
            neckX - 50 * scale, neckY - 38 * scale + scarfWave2 * 9,
            neckX - 22 * scale, neckY - 16 * scale + scarfWave1 * 5,
            neckX - 1 * scale, neckY - 1 * scale
        );
        ctx.closePath();
        ctx.fill();

        // Trailing fire embers floating off the scarf
        for (let k = 0; k < 4; k++) {
            const emberProgress = ((anim * 35 + k * 25) % 90);
            const ex = neckX - 70 * scale - emberProgress * 0.45 * scale;
            const ey = neckY - 45 * scale - emberProgress * 0.35 * scale + Math.sin(anim * 6 + k) * 6 * scale;
            const emberAlpha = Math.max(0, 1 - emberProgress / 90);
            ctx.fillStyle = `rgba(255, 71, 87, ${emberAlpha})`;
            ctx.beginPath();
            ctx.arc(ex, ey, (1.8 - k * 0.3) * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // ── 3. Shadow Ninja Body & Martial Stance (暗影国风武者身躯) ──
        ctx.save();
        ctx.translate(sway, hop);

        // Back leg (Right leg, braced back)
        ctx.fillStyle = '#111722';
        ctx.beginPath();
        ctx.moveTo(-6 * scale, 6 * scale);
        ctx.lineTo(-20 * scale, 18 * scale);
        ctx.lineTo(-26 * scale, 34 * scale);
        ctx.lineTo(-14 * scale, 34 * scale);
        ctx.lineTo(-12 * scale, 22 * scale);
        ctx.lineTo(0, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Front leg (Left leg, leading toward the soccer ball)
        ctx.fillStyle = '#18202D';
        ctx.beginPath();
        ctx.moveTo(2 * scale, 6 * scale);
        ctx.lineTo(14 * scale, 16 * scale);
        ctx.lineTo(18 * scale, 32 * scale);
        ctx.lineTo(26 * scale, 32 * scale);
        ctx.lineTo(22 * scale, 20 * scale);
        ctx.lineTo(8 * scale, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // White Shaolin leg wraps with dark cross ties (白绑腿)
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-24 * scale, 24 * scale, 11 * scale, 9 * scale);
        ctx.fillRect(15 * scale, 22 * scale, 11 * scale, 9 * scale);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.0 * scale;
        ctx.strokeRect(-24 * scale, 24 * scale, 11 * scale, 9 * scale);
        ctx.strokeRect(15 * scale, 22 * scale, 11 * scale, 9 * scale);

        // Ninja Combat Sneakers (Dark cleats with gold accent)
        ctx.fillStyle = '#0B0F15';
        ctx.beginPath();
        ctx.roundRect(-27 * scale, 32 * scale, 15 * scale, 5 * scale, 2 * scale);
        ctx.roundRect(14 * scale, 30 * scale, 16 * scale, 5 * scale, 2 * scale);
        ctx.fill();

        // Torso: Muscular athletic shadow silhouette
        ctx.fillStyle = '#151D2A';
        ctx.beginPath();
        ctx.moveTo(-16 * scale, -24 * scale);
        ctx.lineTo(14 * scale, -24 * scale);
        ctx.lineTo(10 * scale, 6 * scale);
        ctx.lineTo(-12 * scale, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Chest vest contour & armor bevel
        ctx.fillStyle = '#222C3D';
        ctx.beginPath();
        ctx.moveTo(-12 * scale, -22 * scale);
        ctx.lineTo(10 * scale, -22 * scale);
        ctx.lineTo(6 * scale, -4 * scale);
        ctx.lineTo(-8 * scale, -4 * scale);
        ctx.closePath();
        ctx.fill();

        // Shaolin Golden Martial Belt & Dangling Ribbons (金刚武僧腰带)
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(-13 * scale, 3 * scale, 25 * scale, 5 * scale);
        ctx.fillStyle = '#F39C12';
        ctx.fillRect(-13 * scale, 4 * scale, 25 * scale, 2 * scale);
        // Belt knot & ribbons
        ctx.beginPath();
        ctx.arc(-2 * scale, 5 * scale, 3.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D35400';
        ctx.beginPath();
        ctx.moveTo(-4 * scale, 6 * scale);
        ctx.lineTo(-8 * scale, 22 * scale + Math.sin(anim * 4) * 3 * scale);
        ctx.lineTo(-4 * scale, 22 * scale + Math.sin(anim * 4) * 3 * scale);
        ctx.lineTo(-1 * scale, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Arms in Kung Fu Ready Guard Stance
        // Rear arm (guarding chest)
        ctx.fillStyle = '#111722';
        ctx.beginPath();
        ctx.moveTo(-14 * scale, -22 * scale);
        ctx.lineTo(-24 * scale, -8 * scale);
        ctx.lineTo(-18 * scale, 2 * scale);
        ctx.lineTo(-12 * scale, -6 * scale);
        ctx.closePath();
        ctx.fill();

        // Front arm (extended forward in martial poise)
        ctx.fillStyle = '#1B2332';
        ctx.beginPath();
        ctx.moveTo(12 * scale, -22 * scale);
        ctx.lineTo(24 * scale, -12 * scale);
        ctx.lineTo(30 * scale, -4 * scale);
        ctx.lineTo(24 * scale, 2 * scale);
        ctx.lineTo(14 * scale, -12 * scale);
        ctx.closePath();
        ctx.fill();

        // Head: Sleek Shadow Ninja Cowl
        ctx.fillStyle = '#0F1520';
        ctx.beginPath();
        ctx.arc(-1 * scale, -34 * scale, 13 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Angular cowl jawline
        ctx.beginPath();
        ctx.moveTo(-12 * scale, -32 * scale);
        ctx.lineTo(2 * scale, -20 * scale);
        ctx.lineTo(11 * scale, -32 * scale);
        ctx.closePath();
        ctx.fill();

        // Glowing Razor-Sharp Eye Visor Flare (小黑/苍牙式炽亮战眼神眸)
        const eyeGlowColor = this.isSuper ? '#FF3838' : '#FFD700';
        const eyeCoreColor = '#FFFFFF';
        ctx.shadowColor = eyeGlowColor;
        ctx.shadowBlur = (this.isCharging ? 16 : 10) * scale;

        // Eye slit
        ctx.fillStyle = eyeCoreColor;
        ctx.beginPath();
        ctx.moveTo(1 * scale, -34 * scale);
        ctx.lineTo(9 * scale, -32 * scale);
        ctx.lineTo(7 * scale, -30 * scale);
        ctx.lineTo(0, -32 * scale);
        ctx.closePath();
        ctx.fill();

        // Horizontal luminous eye flare streak
        ctx.strokeStyle = eyeGlowColor;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(-3 * scale, -33 * scale);
        ctx.lineTo(16 * scale, -31 * scale);
        ctx.stroke();

        ctx.restore();
        ctx.restore();
    }

    private _drawShadow(gfx: Graphics, px: number, py: number, hopY: number = 0): void {
        // When character hops high, shadow shrinks and diffuses (3D depth perception!)
        const isMidAirKick = this.kickFrame >= 2;
        let heightOffset = Math.max(0, hopY);
        if (isMidAirKick) {
            const progress = 1 - (this.kickTimer / (this.maxKickTimer || 20));
            if (this.currentKickType === 'bicycle') {
                heightOffset = 76 * Math.sin(Math.min(1, progress * 1.3) * Math.PI);
            } else if (this.currentKickType === 'spin') {
                heightOffset = 50 * Math.sin(progress * Math.PI);
            } else {
                heightOffset = 45;
            }
        }
        const shadowRadius = Math.max(10, 30 - heightOffset * 0.42);
        const shadowAlpha = Math.max(25, Math.floor(130 - heightOffset * 1.6));

        gfx.fillColor = hexToColor('#05080c', Math.floor(shadowAlpha * 0.6));
        gfx.circle(px, py - 48, shadowRadius);
        gfx.fill();

        gfx.fillColor = hexToColor('#020406', shadowAlpha);
        gfx.circle(px, py - 48, Math.max(6, shadowRadius * 0.6));
        gfx.fill();
    }

    private _drawAura(gfx: Graphics, px: number, py: number): void {
        const a = Math.min(1, Math.max(0, this.auraAlpha));
        const goldColor = this.isSuper ? '#FFE600' : '#FF8800';
        const innerColor = this.isSuper ? '#FFFBE6' : '#FFBB33';

        // Ground martial energy ring
        gfx.lineWidth = 2.5;
        gfx.strokeColor = hexToColor(goldColor, a * 140);
        gfx.circle(px, py - 44, 46 + Math.sin(this._animTimer * 4) * 4);
        gfx.stroke();

        // Flaming dragon body aura
        const flameR = 56 + Math.sin(this._animTimer * 6) * 5;
        gfx.fillColor = hexToColor(goldColor, a * 40);
        gfx.circle(px, py + 25, flameR);
        gfx.fill();

        gfx.fillColor = hexToColor(innerColor, a * 70);
        gfx.circle(px, py + 25, flameR * 0.65);
        gfx.fill();

        // Rising golden lightning sparks
        for (let i = 0; i < 7; i++) {
            const angle = this._animTimer * 3 + (i * Math.PI * 2) / 7;
            const dist = 36 + (i % 3) * 10;
            const ex = px + Math.cos(angle) * dist;
            const ey = py + 12 + ((this._animTimer * 50 + i * 22) % 85);
            gfx.fillColor = hexToColor('#FFFFFF', a * 220);
            gfx.circle(ex, ey, 2.5);
            gfx.fill();
        }
    }

    private _drawKickVFX(gfx: Graphics): void {
        const px = this.x;
        const py = this.y;
        const mainColor = this.isSuper ? '#FFE600' : '#FF5500';

        switch (this.currentKickType) {
            case 'bicycle': {
                // 倒挂双飞踢：双脚高位双重金色震荡波 + 冲天金色光华
                const fx1 = px + 36;
                const fy1 = py + 86;
                const fx2 = px + 18;
                const fy2 = py + 74;

                for (const pos of [{x: fx1, y: fy1}, {x: fx2, y: fy2}]) {
                    gfx.fillColor = hexToColor('#FFFFFF', 255);
                    gfx.circle(pos.x, pos.y, this.isSuper ? 12 : 8);
                    gfx.fill();

                    gfx.fillColor = hexToColor(mainColor, 180);
                    gfx.circle(pos.x, pos.y, this.isSuper ? 24 : 16);
                    gfx.fill();

                    gfx.lineWidth = 3.0;
                    gfx.strokeColor = hexToColor(mainColor, 220);
                    gfx.circle(pos.x, pos.y, this.isSuper ? 36 : 24);
                    gfx.stroke();
                }

                // 垂直冲天双刃光华
                gfx.lineWidth = 2.5;
                gfx.strokeColor = hexToColor('#FFFFFF', 240);
                gfx.moveTo(fx1, fy1 - 10);
                gfx.lineTo(fx1 + 10, fy1 + 35);
                gfx.stroke();
                gfx.moveTo(fx2, fy2 - 10);
                gfx.lineTo(fx2 - 8, fy2 + 35);
                gfx.stroke();
                break;
            }

            case 'spin': {
                // 360° 旋风回旋踢：周身旋转飓风风刃光环 + 环形扩散风暴
                const centerX = px;
                const centerY = py + 48;
                const vortexR = (this.isSuper ? 54 : 42) + Math.sin(this._animTimer * 12) * 6;

                // 旋转飓风风暴光环
                gfx.lineWidth = 3.5;
                gfx.strokeColor = hexToColor(this.isSuper ? '#FFE600' : '#00E5FF', 230);
                gfx.circle(centerX, centerY, vortexR);
                gfx.stroke();

                // 4道旋转风刃弧线
                for (let i = 0; i < 4; i++) {
                    const ang = this._animTimer * 6 + (i * Math.PI) / 2;
                    const r1 = vortexR * 0.7;
                    const r2 = vortexR * 1.15;
                    gfx.lineWidth = 2.8;
                    gfx.strokeColor = hexToColor('#FFFFFF', 220);
                    gfx.moveTo(centerX + Math.cos(ang) * r1, centerY + Math.sin(ang) * r1);
                    gfx.lineTo(centerX + Math.cos(ang + 0.4) * r2, centerY + Math.sin(ang + 0.4) * r2);
                    gfx.stroke();
                }
                break;
            }

            case 'shadowless': {
                // 佛山无影连环脚：交错双爆轰闪光
                const fx1 = px + 44;
                const fy1 = py + 62;
                const fx2 = px + 28;
                const fy2 = py + 48;

                gfx.fillColor = hexToColor('#FFFFFF', 255);
                gfx.circle(fx1, fy1, 10);
                gfx.fill();
                gfx.circle(fx2, fy2, 8);
                gfx.fill();

                gfx.fillColor = hexToColor('#FF3838', 190);
                gfx.circle(fx1, fy1, 22);
                gfx.fill();
                gfx.fillColor = hexToColor('#FFD700', 190);
                gfx.circle(fx2, fy2, 18);
                gfx.fill();
                break;
            }

            case 'side':
            default: {
                // 经典飞龙侧踢爆轰
                const fx = px + 48;
                const fy = py + 60;

                gfx.fillColor = hexToColor('#FFFFFF', 255);
                gfx.circle(fx, fy, this.isSuper ? 14 : 9);
                gfx.fill();

                gfx.fillColor = hexToColor(mainColor, 180);
                gfx.circle(fx, fy, this.isSuper ? 28 : 18);
                gfx.fill();

                gfx.lineWidth = 3.5;
                gfx.strokeColor = hexToColor(mainColor, 230);
                gfx.circle(fx, fy, this.isSuper ? 38 : 24);
                gfx.stroke();

                for (let i = 0; i < 8; i++) {
                    const angle = (i * Math.PI) / 4 + this._animTimer * 3;
                    const len = (this.isSuper ? 28 : 16) + (i % 2) * 10;
                    gfx.lineWidth = 2.5;
                    gfx.strokeColor = hexToColor('#FFFFFF', 220);
                    gfx.moveTo(fx, fy);
                    gfx.lineTo(fx + Math.cos(angle) * len, fy + Math.sin(angle) * len);
                    gfx.stroke();
                }
                break;
            }
        }
    }

    private _drawVectorFallback(gfx: Graphics, px: number, py: number): void {
        // Handsome Kung Fu Hero fallback on Graphics
        // Bald head with martial dots
        gfx.fillColor = hexToColor('#E8A87C', 255);
        gfx.circle(px, py + 55, 18);
        gfx.fill();

        // Eyes
        gfx.fillColor = hexToColor('#1a1a24', 255);
        gfx.circle(px + 4, py + 57, 2.5);
        gfx.fill();
        gfx.circle(px + 11, py + 57, 2.5);
        gfx.fill();

        // Saffron gold sleeveless martial tunic
        gfx.fillColor = hexToColor('#E67E22', 255);
        gfx.roundRect(px - 14, py + 12, 28, 32, 6);
        gfx.fill();

        // Crimson red flowing hero scarf
        gfx.fillColor = hexToColor('#C0392B', 255);
        gfx.roundRect(px - 16, py + 38, 32, 8, 4);
        gfx.fill();
        gfx.beginPath();
        gfx.moveTo(px - 14, py + 42);
        gfx.lineTo(px - 32, py + 32 + Math.sin(this._animTimer * 4) * 6);
        gfx.lineTo(px - 14, py + 36);
        gfx.fill();

        // Dark kung fu trousers
        gfx.fillColor = hexToColor('#2C3E50', 255);
        if (this.kickFrame >= 2) {
            if (this.currentKickType === 'bicycle') {
                // 倒挂金钩：双腿朝天后背朝地
                gfx.roundRect(px - 8, py + 16, 12, 26, 4);
                gfx.fill();
                gfx.roundRect(px + 6, py + 22, 12, 26, 4);
                gfx.fill();
            } else if (this.currentKickType === 'spin') {
                // 旋风回旋踢：横扫踢腿
                gfx.roundRect(px - 14, py + 10, 32, 12, 4);
                gfx.fill();
            } else {
                // 飞龙侧踢
                gfx.roundRect(px - 10, py, 12, 18, 4);
                gfx.fill();
                gfx.roundRect(px + 4, py + 6, 26, 12, 4);
                gfx.fill();
            }
        } else {
            // Ready stance
            gfx.roundRect(px - 12, py - 10, 10, 24, 3);
            gfx.fill();
            gfx.roundRect(px + 2, py - 10, 10, 24, 3);
            gfx.fill();
        }
    }
}
