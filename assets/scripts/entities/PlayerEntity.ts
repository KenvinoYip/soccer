import { Color, Graphics } from 'cc';
import { HERO_SPRITE_DATA, HERO_KICK_SPRITE_DATA } from './HeroAsset';

function hexToColor(hex: string, alpha: number = 255): Color {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return new Color(r, g, b, Math.round(Math.max(0, Math.min(255, alpha))));
}

/**
 * High-End 2D Anime Hero Sprite Player
 * - Dual-State Real Game Sprites:
 *   1. Ready / Idle Stance (Handsome kung fu hero in martial posture)
 *   2. Flying Dragon Martial Kick (Dynamic aerial bicycle/dragon kick with fiery trails)
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

        // 2. Bruce Lee Flying Dragon Kick Action Sprite
        const imgKick = new Image();
        imgKick.onload = () => {
            this._heroKickImg = imgKick;
            this._transparentKickCanvas = this._keyOutWhite(imgKick);
        };
        imgKick.src = HERO_KICK_SPRITE_DATA;
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

    public kick(isSuper: boolean = false): void {
        this.isCharging = false;
        this.isSuper = isSuper;
        this.kickFrame = 2;
        this.kickTimer = 18;
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
            if (this.kickTimer > 8) {
                this.kickFrame = 2; // Explosive flying kick
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
            this.auraAlpha = Math.max(0, this.kickTimer / 18);
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
                // ── A. Bruce Lee Flying Dragon Kick Action Sprite (凌空飞龙侧踢) ──
                const kickSource = this._transparentKickCanvas || this._heroKickImg;
                if (kickSource) {
                    // Flying high in mid-air
                    const midAirY = this.kickFrame === 2 ? -44 * scale : -20 * scale;
                    const midAirX = this.kickFrame === 2 ? 14 * scale : 6 * scale;
                    ctx.translate(cx + midAirX, cy + midAirY);

                    // Dynamic kick angle tilt and slight scale bounce
                    const kickAngle = this.kickFrame === 2 ? 0.12 : 0.04;
                    ctx.rotate(kickAngle);
                    const kickScale = (this.isSuper ? 1.18 : 1.10) * scale;
                    ctx.scale(kickScale, kickScale);

                    const kw = 175;
                    const kh = 175;
                    ctx.drawImage(kickSource, -kw / 2, -kh / 2, kw, kh);
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

        // 4. Foot energy flash (kicking)
        if (this.kickFrame >= 2) {
            this._drawKickVFX(gfx);
        }
    }

    private _drawIdleSprite(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number = 1.0): void {
        const spriteSource = this._transparentCanvas || this._heroImg;
        if (!spriteSource) return;

        ctx.translate(cx, cy - 35 * scale);

        if (this.kickFrame === 1 || this.isCharging) {
            // Charging: Coiled martial spring stance (蓄力后倾压低)
            ctx.rotate(-0.12);
            ctx.scale(0.94 * scale, 1.06 * scale);
        } else if (this._isGesturing) {
            // Bruce Lee signature nose wipe / chin flick (李小龙擦鼻仰头亮相)
            const gestureProgress = (this._gestureTimer - 250) / 45; // 0..1
            const chinTilt = Math.sin(gestureProgress * Math.PI) * 0.08;
            ctx.rotate(chinTilt);
            ctx.scale(scale * 1.02, scale * 1.02);

            // Nose wipe sparkle
            if (gestureProgress > 0.3 && gestureProgress < 0.7) {
                ctx.save();
                ctx.fillStyle = '#FFE600';
                ctx.shadowColor = '#FFD700';
                ctx.shadowBlur = 8 * scale;
                ctx.beginPath();
                ctx.arc(15 * scale, -45 * scale, 3 * scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        } else {
            // Rhythmic weight sway & loose agile shoulders + kinetic dash tilt
            const dashTilt = Math.max(-0.16, Math.min(0.16, this.vx * 0.025));
            const swayTilt = Math.sin(this._animTimer * 3.2) * 0.032 + dashTilt;
            const stretchY = 1.0 + Math.sin(this._animTimer * 6.5) * 0.02;
            ctx.rotate(swayTilt);
            ctx.scale(scale, scale * stretchY);
        }

        const spriteW = 135;
        const spriteH = 175;
        ctx.drawImage(spriteSource, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
    }

    private _drawShadow(gfx: Graphics, px: number, py: number, hopY: number = 0): void {
        // When character hops high, shadow shrinks and diffuses (3D depth perception!)
        const isMidAirKick = this.kickFrame >= 2;
        const heightOffset = isMidAirKick ? 45 : Math.max(0, hopY);
        const shadowRadius = Math.max(14, 30 - heightOffset * 0.45);
        const shadowAlpha = Math.max(35, Math.floor(130 - heightOffset * 1.8));

        gfx.fillColor = hexToColor('#05080c', Math.floor(shadowAlpha * 0.6));
        gfx.circle(px, py - 48, shadowRadius);
        gfx.fill();

        gfx.fillColor = hexToColor('#020406', shadowAlpha);
        gfx.circle(px, py - 48, Math.max(8, shadowRadius * 0.6));
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
        const fx = this.x + 48;
        const fy = this.y + 60;
        const mainColor = this.isSuper ? '#FFE600' : '#FF5500';

        // Blazing impact blast core
        gfx.fillColor = hexToColor('#FFFFFF', 255);
        gfx.circle(fx, fy, this.isSuper ? 14 : 9);
        gfx.fill();

        gfx.fillColor = hexToColor(mainColor, 180);
        gfx.circle(fx, fy, this.isSuper ? 28 : 18);
        gfx.fill();

        // Golden shockwave ring
        gfx.lineWidth = 3.5;
        gfx.strokeColor = hexToColor(mainColor, 230);
        gfx.circle(fx, fy, this.isSuper ? 38 : 24);
        gfx.stroke();

        // Radiating dragon energy slashes
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4 + this._animTimer * 3;
            const len = (this.isSuper ? 28 : 16) + (i % 2) * 10;
            gfx.lineWidth = 2.5;
            gfx.strokeColor = hexToColor('#FFFFFF', 220);
            gfx.moveTo(fx, fy);
            gfx.lineTo(fx + Math.cos(angle) * len, fy + Math.sin(angle) * len);
            gfx.stroke();
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
            // Flying kick stance
            gfx.roundRect(px - 10, py, 12, 18, 4);
            gfx.fill();
            gfx.roundRect(px + 4, py + 6, 26, 12, 4);
            gfx.fill();
        } else {
            // Ready stance
            gfx.roundRect(px - 12, py - 10, 10, 24, 3);
            gfx.fill();
            gfx.roundRect(px + 2, py - 10, 10, 24, 3);
            gfx.fill();
        }
    }
}
