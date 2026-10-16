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

export interface ScarfNode {
    x: number;
    y: number;
    oldX: number;
    oldY: number;
}

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
 * - Verlet Integration Physics Scarf (新国风赤红水墨长围巾物理节点)
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

    // Flash-step dash shadow afterimages
    private _dashTrails: { x: number; y: number; alpha: number }[] = [];

    // Verlet Ribbon Physics Scarf Nodes (新国风赤红水墨长围巾物理节点)
    private _scarfNodes: ScarfNode[] = [];
    private readonly SCARF_SEG_COUNT: number = 16;
    private readonly SCARF_SEG_LEN: number = 6.4;

    constructor(x: number = 0, y: number = -240) {
        this.x = x;
        this.targetX = x;
        this.y = y;
        this._initHeroSprites();
        this._initScarf();
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
        this._dashTrails = [];
        this._initScarf();
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

    public flashStep(newX: number): void {
        const clampedX = Math.max(-185, Math.min(185, newX));
        const oldX = this.x;
        const dist = clampedX - oldX;
        if (Math.abs(dist) > 8) {
            for (let i = 1; i <= 3; i++) {
                this._dashTrails.push({
                    x: oldX + dist * (i / 4),
                    y: this.y,
                    alpha: 0.65 - i * 0.12
                });
            }
            // Whip scarf backwards with dramatic inertia!
            for (let i = 1; i < this._scarfNodes.length; i++) {
                this._scarfNodes[i].oldX += dist * 0.55;
            }
        }
        this.x = clampedX;
        this.targetX = clampedX;
        this.vx = 0;
    }

    private _initScarf(): void {
        this._scarfNodes = [];
        const rootX = this.x - 4;
        const rootY = this.y + 36;
        for (let i = 0; i < this.SCARF_SEG_COUNT; i++) {
            this._scarfNodes.push({
                x: rootX - i * this.SCARF_SEG_LEN,
                y: rootY - i * 1.2,
                oldX: rootX - i * this.SCARF_SEG_LEN,
                oldY: rootY - i * 1.2,
            });
        }
    }

    private _updateScarfPhysics(): void {
        if (this._scarfNodes.length === 0) {
            this._initScarf();
            return;
        }

        // Determine neck attachment point in Cocos coords
        let neckX = this.x - 4;
        let neckY = this.y + 36;

        const isKicking = this.kickFrame >= 2;
        const progress = 1 - (this.kickTimer / (this.maxKickTimer || 20));

        if (isKicking) {
            if (this.currentKickType === 'bicycle') {
                const jumpY = 82 * Math.sin(Math.min(1, progress * 1.35) * Math.PI);
                neckX = this.x - 12 + progress * 10;
                neckY = this.y + jumpY + 16;
            } else if (this.currentKickType === 'spin') {
                const jumpY = 52 * Math.sin(progress * Math.PI);
                const spinAngle = progress * Math.PI * 2;
                neckX = this.x + Math.sin(spinAngle) * 8;
                neckY = this.y + jumpY + 30;
            } else if (this.currentKickType === 'side') {
                const jumpY = 38 * Math.sin(Math.min(1, progress * 1.5) * Math.PI);
                neckX = this.x - 16 + progress * 12;
                neckY = this.y + jumpY + 30;
            } else {
                neckX = this.x - 4;
                neckY = this.y + 45 + 32;
            }
        } else if (this.isCharging) {
            neckX = this.x - 6;
            neckY = this.y + 26;
        } else {
            const hopPhase = (this._animTimer * 6.5) % (Math.PI * 2);
            const hopY = Math.max(0, Math.sin(hopPhase)) * 4.8 + Math.sin(hopPhase * 2) * 1.5;
            const swayX = Math.sin(this._animTimer * 3.2) * 2.8;
            neckX = this.x - 4 + swayX;
            neckY = this.y + 36 + hopY;
        }

        // Pin root node
        this._scarfNodes[0].x = neckX;
        this._scarfNodes[0].y = neckY;

        // Verlet integration for nodes 1..N-1
        for (let i = 1; i < this._scarfNodes.length; i++) {
            const node = this._scarfNodes[i];
            const vx = (node.x - node.oldX) * 0.88;
            const vy = (node.y - node.oldY) * 0.88;

            const moveWindX = -this.vx * 0.65;
            const ambientWaveX = -1.8 + Math.sin(this._animTimer * 5.5 + i * 0.45) * 1.5;
            const ambientWaveY = Math.cos(this._animTimer * 4.8 + i * 0.38) * 0.9 - 0.35;

            let actionForceX = 0;
            let actionForceY = 0;
            if (isKicking) {
                if (this.currentKickType === 'bicycle') {
                    actionForceY = -3.8;
                    actionForceX = -3.2;
                } else if (this.currentKickType === 'spin') {
                    const spinT = (progress - 0.18) / 0.52;
                    const swirlAngle = (spinT * Math.PI * 2) - (i * 0.32);
                    actionForceX = Math.cos(swirlAngle) * 5.5;
                    actionForceY = Math.sin(swirlAngle) * 4.2;
                } else if (this.currentKickType === 'side') {
                    actionForceX = -5.8;
                    actionForceY = 1.2;
                }
            }

            node.oldX = node.x;
            node.oldY = node.y;
            node.x += vx + moveWindX + ambientWaveX + actionForceX;
            node.y += vy + ambientWaveY + actionForceY;
        }

        // Distance constraint relaxation (5 iterations)
        for (let iter = 0; iter < 5; iter++) {
            for (let i = 0; i < this._scarfNodes.length - 1; i++) {
                const p1 = this._scarfNodes[i];
                const p2 = this._scarfNodes[i + 1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.hypot(dx, dy) || 1;
                const diff = (dist - this.SCARF_SEG_LEN) / dist;

                if (i === 0) {
                    p2.x -= dx * diff;
                    p2.y -= dy * diff;
                } else {
                    p1.x += dx * diff * 0.45;
                    p1.y += dy * diff * 0.45;
                    p2.x -= dx * diff * 0.55;
                    p2.y -= dy * diff * 0.55;
                }
            }
        }
    }

    public update(): void {
        this._animTimer += 0.08;

        // Decay dash shadow trails
        for (let i = this._dashTrails.length - 1; i >= 0; i--) {
            this._dashTrails[i].alpha -= 0.09;
            if (this._dashTrails[i].alpha <= 0) {
                this._dashTrails.splice(i, 1);
            }
        }

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

        // Real-Time Verlet Physics Integration for the Flowing Scarf
        this._updateScarfPhysics();
    }

    public draw(gfx: Graphics, ctx?: CanvasRenderingContext2D | null): void {
        const px = this.x;
        // Bruce Lee Jeet Kune Do rhythmic butterfly footwork hop (轻快敏捷碎步跳跃)
        let hopY = 0;
        let swayX = 0;

        if (this.kickFrame === 0 && !this.isCharging) {
            if (this._isGesturing) {
                hopY = 1.5;
                swayX = 2.0;
            } else {
                const hopPhase = (this._animTimer * 6.5) % (Math.PI * 2);
                hopY = Math.max(0, Math.sin(hopPhase)) * 4.8 + Math.sin(hopPhase * 2) * 1.5;
                swayX = Math.sin(this._animTimer * 3.2) * 2.8;
            }
        } else if (this.isCharging) {
            hopY = -6.0;
            swayX = (Math.random() - 0.5) * 2.2;
        }

        const py = this.y + hopY;
        const currentPx = px + swayX;

        // 1. Dynamic shadow on Graphics (stretches & shrinks with hops and jumps)
        this._drawShadow(gfx, px, this.y, hopY);

        // 2. Battle Qi Aura (Golden flames & dragon sparks) on Graphics
        if (this.isCharging || this.auraAlpha > 0.04 || this.isSuper) {
            this._drawAura(gfx, currentPx, py);
        }

        // 3. Draw on 2D Overlay Canvas
        if (ctx) {
            const cw = ctx.canvas.width;
            const ch = ctx.canvas.height;
            const scale = Math.min(cw / 440, ch / 780);
            const cx = cw / 2 + currentPx * scale;
            const cy = ch / 2 - py * scale;

            ctx.save();

            // 2.5. Flash-Step Dash Shadow Afterimages (瞬步墨影残影)
            for (const dt of this._dashTrails) {
                if (dt.alpha <= 0) continue;
                const trailCx = cw / 2 + dt.x * scale;
                const trailCy = ch / 2 - py * scale;
                ctx.save();
                ctx.globalAlpha = dt.alpha * 0.42;
                ctx.shadowColor = '#00E5FF';
                ctx.shadowBlur = 10 * scale;
                this._drawIdleNinja(ctx, trailCx, trailCy, scale);
                ctx.restore();
            }

            if (this.kickFrame >= 2) {
                // ── A. Multi-Action Martial Arts Kicks (四段式真实武术起承转合) ──
                const progress = 1 - (this.kickTimer / (this.maxKickTimer || 20));
                switch (this.currentKickType) {
                    case 'bicycle':
                        this._drawArticulatedBicycleKick(ctx, cx, cy, scale, progress);
                        break;
                    case 'spin':
                        this._drawArticulatedSpinKick(ctx, cx, cy, scale, progress);
                        break;
                    case 'shadowless':
                        this._drawArticulatedShadowlessKick(ctx, cx, cy, scale, progress);
                        break;
                    case 'side':
                    default:
                        this._drawArticulatedSideKick(ctx, cx, cy, scale, progress);
                        break;
                }
                this._drawInkBrushSmear(ctx, cx, cy, scale);
            } else {
                // ── B. Neo-Ink Wash Shaolin Shadow Ninja Guard Stance ──
                this._drawIdleNinja(ctx, cx, cy, scale);
                this._drawSoccerBallAtFoot(ctx, cx, cy, scale);
            }

            // ── C. Universal Verlet Ribbon Physics Scarf (跨越所有动作的物理水墨流体长围巾) ──
            this._drawVerletScarf(ctx, scale);

            ctx.restore();
        } else {
            // Fallback: draw stylish Shaolin monk on Graphics if 2D context not available
            this._drawVectorFallback(gfx, currentPx, py);
        }

        // 4. Specialized foot energy flash & martial VFX
        if (this.kickFrame >= 2) {
            this._drawKickVFX(gfx);
        }
    }

    private _drawArticulatedBicycleKick(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        progress: number
    ): void {
        // ── 倒挂金钩·凌空背跃双脚踢出 (四段式物理姿态) ──
        let jumpY = 0;
        let jumpX = 0;
        let bodyAngle = 0;
        let leadLegAngle = -Math.PI * 0.46; // ~-83° straight up
        let followLegAngle = -Math.PI * 0.58; // ~-105°
        let kneeBend = 0;

        if (progress < 0.20) {
            // 预备蓄力：深蹲压缩 (Squash)
            const t = progress / 0.20;
            jumpY = 8 * Math.sin(t * Math.PI) * scale;
            bodyAngle = 0.22 * Math.sin(t * Math.PI);
            leadLegAngle = -Math.PI * 0.25;
            followLegAngle = -Math.PI * 0.35;
            kneeBend = 1.0;
        } else if (progress < 0.65) {
            // 腾空绝杀：大弧度倒挂金钩！(Snap & Extension)
            const t = (progress - 0.20) / 0.45;
            jumpY = -84 * Math.sin(t * Math.PI * 0.95) * scale;
            jumpX = (12 * t) * scale;
            bodyAngle = -2.25 + 0.15 * Math.sin(t * Math.PI);
            kneeBend = Math.max(0, 1 - t * 2.5); // 膝盖从屈膝瞬间弹直！
        } else {
            // 受身落地：空中团身翻滚 (Roll & Cushion)
            const t = (progress - 0.65) / 0.35;
            jumpY = -84 * (1 - t) * scale;
            jumpX = (12 + 16 * t) * scale;
            bodyAngle = -2.25 - t * Math.PI * 1.2;
        }

        const activeCx = cx + jumpX;
        const activeCy = cy + jumpY;

        ctx.save();
        ctx.translate(activeCx, activeCy);
        ctx.rotate(bodyAngle);

        const kickScale = (this.isSuper ? 1.18 : 1.08) * scale;
        ctx.scale(kickScale, kickScale);

        // 1. 剪刀双飞残影
        if (progress >= 0.20 && progress <= 0.65) {
            ctx.save();
            ctx.translate(-8 * scale, 12 * scale);
            ctx.globalAlpha = 0.38;
            ctx.shadowColor = this.isSuper ? '#FFD700' : '#FF4757';
            ctx.shadowBlur = 14 * scale;
            this._drawInvertedNinjaBody(ctx, scale, leadLegAngle - 0.12, followLegAngle - 0.12, 0);
            ctx.restore();
        }

        // 2. 主体倒挂身躯与伸展双腿
        this._drawInvertedNinjaBody(ctx, scale, leadLegAngle, followLegAngle, kneeBend);

        ctx.restore();

        // 3. 双脚脚尖双喷射天火火箭尾焰与冲击波
        if (progress >= 0.20 && progress < 0.75) {
            const foot1X = activeCx + 38 * scale;
            const foot1Y = activeCy - 62 * scale;
            const foot2X = activeCx + 18 * scale;
            const foot2Y = activeCy - 48 * scale;

            this._drawFootFlameJet(ctx, foot1X, foot1Y, scale, this.isSuper);
            this._drawFootFlameJet(ctx, foot2X, foot2Y, scale * 0.85, this.isSuper);

            this._drawKickBallBlast(ctx, foot1X + 8 * scale, foot1Y - 12 * scale, scale, -Math.PI * 0.48, progress, this.isSuper);
        }
    }

    private _drawInvertedNinjaBody(
        ctx: CanvasRenderingContext2D,
        scale: number,
        leg1Angle: number,
        leg2Angle: number,
        kneeBend: number
    ): void {
        // Torso: Athletic combat tunic
        ctx.fillStyle = '#151D2A';
        ctx.beginPath();
        ctx.moveTo(-14 * scale, -10 * scale);
        ctx.lineTo(14 * scale, -10 * scale);
        ctx.lineTo(10 * scale, 20 * scale);
        ctx.lineTo(-12 * scale, 20 * scale);
        ctx.closePath();
        ctx.fill();

        // Shaolin Golden Belt
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(-13 * scale, 16 * scale, 24 * scale, 4.5 * scale);
        ctx.fillStyle = '#F39C12';
        ctx.fillRect(-13 * scale, 17 * scale, 24 * scale, 2 * scale);

        // Head & Cowl
        ctx.fillStyle = '#0F1520';
        ctx.beginPath();
        ctx.arc(-2 * scale, -22 * scale, 12 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Razor Eye Visor Flare
        const eyeColor = this.isSuper ? '#FF3838' : '#FFD700';
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 12 * scale;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(2 * scale, -23 * scale);
        ctx.lineTo(10 * scale, -21 * scale);
        ctx.lineTo(8 * scale, -19 * scale);
        ctx.lineTo(1 * scale, -21 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = eyeColor;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(-2 * scale, -22 * scale);
        ctx.lineTo(16 * scale, -20 * scale);
        ctx.stroke();

        // Arms in Acrobat Balance Guard
        ctx.fillStyle = '#111722';
        ctx.beginPath();
        ctx.moveTo(-12 * scale, -8 * scale);
        ctx.lineTo(-24 * scale, 6 * scale);
        ctx.lineTo(-18 * scale, 18 * scale);
        ctx.lineTo(-8 * scale, 4 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#1B2332';
        ctx.beginPath();
        ctx.moveTo(10 * scale, -8 * scale);
        ctx.lineTo(22 * scale, 2 * scale);
        ctx.lineTo(16 * scale, 14 * scale);
        ctx.lineTo(6 * scale, 4 * scale);
        ctx.closePath();
        ctx.fill();

        // ── Leg 2 (Rear scissor leg) ──
        ctx.save();
        ctx.translate(-4 * scale, 20 * scale);
        ctx.rotate(leg2Angle + Math.PI / 2);
        this._drawNinjaLimb(ctx, scale, 28 * scale, 30 * scale, kneeBend * 0.4, '#111722');
        ctx.restore();

        // ── Leg 1 (Lead kicking leg) ──
        ctx.save();
        ctx.translate(4 * scale, 20 * scale);
        ctx.rotate(leg1Angle + Math.PI / 2);
        this._drawNinjaLimb(ctx, scale, 32 * scale, 32 * scale, kneeBend * 0.2, '#18202D');
        ctx.restore();
    }

    private _drawArticulatedSpinKick(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        progress: number
    ): void {
        // ── 360° 狂暴旋风回旋踢·神龙摆尾 ──
        let jumpY = 0;
        let spinAngle = 0;

        if (progress < 0.18) {
            const t = progress / 0.18;
            jumpY = 6 * Math.sin(t * Math.PI) * scale;
            spinAngle = -0.35 * Math.sin(t * Math.PI * 0.5);
        } else if (progress < 0.70) {
            const t = (progress - 0.18) / 0.52;
            jumpY = -52 * Math.sin(t * Math.PI) * scale;
            spinAngle = t * Math.PI * 2;
        } else {
            const t = (progress - 0.70) / 0.30;
            jumpY = -12 * (1 - t) * scale;
            spinAngle = Math.PI * 2 + 0.15 * (1 - t);
        }

        const activeCx = cx;
        const activeCy = cy + jumpY;
        const kickScale = (this.isSuper ? 1.16 : 1.06) * scale;

        // 1. 360° 旋风残影
        if (progress >= 0.18 && progress <= 0.70) {
            for (const ghost of [{ angleOffset: -0.38, alpha: 0.35, color: '#00E5FF' }, { angleOffset: -0.72, alpha: 0.22, color: '#FFD700' }]) {
                ctx.save();
                ctx.translate(activeCx, activeCy);
                ctx.rotate(spinAngle + ghost.angleOffset);
                ctx.scale(kickScale * 0.94, kickScale * 0.94);
                ctx.globalAlpha = ghost.alpha;
                ctx.shadowColor = ghost.color;
                ctx.shadowBlur = 14 * scale;
                this._drawSpinningNinjaBody(ctx, scale);
                ctx.restore();
            }
        }

        // 2. 回旋踢主体
        ctx.save();
        ctx.translate(activeCx, activeCy);
        ctx.rotate(spinAngle);
        ctx.scale(kickScale, kickScale);
        ctx.shadowColor = this.isSuper ? '#FFE600' : '#FF9F1C';
        ctx.shadowBlur = (this.isSuper ? 16 : 10) * scale;
        this._drawSpinningNinjaBody(ctx, scale);
        ctx.restore();

        // 3. 旋风足尖烈焰与抽球冲击波
        if (progress >= 0.25 && progress < 0.75) {
            const footX = activeCx + Math.cos(spinAngle) * 44 * scale;
            const footY = activeCy + Math.sin(spinAngle) * 44 * scale;
            this._drawFootFlameJet(ctx, footX, footY, scale, this.isSuper);
            this._drawKickBallBlast(ctx, footX + 10 * scale, footY - 10 * scale, scale, -0.65, progress, this.isSuper);
        }
    }

    private _drawSpinningNinjaBody(ctx: CanvasRenderingContext2D, scale: number): void {
        // Torso
        ctx.fillStyle = '#151D2A';
        ctx.beginPath();
        ctx.arc(0, 0, 11 * scale, 0, Math.PI * 2);
        ctx.fill();

        // Golden belt
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(-8 * scale, -2 * scale, 16 * scale, 4 * scale);

        // Head with glowing eye visor
        ctx.fillStyle = '#0F1520';
        ctx.beginPath();
        ctx.arc(0, -18 * scale, 11 * scale, 0, Math.PI * 2);
        ctx.fill();

        const eyeColor = this.isSuper ? '#FF3838' : '#FFD700';
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 10 * scale;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(1 * scale, -19 * scale, 7 * scale, 2.5 * scale);

        // Tucked support leg
        ctx.fillStyle = '#111722';
        ctx.beginPath();
        ctx.moveTo(-4 * scale, 6 * scale);
        ctx.lineTo(-14 * scale, 14 * scale);
        ctx.lineTo(-8 * scale, 22 * scale);
        ctx.lineTo(0, 10 * scale);
        ctx.closePath();
        ctx.fill();

        // Horizontal whipping kicking leg
        ctx.fillStyle = '#18202D';
        ctx.beginPath();
        ctx.moveTo(4 * scale, -3 * scale);
        ctx.lineTo(42 * scale, -3 * scale);
        ctx.lineTo(42 * scale, 5 * scale);
        ctx.lineTo(4 * scale, 5 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(28 * scale, -4 * scale, 10 * scale, 8 * scale);
        ctx.fillStyle = '#0B0F15';
        ctx.fillRect(38 * scale, -5 * scale, 10 * scale, 10 * scale);
    }

    private _drawArticulatedSideKick(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        progress: number
    ): void {
        // ── 飞龙侧踢·力透千钧 ──
        let jumpY = 0;
        let glideX = 0;
        let chamberT = 0;

        if (progress < 0.20) {
            const t = progress / 0.20;
            jumpY = 6 * Math.sin(t * Math.PI) * scale;
            glideX = -4 * t * scale;
            chamberT = t;
        } else if (progress < 0.75) {
            const t = (progress - 0.20) / 0.55;
            jumpY = -40 * Math.sin(Math.min(1, t * 1.4) * Math.PI) * scale;
            glideX = (22 * Math.sin(Math.min(1, t * 1.2) * Math.PI * 0.5)) * scale;
            chamberT = 1.0;
        } else {
            const t = (progress - 0.75) / 0.25;
            jumpY = -14 * (1 - t) * scale;
            glideX = (22 * (1 - t * 0.4)) * scale;
            chamberT = 1 - t;
        }

        const activeCx = cx + glideX;
        const activeCy = cy + jumpY;
        const kickScale = (this.isSuper ? 1.18 : 1.08) * scale;

        ctx.save();
        ctx.translate(activeCx, activeCy);
        const bodyLean = progress >= 0.20 ? -0.22 : 0;
        ctx.rotate(bodyLean);
        ctx.scale(kickScale, kickScale);

        // Support Leg
        ctx.fillStyle = '#111722';
        ctx.beginPath();
        ctx.moveTo(-10 * scale, 4 * scale);
        ctx.lineTo(-24 * scale, 18 * scale);
        ctx.lineTo(-30 * scale, 34 * scale);
        ctx.lineTo(-18 * scale, 34 * scale);
        ctx.lineTo(-14 * scale, 22 * scale);
        ctx.lineTo(-2 * scale, 4 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(-28 * scale, 24 * scale, 10 * scale, 8 * scale);
        ctx.fillStyle = '#0B0F15';
        ctx.fillRect(-31 * scale, 32 * scale, 14 * scale, 5 * scale);

        // Torso
        ctx.fillStyle = '#151D2A';
        ctx.beginPath();
        ctx.moveTo(-16 * scale, -22 * scale);
        ctx.lineTo(12 * scale, -22 * scale);
        ctx.lineTo(8 * scale, 6 * scale);
        ctx.lineTo(-12 * scale, 6 * scale);
        ctx.closePath();
        ctx.fill();

        // Shaolin Golden Belt
        ctx.fillStyle = '#E67E22';
        ctx.fillRect(-12 * scale, 3 * scale, 22 * scale, 5 * scale);

        // Head with eye visor
        ctx.fillStyle = '#0F1520';
        ctx.beginPath();
        ctx.arc(-2 * scale, -34 * scale, 12 * scale, 0, Math.PI * 2);
        ctx.fill();

        const eyeColor = this.isSuper ? '#FF3838' : '#FFD700';
        ctx.shadowColor = eyeColor;
        ctx.shadowBlur = 12 * scale;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(1 * scale, -34 * scale, 8 * scale, 2.5 * scale);

        // Arms in Jeet Kune Do Guard
        ctx.fillStyle = '#1B2332';
        ctx.beginPath();
        ctx.moveTo(-14 * scale, -18 * scale);
        ctx.lineTo(-24 * scale, -6 * scale);
        ctx.lineTo(-16 * scale, 2 * scale);
        ctx.closePath();
        ctx.fill();

        // Kicking Leg (Thrusts like a spear)
        const extend = progress < 0.20 ? chamberT * 25 : progress < 0.75 ? 58 : 58 - (progress - 0.75) * 80;
        const heelX = extend * scale;
        const heelY = (-12 + (progress >= 0.20 ? -16 : 0)) * scale;

        ctx.fillStyle = '#18202D';
        ctx.beginPath();
        ctx.moveTo(4 * scale, -6 * scale);
        ctx.lineTo(heelX * 0.45, heelY * 0.5 - 6 * scale);
        ctx.lineTo(heelX, heelY);
        ctx.lineTo(heelX - 4 * scale, heelY + 8 * scale);
        ctx.lineTo(heelX * 0.45, heelY * 0.5 + 4 * scale);
        ctx.lineTo(0, 4 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(heelX - 16 * scale, heelY - 4 * scale, 12 * scale, 7 * scale);
        ctx.fillStyle = '#0B0F15';
        ctx.fillRect(heelX - 6 * scale, heelY - 5 * scale, 14 * scale, 8 * scale);

        ctx.restore();

        // Foot fire & blast
        if (progress >= 0.20 && progress < 0.75) {
            const footX = activeCx + 56 * scale;
            const footY = activeCy - 28 * scale;
            this._drawFootFlameJet(ctx, footX, footY, scale, this.isSuper);
            this._drawKickBallBlast(ctx, footX + 12 * scale, footY - 8 * scale, scale, -0.52, progress, this.isSuper);
        }
    }

    private _drawArticulatedShadowlessKick(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        progress: number
    ): void {
        const midAirY = -46 * scale;
        const vibX = Math.sin(this.kickTimer * 3.5) * 12 * scale;
        const activeCx = cx + vibX;
        const activeCy = cy + midAirY;
        const kickScale = (this.isSuper ? 1.20 : 1.10) * scale;

        const ghosts = [
            { offX: -24 * scale, offY: 4 * scale, alpha: 0.35, color: '#00E5FF' },
            { offX: -12 * scale, offY: -4 * scale, alpha: 0.50, color: '#FF3838' },
            { offX: 14 * scale, offY: 2 * scale, alpha: 0.50, color: '#FFD700' }
        ];

        for (const g of ghosts) {
            ctx.save();
            ctx.translate(activeCx + g.offX, activeCy + g.offY);
            ctx.scale(kickScale, kickScale);
            ctx.globalAlpha = g.alpha;
            ctx.shadowColor = g.color;
            ctx.shadowBlur = 12 * scale;
            this._drawShadowlessPose(ctx, scale, this.kickTimer % 2 === 0);
            ctx.restore();
        }

        ctx.save();
        ctx.translate(activeCx, activeCy);
        ctx.scale(kickScale, kickScale);
        ctx.shadowColor = '#FFE600';
        ctx.shadowBlur = 14 * scale;
        this._drawShadowlessPose(ctx, scale, this.kickTimer % 2 !== 0);
        ctx.restore();

        if (progress < 0.75) {
            this._drawFootFlameJet(ctx, activeCx + 42 * scale, activeCy - 24 * scale, scale, this.isSuper);
            this._drawKickBallBlast(ctx, activeCx + 48 * scale, activeCy - 28 * scale, scale, -0.55, progress, this.isSuper);
        }
    }

    private _drawShadowlessPose(ctx: CanvasRenderingContext2D, scale: number, alt: boolean): void {
        ctx.fillStyle = '#151D2A';
        ctx.fillRect(-12 * scale, -20 * scale, 22 * scale, 24 * scale);

        ctx.fillStyle = '#0F1520';
        ctx.beginPath();
        ctx.arc(-1 * scale, -32 * scale, 11 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(1 * scale, -32 * scale, 7 * scale, 2 * scale);

        const leg1Y = alt ? -18 * scale : 6 * scale;
        const leg2Y = alt ? 6 * scale : -18 * scale;

        ctx.fillStyle = '#18202D';
        ctx.fillRect(4 * scale, leg1Y, 36 * scale, 6 * scale);
        ctx.fillRect(-4 * scale, leg2Y, 32 * scale, 6 * scale);

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(28 * scale, leg1Y, 8 * scale, 6 * scale);
        ctx.fillRect(22 * scale, leg2Y, 8 * scale, 6 * scale);
    }

    private _drawNinjaLimb(
        ctx: CanvasRenderingContext2D,
        scale: number,
        thighLen: number,
        shinLen: number,
        bendFactor: number,
        color: string
    ): void {
        const bendOffset = bendFactor * 14 * scale;
        const kneeX = bendOffset;
        const kneeY = thighLen;
        const footX = bendOffset * 0.5;
        const footY = thighLen + shinLen;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(-6 * scale, 0);
        ctx.lineTo(6 * scale, 0);
        ctx.lineTo(kneeX + 5 * scale, kneeY);
        ctx.lineTo(kneeX - 5 * scale, kneeY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(kneeX - 5 * scale, kneeY);
        ctx.lineTo(kneeX + 5 * scale, kneeY);
        ctx.lineTo(footX + 4 * scale, footY);
        ctx.lineTo(footX - 4 * scale, footY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(kneeX - 4 * scale, kneeY + 6 * scale, 8 * scale, 14 * scale);
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 1.0 * scale;
        ctx.strokeRect(kneeX - 4 * scale, kneeY + 6 * scale, 8 * scale, 14 * scale);

        ctx.fillStyle = '#0B0F15';
        ctx.beginPath();
        ctx.moveTo(footX - 5 * scale, footY);
        ctx.lineTo(footX + 11 * scale, footY);
        ctx.lineTo(footX + 8 * scale, footY + 7 * scale);
        ctx.lineTo(footX - 5 * scale, footY + 7 * scale);
        ctx.closePath();
        ctx.fill();
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

    /**
     * Neo-Ink Wash Calligraphic Brush Smear Arc (新国风狂草墨斩气刃弧光)
     * High-speed dynamic crescent ink blade swept across foot kick trajectory
     */
    private _drawInkBrushSmear(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
        const progress = 1 - (this.kickTimer / (this.maxKickTimer || 20));
        if (progress > 0.85) return;

        ctx.save();
        const strokeAlpha = Math.max(0, 1 - progress * 1.15);
        ctx.globalAlpha = strokeAlpha;

        switch (this.currentKickType) {
            case 'bicycle': {
                // Ascending crescent ink blade shooting up to the sky
                const startX = cx - 20 * scale;
                const startY = cy + 10 * scale;
                const tipX = cx + 55 * scale;
                const tipY = cy - 95 * scale;
                const cpX = cx + 60 * scale;
                const cpY = cy - 10 * scale;

                ctx.shadowColor = this.isSuper ? '#FFD700' : '#FF3838';
                ctx.shadowBlur = 18 * scale;

                // 1. Thick Black Calligraphy Ink Body (浓墨狂草剑气)
                ctx.fillStyle = '#0F172A';
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
                ctx.quadraticCurveTo(cpX - 25 * scale, cpY - 30 * scale, startX - 10 * scale, startY - 20 * scale);
                ctx.closePath();
                ctx.fill();

                // 2. Burning Qi Core (炎刃流光)
                ctx.strokeStyle = this.isSuper ? '#FFF9D2' : '#FFE600';
                ctx.lineWidth = 3.5 * scale;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(cpX - 8 * scale, cpY - 12 * scale, tipX, tipY);
                ctx.stroke();

                // 3. Flying Ink Droplets (墨滴飞溅)
                for (let k = 0; k < 5; k++) {
                    const ratio = 0.3 + k * 0.15;
                    const dx = startX + (tipX - startX) * ratio + (k % 2 === 0 ? 8 : -8) * scale;
                    const dy = startY + (tipY - startY) * ratio + (Math.sin(k) * 10) * scale;
                    ctx.fillStyle = '#0F172A';
                    ctx.beginPath();
                    ctx.arc(dx, dy, (2.5 + (k % 3)) * scale, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            }

            case 'spin': {
                // 360° Whirlwind Ink Vortex Smear (环形泼墨气旋)
                ctx.translate(cx, cy - 25 * scale);
                const r = 70 * scale;
                const rotStart = progress * Math.PI * 3.5;
                const rotEnd = rotStart + Math.PI * 1.35;

                ctx.shadowColor = this.isSuper ? '#00E5FF' : '#FF9F1C';
                ctx.shadowBlur = 16 * scale;

                ctx.strokeStyle = '#0B132B';
                ctx.lineWidth = 14 * scale;
                ctx.beginPath();
                ctx.arc(0, 0, r, rotStart, rotEnd);
                ctx.stroke();

                ctx.strokeStyle = this.isSuper ? '#E0F2FE' : '#FFD700';
                ctx.lineWidth = 3.5 * scale;
                ctx.beginPath();
                ctx.arc(0, 0, r, rotStart + 0.2, rotEnd - 0.1);
                ctx.stroke();
                break;
            }

            case 'side':
            case 'shadowless':
            default: {
                // Forward Sickle Ink Slash (凌空侧踢横扫墨刃)
                const startX = cx - 15 * scale;
                const startY = cy + 20 * scale;
                const tipX = cx + 85 * scale;
                const tipY = cy - 40 * scale;
                const cpX = cx + 45 * scale;
                const cpY = cy + 35 * scale;

                ctx.shadowColor = this.isSuper ? '#FFD700' : '#FF4757';
                ctx.shadowBlur = 16 * scale;

                ctx.fillStyle = '#0F172A';
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
                ctx.quadraticCurveTo(cpX - 15 * scale, cpY - 25 * scale, startX, startY - 10 * scale);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = this.isSuper ? '#FFFBEB' : '#FFA502';
                ctx.lineWidth = 3.0 * scale;
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.quadraticCurveTo(cpX, cpY - 5 * scale, tipX, tipY);
                ctx.stroke();
                break;
            }
        }
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
     * - Sleek dark shinobi martial body with agile footwork bounce
     * - Shaolin golden martial sash belt & clean white leg wraps
     * - Ready martial guard arms
     * - Razor-sharp glowing amber/crimson visor eyes with streak
     */
    private _drawIdleNinja(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number = 1.0): void {
        const px = cx;
        const crouchY = (this.isCharging ? 6 : 0) * scale;
        const py = cy - 25 * scale + crouchY;

        ctx.save();
        ctx.translate(px, py);

        const anim = this._animTimer;
        const hop = this.isCharging ? 0 : Math.sin(anim * 6.5) * 1.8 * scale;
        const sway = this.isCharging ? (Math.random() - 0.5) * 1.5 * scale : Math.sin(anim * 3.2) * 1.2 * scale;

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

        // Ninja Combat Sneakers
        ctx.fillStyle = '#0B0F15';
        ctx.fillRect(-27 * scale, 32 * scale, 15 * scale, 5 * scale);
        ctx.fillRect(14 * scale, 30 * scale, 16 * scale, 5 * scale);

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
        ctx.fillStyle = '#111722';
        ctx.beginPath();
        ctx.moveTo(-14 * scale, -22 * scale);
        ctx.lineTo(-24 * scale, -8 * scale);
        ctx.lineTo(-18 * scale, 2 * scale);
        ctx.lineTo(-12 * scale, -6 * scale);
        ctx.closePath();
        ctx.fill();

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

        ctx.beginPath();
        ctx.moveTo(-12 * scale, -32 * scale);
        ctx.lineTo(2 * scale, -20 * scale);
        ctx.lineTo(11 * scale, -32 * scale);
        ctx.closePath();
        ctx.fill();

        // Glowing Razor-Sharp Eye Visor Flare
        const eyeGlowColor = this.isSuper ? '#FF3838' : '#FFD700';
        const eyeCoreColor = '#FFFFFF';
        ctx.shadowColor = eyeGlowColor;
        ctx.shadowBlur = (this.isCharging ? 16 : 10) * scale;

        ctx.fillStyle = eyeCoreColor;
        ctx.beginPath();
        ctx.moveTo(1 * scale, -34 * scale);
        ctx.lineTo(9 * scale, -32 * scale);
        ctx.lineTo(7 * scale, -30 * scale);
        ctx.lineTo(0, -32 * scale);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = eyeGlowColor;
        ctx.lineWidth = 1.8 * scale;
        ctx.beginPath();
        ctx.moveTo(-3 * scale, -33 * scale);
        ctx.lineTo(16 * scale, -31 * scale);
        ctx.stroke();

        ctx.restore();
        ctx.restore();
    }

    /**
     * The Waiting Soccer Ball at Foot (足边蓄势待发足球)
     */
    private _drawSoccerBallAtFoot(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number = 1.0): void {
        const px = cx;
        const crouchY = (this.isCharging ? 6 : 0) * scale;
        const py = cy - 25 * scale + crouchY;

        ctx.save();
        ctx.translate(px, py);

        const anim = this._animTimer;
        const ballX = 22 * scale;
        const ballY = 24 * scale;
        const ballR = 13 * scale;

        // Ball ground contact shadow
        ctx.save();
        ctx.fillStyle = 'rgba(10, 15, 25, 0.45)';
        ctx.translate(ballX, ballY + ballR * 0.9);
        ctx.scale(1, 0.38);
        ctx.beginPath();
        ctx.arc(0, 0, ballR * 0.9, 0, Math.PI * 2);
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

        // Soccer ball pentagons
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
        ctx.restore();
    }

    /**
     * Universal Verlet Ribbon Physics Scarf (跨越所有动作的物理水墨流体长围巾)
     * - 16 Verlet nodes simulation with wind and aerodynamic physics
     * - Smooth Catmull/Bezier normal curves
     * - Swallowtail ribbon tip with trailing flame embers & calligraphy droplets
     */
    private _drawVerletScarf(ctx: CanvasRenderingContext2D, scale: number = 1.0): void {
        if (!this._scarfNodes || this._scarfNodes.length < 2) return;

        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;

        // Convert Cocos nodes to Canvas screen coords
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i < this._scarfNodes.length; i++) {
            const n = this._scarfNodes[i];
            pts.push({
                x: cw / 2 + n.x * scale,
                y: ch / 2 - n.y * scale,
            });
        }

        const leftPts: { x: number; y: number }[] = [];
        const rightPts: { x: number; y: number }[] = [];

        for (let i = 0; i < pts.length; i++) {
            let tx = 0, ty = 0;
            if (i === 0) {
                tx = pts[1].x - pts[0].x;
                ty = pts[1].y - pts[0].y;
            } else if (i === pts.length - 1) {
                tx = pts[pts.length - 1].x - pts[pts.length - 2].x;
                ty = pts[pts.length - 1].y - pts[pts.length - 2].y;
            } else {
                tx = pts[i + 1].x - pts[i - 1].x;
                ty = pts[i + 1].y - pts[i - 1].y;
            }

            const len = Math.hypot(tx, ty) || 1;
            const nx = -ty / len;
            const ny = tx / len;

            const t = i / (pts.length - 1);
            // Flaring width: starts at collar (~4px), expands to ~11px in middle, tapers to ~6px at tip
            const w = (3.6 + 8.2 * Math.sin(t * Math.PI * 0.9) * (1 - t * 0.25)) * scale;

            leftPts.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
            rightPts.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
        }

        ctx.save();
        ctx.shadowColor = '#C0392B';
        ctx.shadowBlur = 8 * scale;

        // ── Layer 1: Dark Crimson Deep Shadow Silk ──
        ctx.fillStyle = '#781515';
        ctx.beginPath();
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
            const mx = (leftPts[i - 1].x + leftPts[i].x) / 2;
            const my = (leftPts[i - 1].y + leftPts[i].y) / 2;
            ctx.quadraticCurveTo(leftPts[i - 1].x, leftPts[i - 1].y, mx, my);
        }

        // Forked swallowtail tip
        const tail = pts[pts.length - 1];
        const prevTail = pts[pts.length - 2];
        const tailDirX = tail.x - prevTail.x;
        const tailDirY = tail.y - prevTail.y;
        const tailLen = Math.hypot(tailDirX, tailDirY) || 1;
        const normTailX = -tailDirY / tailLen;
        const normTailY = tailDirX / tailLen;

        ctx.lineTo(tail.x + normTailX * 6 * scale, tail.y + normTailY * 6 * scale);
        ctx.lineTo(tail.x - tailDirX * 0.4, tail.y - tailDirY * 0.4);
        ctx.lineTo(tail.x - normTailX * 6 * scale, tail.y - normTailY * 6 * scale);

        for (let i = rightPts.length - 1; i >= 0; i--) {
            const nextIdx = i > 0 ? i - 1 : 0;
            const mx = (rightPts[i].x + rightPts[nextIdx].x) / 2;
            const my = (rightPts[i].y + rightPts[nextIdx].y) / 2;
            ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
        }
        ctx.closePath();
        ctx.fill();

        // ── Layer 2: Main Billowing Blood Red Ribbon Silk ──
        ctx.fillStyle = '#C0392B';
        ctx.beginPath();
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
            const mx = (leftPts[i - 1].x + leftPts[i].x) / 2;
            const my = (leftPts[i - 1].y + leftPts[i].y) / 2;
            ctx.quadraticCurveTo(leftPts[i - 1].x, leftPts[i - 1].y, mx, my);
        }
        ctx.lineTo(tail.x, tail.y);
        for (let i = rightPts.length - 1; i >= 0; i--) {
            const nextIdx = i > 0 ? i - 1 : 0;
            const mx = (rightPts[i].x + rightPts[nextIdx].x) / 2;
            const my = (rightPts[i].y + rightPts[nextIdx].y) / 2;
            ctx.quadraticCurveTo(rightPts[i].x, rightPts[i].y, mx, my);
        }
        ctx.closePath();
        ctx.fill();

        // ── Layer 3: Top Wind Crest Luminous Vermilion Highlight Streak ──
        ctx.strokeStyle = '#FF4757';
        ctx.lineWidth = 2.0 * scale;
        ctx.beginPath();
        ctx.moveTo(leftPts[0].x, leftPts[0].y);
        for (let i = 1; i < leftPts.length; i++) {
            const mx = (leftPts[i - 1].x + leftPts[i].x) / 2;
            const my = (leftPts[i - 1].y + leftPts[i].y) / 2;
            ctx.quadraticCurveTo(leftPts[i - 1].x, leftPts[i - 1].y, mx, my);
        }
        ctx.stroke();

        // ── Trailing Fire Embers floating off the scarf tail ──
        for (let k = 0; k < 5; k++) {
            const tailNode = pts[Math.max(0, pts.length - 1 - (k % 3))];
            const emberOffset = ((this._animTimer * 42 + k * 26) % 80);
            const ex = tailNode.x - emberOffset * 0.6 * scale;
            const ey = tailNode.y - emberOffset * 0.35 * scale + Math.sin(this._animTimer * 5.2 + k) * 5 * scale;
            const alpha = Math.max(0, 1 - emberOffset / 80);
            ctx.fillStyle = k % 2 === 0 ? `rgba(255, 71, 87, ${alpha})` : `rgba(255, 215, 0, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(ex, ey, (2.2 - k * 0.35) * scale, 0, Math.PI * 2);
            ctx.fill();
        }

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
