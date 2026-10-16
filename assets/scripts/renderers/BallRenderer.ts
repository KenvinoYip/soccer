import { Color, Graphics } from 'cc';
import { BallData, CONFIG } from '../Config';

// ─── Helper: draw a regular polygon (pentagon patch) ───────────────────────
function drawPolygon(
    gfx: Graphics,
    cx: number,
    cy: number,
    radius: number,
    sides: number,
    rotation: number
): void {
    for (let i = 0; i <= sides; i++) {
        const angle = rotation + (i / sides) * Math.PI * 2;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) gfx.moveTo(px, py);
        else gfx.lineTo(px, py);
    }
}

// ─── Helper: draw a squashed/stretched circle for anime impact frames ────────
function drawSquashedCircle(
    gfx: Graphics,
    cx: number,
    cy: number,
    r: number,
    sx: number = 1.0,
    sy: number = 1.0,
    angle: number = 0
): void {
    if (Math.abs(sx - 1.0) < 0.04 && Math.abs(sy - 1.0) < 0.04) {
        gfx.circle(cx, cy, r);
        return;
    }
    const segments = 16;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const lx = Math.cos(theta) * (r * sx);
        const ly = Math.sin(theta) * (r * sy);
        const rx = cx + lx * cosA - ly * sinA;
        const ry = cy + lx * sinA + ly * cosA;
        if (i === 0) gfx.moveTo(rx, ry);
        else gfx.lineTo(rx, ry);
    }
}

/**
 * Draw a soccer ball with trail, fire/electric effects, and pentagon patches.
 */
export function drawBall(gfx: Graphics, ball: BallData): void {
    // ─── 1. Calligraphic Ink Wash Brush Trail (新国风书法飞白水墨拖尾) ─────────
    if (ball.trail && ball.trail.length > 1) {
        for (let i = 0; i < ball.trail.length; i++) {
            const t = ball.trail[i];
            const ratio = i / ball.trail.length; // 0=oldest, 1=newest
            const trailR = ball.r * (0.28 + ratio * 0.58);
            const alpha = Math.floor(t.alpha * 160);
            if (alpha <= 0) continue;

            if (ball.isSuper) {
                // Flaming Dragon Trail: Fiery vermilion & gold
                gfx.fillColor = new Color(255, 110, 0, Math.floor(alpha * 0.75));
                gfx.circle(t.x, t.y, trailR * 1.25);
                gfx.fill();
                gfx.fillColor = new Color(255, 220, 50, alpha);
                gfx.circle(t.x, t.y, trailR * 0.7);
                gfx.fill();
            } else if (ball.mode === 1) {
                // Electric Cyan Phantom Trail
                gfx.fillColor = new Color(0, 180, 255, Math.floor(alpha * 0.65));
                gfx.circle(t.x, t.y, trailR * 1.15);
                gfx.fill();
                gfx.fillColor = new Color(200, 240, 255, alpha);
                gfx.circle(t.x, t.y, trailR * 0.65);
                gfx.fill();
            } else {
                // Signature Calligraphic Deep Ink Wash Trail (浓墨点染 + 墨晕)
                gfx.fillColor = new Color(15, 22, 32, Math.floor(alpha * 0.55));
                gfx.circle(t.x, t.y, trailR * 1.1);
                gfx.fill();
                gfx.fillColor = new Color(240, 245, 250, Math.floor(alpha * 0.85));
                gfx.circle(t.x, t.y, trailR * 0.6);
                gfx.fill();

                // Calligraphic flying ink droplets (飞白微滴)
                if (i % 3 === 0 && i < ball.trail.length - 2) {
                    const dropOffset = (i % 2 === 0 ? 1 : -1) * (trailR * 0.85);
                    gfx.fillColor = new Color(15, 20, 28, Math.floor(alpha * 0.7));
                    gfx.circle(t.x + dropOffset, t.y + (Math.random() - 0.5) * 4, 1.8);
                    gfx.fill();
                }
            }
        }
    }

    // ─── 2. Blazing Dragon Flame Aura for Super Ball (大力金刚烈焰龙息) ─────
    if (ball.isSuper) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 0.1) {
            const baseAngle = Math.atan2(-ball.vy, -ball.vx);
            for (let j = 0; j < 8; j++) {
                const spread = (j / 7) * 0.9 - 0.45;
                const fireAngle = baseAngle + spread;
                const fireLen = 10 + Math.random() * 14;
                const fx = ball.x + Math.cos(fireAngle) * (ball.r + fireLen);
                const fy = ball.y + Math.sin(fireAngle) * (ball.r + fireLen);
                const fireAlpha = 200 - j * 18;

                if (j < 3) {
                    gfx.fillColor = new Color(255, 255, 200, fireAlpha);
                } else if (j < 5) {
                    gfx.fillColor = new Color(255, 140, 0, fireAlpha);
                } else {
                    gfx.fillColor = new Color(220, 30, 20, fireAlpha);
                }
                gfx.circle(fx, fy, 3.5 + (7 - j) * 0.7);
                gfx.fill();
            }
        }

        // Concentric Holy Qi rings
        const glowRings = [
            { r: ball.r + 15, a: 25, c: new Color(255, 60, 20) },
            { r: ball.r + 9,  a: 50, c: new Color(255, 160, 0) },
            { r: ball.r + 4,  a: 85, c: new Color(255, 230, 50) },
        ];
        for (const ring of glowRings) {
            gfx.fillColor = new Color(ring.c.r, ring.c.g, ring.c.b, ring.a);
            gfx.circle(ball.x, ball.y, ring.r);
            gfx.fill();
        }
    }

    // ─── 3. Clone Mode (mode 1) Electric Lightning Aura ─────────────────────
    if (ball.mode === 1 && !ball.isSuper) {
        gfx.fillColor = new Color(0, 180, 255, 45);
        gfx.circle(ball.x, ball.y, ball.r + 8);
        gfx.fill();
        gfx.fillColor = new Color(150, 230, 255, 75);
        gfx.circle(ball.x, ball.y, ball.r + 4);
        gfx.fill();
    }

    // Squash & stretch parameters
    const sx = ball.squashX || 1.0;
    const sy = ball.squashY || 1.0;
    const moveAngle = Math.atan2(ball.vy, ball.vx);

    // ─── 4. Drop Shadow ─────────────────────────────────────────────────────
    gfx.fillColor = new Color(5, 8, 14, 70);
    drawSquashedCircle(gfx, ball.x + 2.5, ball.y - 2.5, ball.r, sx, sy, moveAngle);
    gfx.fill();

    // ─── 4.5 Banana Curve Magnus Spiral (香蕉球旋风光弧) ──────────────────────
    if (ball.curl && Math.abs(ball.curl) > 0.05) {
        const curlSign = Math.sign(ball.curl);
        const spiralAngle = ball.rot * 2;
        gfx.lineWidth = 2.2;
        gfx.strokeColor = curlSign > 0 ? new Color(255, 145, 0, 220) : new Color(0, 229, 255, 220);
        gfx.arc(ball.x, ball.y, ball.r + 5, spiralAngle, spiralAngle + Math.PI * 1.3, curlSign < 0);
        gfx.stroke();
    }

    // ─── 5. Core Soccer Ball Sphere (Classic 3D Leather Shading) ─────────────
    if (ball.isSuper) {
        gfx.fillColor = new Color(255, 245, 190, 255);
    } else if (ball.mode === 1) {
        gfx.fillColor = new Color(230, 245, 255, 255);
    } else {
        gfx.fillColor = new Color(250, 250, 252, 255);
    }
    drawSquashedCircle(gfx, ball.x, ball.y, ball.r, sx, sy, moveAngle);
    gfx.fill();

    // Subtle 3D bottom shading
    gfx.fillColor = new Color(148, 163, 184, 85);
    drawSquashedCircle(gfx, ball.x + 1.5, ball.y - 1.5, ball.r * 0.95, sx, sy, moveAngle);
    gfx.fill();

    // Re-fill top-left highlight core for spherical depth
    gfx.fillColor = ball.isSuper ? new Color(255, 250, 210, 220) : new Color(255, 255, 255, 220);
    drawSquashedCircle(gfx, ball.x - ball.r * 0.25, ball.y + ball.r * 0.25, ball.r * 0.75, sx, sy, moveAngle);
    gfx.fill();

    // ─── 6. Golden Energy Seams & Leather Stitching (太极金光缝线) ───────────
    const cos = Math.cos(ball.rot);
    const sin = Math.sin(ball.rot);
    const patchOffsets = [
        { px: 0,     py: -0.62 },
        { px: 0.58,  py: 0.28  },
        { px: -0.58, py: 0.28  },
        { px: 0.36,  py: -0.48 },
        { px: -0.36, py: -0.48 },
    ];

    // Seam lines connecting patches
    gfx.strokeColor = ball.isSuper
        ? new Color(255, 220, 50, 200)
        : new Color(212, 160, 23, 150);
    gfx.lineWidth = 1.0;
    for (const offset of patchOffsets) {
        const ox = offset.px * ball.r * 0.65;
        const oy = offset.py * ball.r * 0.65;
        const rx = ox * cos - oy * sin;
        const ry = ox * sin + oy * cos;
        gfx.moveTo(ball.x, ball.y);
        gfx.lineTo(ball.x + rx, ball.y + ry);
    }
    gfx.stroke();

    // ─── 7. Classic Soccer Ball Pentagon Patches (黑白五边形皮面) ────────────
    const patchColor = ball.isSuper
        ? new Color(160, 60, 0, 220)
        : new Color(22, 28, 38, 235);
    gfx.fillColor = patchColor;

    for (const offset of patchOffsets) {
        const ox = offset.px * ball.r * 0.65;
        const oy = offset.py * ball.r * 0.65;
        const rx = ox * cos - oy * sin;
        const ry = ox * sin + oy * cos;
        const pcx = ball.x + rx;
        const pcy = ball.y + ry;
        const patchR = ball.r * 0.24;

        drawPolygon(gfx, pcx, pcy, patchR, 5, ball.rot);
        gfx.fill();
    }

    // Center pentagon patch
    drawPolygon(gfx, ball.x, ball.y, ball.r * 0.25, 5, ball.rot);
    gfx.fill();

    // ─── 8. Specular Highlight Glint ────────────────────────────────────────
    gfx.fillColor = new Color(255, 255, 255, ball.isSuper ? 140 : 190);
    gfx.circle(
        ball.x - ball.r * 0.32,
        ball.y + ball.r * 0.32,
        ball.r * 0.22
    );
    gfx.fill();

    // ─── 9. Electric Arcs for Clone Mode (mode 1) ───────────────────────────
    if (ball.mode === 1) {
        gfx.strokeColor = new Color(100, 200, 255, 220);
        gfx.lineWidth = 1.8;
        for (let k = 0; k < 3; k++) {
            const angle = ball.rot + k * ((Math.PI * 2) / 3);
            const x1 = ball.x + Math.cos(angle) * (ball.r + 2);
            const y1 = ball.y + Math.sin(angle) * (ball.r + 2);
            const x2 = ball.x + Math.cos(angle) * (ball.r + 10);
            const y2 = ball.y + Math.sin(angle) * (ball.r + 10);
            const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 5;
            const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 5;
            gfx.moveTo(x1, y1);
            gfx.lineTo(mx, my);
            gfx.lineTo(x2, y2);
            gfx.stroke();
        }
    }
}

/**
 * Draw the aim/trajectory dotted arc and landing indicator.
 * Adapts visual style dynamically when an Ultimate Skill is armed.
 */
export function drawAimLine(
    gfx: Graphics,
    trajectory: { x: number; y: number }[],
    isSuper: boolean,
    armedSkill?: 'meteor' | 'barrage' | 'earthquake' | null
): void {
    if (trajectory.length === 0) return;

    if (armedSkill === 'earthquake') {
        // ── 1. Earthquake: Golden Demolition Impact Zone ──
        const zoneW = 380;
        const zoneH = 110;
        const zoneX = -zoneW / 2;
        const zoneY = CONFIG.WALL_BOTTOM;

        // Golden translucent demolition zone fill
        gfx.fillColor = new Color(255, 215, 0, 45);
        gfx.rect(zoneX, zoneY, zoneW, zoneH);
        gfx.fill();

        // Pulsing border
        gfx.strokeColor = new Color(255, 220, 50, 190);
        gfx.lineWidth = 2.5;
        gfx.rect(zoneX, zoneY, zoneW, zoneH);
        gfx.stroke();

        // Palm shockwave circles at center
        gfx.strokeColor = new Color(255, 240, 100, 220);
        gfx.lineWidth = 3;
        gfx.circle(0, zoneY + 50, 40);
        gfx.stroke();
        gfx.circle(0, zoneY + 50, 65);
        gfx.stroke();
        return;
    }

    if (armedSkill === 'meteor') {
        // ── 2. Blazing Meteor Trail (Thick fiery dots & huge landing reticle) ──
        for (let i = 0; i < trajectory.length - 1; i += 2) {
            const fadeFactor = 1 - i / trajectory.length;
            const alpha = Math.floor(220 * fadeFactor);
            if (alpha <= 0) continue;

            // Outer fire glow
            gfx.fillColor = new Color(255, 69, 0, Math.floor(alpha * 0.5));
            gfx.circle(trajectory[i].x, trajectory[i].y, 6.5);
            gfx.fill();

            // Core fiery dot
            gfx.fillColor = new Color(255, 220, 80, alpha);
            gfx.circle(trajectory[i].x, trajectory[i].y, 3.8);
            gfx.fill();
        }

        const last = trajectory[trajectory.length - 1];
        // Giant meteor strike reticle (r=32)
        gfx.strokeColor = new Color(255, 69, 0, 220);
        gfx.lineWidth = 3.5;
        gfx.circle(last.x, last.y, 32);
        gfx.stroke();

        gfx.strokeColor = new Color(255, 220, 50, 240);
        gfx.lineWidth = 2;
        gfx.circle(last.x, last.y, 20);
        gfx.stroke();

        // Crosshairs
        gfx.strokeColor = new Color(255, 255, 255, 230);
        gfx.lineWidth = 2;
        gfx.moveTo(last.x - 38, last.y); gfx.lineTo(last.x + 38, last.y); gfx.stroke();
        gfx.moveTo(last.x, last.y - 38); gfx.lineTo(last.x, last.y + 38); gfx.stroke();
        return;
    }

    if (armedSkill === 'barrage') {
        // ── 3. Electric Barrage Spread (Cyan-Blue multi-arc fan) ──
        for (let i = 0; i < trajectory.length - 1; i += 2) {
            const fadeFactor = 1 - i / trajectory.length;
            const alpha = Math.floor(200 * fadeFactor);
            if (alpha <= 0) continue;

            const pt = trajectory[i];
            const spread = (i / trajectory.length) * 45;

            // Main center arc
            gfx.fillColor = new Color(0, 229, 255, alpha);
            gfx.circle(pt.x, pt.y, 3);
            gfx.fill();

            // Flank fan arcs
            gfx.fillColor = new Color(84, 160, 255, Math.floor(alpha * 0.7));
            gfx.circle(pt.x - spread, pt.y, 2.2);
            gfx.fill();
            gfx.circle(pt.x + spread, pt.y, 2.2);
            gfx.fill();
        }

        const last = trajectory[trajectory.length - 1];
        gfx.strokeColor = new Color(0, 229, 255, 200);
        gfx.lineWidth = 2;
        gfx.circle(last.x, last.y, 14);
        gfx.circle(last.x - 45, last.y, 10);
        gfx.circle(last.x + 45, last.y, 10);
        gfx.stroke();
        return;
    }

    // ── 4. Standard / Super Ball Arc ──
    for (let i = 0; i < trajectory.length - 1; i += 2) {
        const fadeFactor = 1 - i / trajectory.length;
        const alpha = Math.floor(160 * fadeFactor);
        if (alpha <= 0) continue;

        if (isSuper) {
            gfx.fillColor = new Color(255, 120, 0, alpha);
        } else {
            gfx.fillColor = new Color(255, 255, 255, Math.floor(alpha * 0.85));
        }
        gfx.circle(trajectory[i].x, trajectory[i].y, 2.5);
        gfx.fill();
    }

    // Landing indicator at last point
    const last = trajectory[trajectory.length - 1];
    if (isSuper) {
        gfx.strokeColor = new Color(255, 120, 0, 200);
    } else {
        gfx.strokeColor = new Color(255, 255, 255, 160);
    }
    gfx.lineWidth = 1.5;
    gfx.circle(last.x, last.y, 9);
    gfx.stroke();

    // Crosshair lines
    gfx.moveTo(last.x - 14, last.y);
    gfx.lineTo(last.x + 14, last.y);
    gfx.stroke();
    gfx.moveTo(last.x, last.y - 14);
    gfx.lineTo(last.x, last.y + 14);
    gfx.stroke();
}

/**
 * Predicts and draws martial landing target indicator on the grass for balls.
 * Supports contracting timing rings, concentric martial aura, and high-res interactive TAP badges.
 */
export function drawBallLandingMarker(
    gfx: Graphics,
    balls: BallData[],
    playerX: number,
    ctx?: CanvasRenderingContext2D | null,
    swipeInfo?: { isSwiping: boolean; dx: number; dy: number; playerX: number } | null
): void {
    const halfW = 220;
    const groundY = -240;

    for (const ball of balls) {
        // Only active balls above bottom out-of-bounds line
        if (ball.y < groundY - 18) continue;

        // Kinematics trajectory simulation to ground line
        let simX = ball.x;
        let simY = ball.y;
        let simVx = ball.vx;
        let simVy = ball.vy;
        let landed = false;
        let frames = 0;

        for (let step = 0; step < 75; step++) {
            simX += simVx;
            simVy -= CONFIG.GRAVITY;
            simY += simVy;
            frames++;

            // Lateral wall bouncing in prediction
            if (simX - ball.r < -halfW) {
                simX = -halfW + ball.r;
                simVx = -simVx * 0.94;
            } else if (simX + ball.r > halfW) {
                simX = halfW - ball.r;
                simVx = -simVx * 0.94;
            }

            if (simY <= groundY) {
                landed = true;
                break;
            }
        }

        if (!landed) continue;

        const isDescending = ball.vy < 0;
        const isCatchable = Math.abs(simX - playerX) <= 44;
        const isPerfectWindow = isDescending && frames <= 3;
        const isGreatWindow = isDescending && frames <= 7;

        // Visual colors: Gold/white on PERFECT, Emerald green when ready, Crimson when waiting
        const colorMain = isPerfectWindow
            ? new Color(255, 220, 50, 255)
            : isCatchable
            ? new Color(46, 213, 115, 235)
            : isDescending
            ? new Color(255, 75, 75, 230)
            : new Color(255, 175, 25, 180);

        const colorGlow = isPerfectWindow
            ? new Color(255, 215, 0, 110)
            : isCatchable
            ? new Color(46, 213, 115, 70)
            : isDescending
            ? new Color(255, 75, 75, 65)
            : new Color(255, 175, 25, 45);

        // 1. Ground shadow oval
        gfx.fillColor = new Color(0, 0, 0, 85);
        gfx.circle(simX, groundY, 18);
        gfx.fill();

        // 2. Pulsing target aura ring
        gfx.fillColor = colorGlow;
        gfx.circle(simX, groundY, isPerfectWindow ? 32 : 25);
        gfx.fill();

        // 3. Concentric target boundary
        gfx.lineWidth = isPerfectWindow ? 3.0 : 2.2;
        gfx.strokeColor = colorMain;
        gfx.circle(simX, groundY, 14);
        gfx.stroke();

        // 4. Dynamic Contracting Timing Ring (r shrinks towards 14 as ball lands)
        if (isDescending) {
            const timingR = 14 + Math.min(38, frames * 1.35);
            gfx.lineWidth = isPerfectWindow ? 2.5 : 1.8;
            gfx.strokeColor = isPerfectWindow
                ? new Color(255, 255, 255, 245)
                : isCatchable
                ? new Color(46, 213, 115, 190)
                : new Color(255, 220, 50, 220);
            gfx.circle(simX, groundY, timingR);
            gfx.stroke();
        }

        // 5. Inner bullseye
        gfx.fillColor = isPerfectWindow ? new Color(255, 255, 255, 255) : colorMain;
        gfx.circle(simX, groundY, isPerfectWindow ? 6 : 4.5);
        gfx.fill();

        // 6. Directional crosshair lines
        gfx.lineWidth = isPerfectWindow ? 2.2 : 1.6;
        gfx.strokeColor = colorMain;
        gfx.moveTo(simX - 22, groundY);
        gfx.lineTo(simX + 22, groundY);
        gfx.stroke();
        gfx.moveTo(simX, groundY - 8);
        gfx.lineTo(simX, groundY + 8);
        gfx.stroke();

        // 7. Interactive High-Res Floating Badge & Swipe Trajectory on Canvas2D Overlay
        if (ctx) {
            const cw = ctx.canvas.width;
            const ch = ctx.canvas.height;
            const scale = Math.min(cw / 440, ch / 780);
            const screenX = cw / 2 + simX * scale;
            const screenY = ch / 2 - groundY * scale;

            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // ── Dynamic Swipe Trajectory Guide Curve (划屏香蕉球/穿云炮实时轨迹) ──
            if (swipeInfo && swipeInfo.isSwiping && isCatchable) {
                const px = cw / 2 + swipeInfo.playerX * scale;
                const py = screenY;
                const sdx = swipeInfo.dx;
                const sdy = swipeInfo.dy;

                let intentText = '🥋 稳准抽射·直击中路';
                let intentColor = '#4ADE80';

                ctx.lineWidth = 3.5 * scale;
                ctx.beginPath();
                ctx.moveTo(px, py);

                if (sdx < -20) {
                    // Left Banana Curve (左旋香蕉球)
                    intentText = '🌪️ 左旋香蕉球·神龙摆尾';
                    intentColor = '#00E5FF';
                    ctx.strokeStyle = intentColor;
                    ctx.shadowColor = '#00E5FF';
                    ctx.shadowBlur = 12 * scale;
                    const cpx = px - 85 * scale;
                    const cpy = py - 70 * scale;
                    const endX = px - 110 * scale;
                    const endY = py - 180 * scale;
                    ctx.quadraticCurveTo(cpx, cpy, endX, endY);
                    ctx.stroke();

                    // Arrowhead
                    ctx.fillStyle = intentColor;
                    ctx.beginPath();
                    ctx.arc(endX, endY, 6 * scale, 0, Math.PI * 2);
                    ctx.fill();
                } else if (sdx > 20) {
                    // Right Banana Curve (右旋贴地斩)
                    intentText = '🌪️ 右旋贴地斩·狂龙破空';
                    intentColor = '#FB923C';
                    ctx.strokeStyle = intentColor;
                    ctx.shadowColor = '#FB923C';
                    ctx.shadowBlur = 12 * scale;
                    const cpx = px + 85 * scale;
                    const cpy = py - 70 * scale;
                    const endX = px + 110 * scale;
                    const endY = py - 180 * scale;
                    ctx.quadraticCurveTo(cpx, cpy, endX, endY);
                    ctx.stroke();

                    ctx.fillStyle = intentColor;
                    ctx.beginPath();
                    ctx.arc(endX, endY, 6 * scale, 0, Math.PI * 2);
                    ctx.fill();
                } else if (sdy > 25) {
                    // Sky Rocket Piercing Shot (穿云破空炮)
                    intentText = '⚡ 倒挂金钩·穿云破日';
                    intentColor = '#FBBF24';
                    ctx.strokeStyle = intentColor;
                    ctx.shadowColor = '#FBBF24';
                    ctx.shadowBlur = 15 * scale;
                    const endX = px;
                    const endY = py - 200 * scale;
                    ctx.lineTo(endX, endY);
                    ctx.stroke();

                    ctx.fillStyle = intentColor;
                    ctx.beginPath();
                    ctx.arc(endX, endY, 7 * scale, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Direct shot
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.setLineDash([4 * scale, 4 * scale]);
                    ctx.lineTo(px, py - 140 * scale);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                // Show Current Swipe Intent Banner
                const bannerY = screenY - 55 * scale;
                ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
                ctx.strokeStyle = intentColor;
                ctx.lineWidth = 1.8 * scale;
                const bW = 150 * scale;
                const bH = 26 * scale;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(px - bW / 2, bannerY - bH / 2, bW, bH, 13 * scale);
                else ctx.rect(px - bW / 2, bannerY - bH / 2, bW, bH);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `bold ${Math.round(11 * scale)}px 'PingFang SC', sans-serif`;
                ctx.fillText(intentText, px, bannerY);
            } else if (isPerfectWindow) {
                // ── PERFECT Timing Window ──
                const tagH = 26 * scale;
                const tagW = 120 * scale;
                const tagY = screenY - 42 * scale;

                ctx.shadowColor = '#FBBF24';
                ctx.shadowBlur = 18 * scale;
                ctx.fillStyle = '#EAB308';
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2.5 * scale;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(screenX - tagW / 2, tagY - tagH / 2, tagW, tagH, 13 * scale);
                else ctx.rect(screenX - tagW / 2, tagY - tagH / 2, tagW, tagH);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#0F172A';
                ctx.font = `900 ${Math.round(12 * scale)}px 'PingFang SC', sans-serif`;
                ctx.fillText('⚡ PERFECT! 出脚', screenX, tagY);

                // Guide hint below
                ctx.fillStyle = '#FDE047';
                ctx.font = `bold ${Math.round(9 * scale)}px 'PingFang SC', sans-serif`;
                ctx.fillText('划屏踢出香蕉球/穿云炮', screenX, tagY + 18 * scale);
            } else if (isCatchable) {
                // Character is in place: show ready badge + swipe hint
                const tagH = 22 * scale;
                const tagW = 100 * scale;
                const tagY = screenY - 35 * scale;

                ctx.fillStyle = 'rgba(16, 185, 129, 0.92)';
                ctx.strokeStyle = '#34D399';
                ctx.lineWidth = 1.5 * scale;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(screenX - tagW / 2, tagY - tagH / 2, tagW, tagH, 11 * scale);
                else ctx.rect(screenX - tagW / 2, tagY - tagH / 2, tagW, tagH);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#FFFFFF';
                ctx.font = `900 ${Math.round(11 * scale)}px 'PingFang SC', sans-serif`;
                ctx.fillText(isGreatWindow ? '⚡ GREAT 时机' : '🥋 已就位·截击', screenX, tagY);
            } else {
                // Needs tap: show bouncing urgent tap button with glowing border
                const bounce = Math.sin(Date.now() * 0.009) * 3.5 * scale;
                const tagH = 25 * scale;
                const tagW = 100 * scale;
                const tagY = screenY - 40 * scale + bounce;

                ctx.shadowColor = '#FF4757';
                ctx.shadowBlur = 12 * scale;

                ctx.fillStyle = 'rgba(239, 68, 68, 0.94)';
                ctx.strokeStyle = '#FBBF24';
                ctx.lineWidth = 2.0 * scale;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(screenX - tagW / 2, tagY - tagH / 2, tagW, tagH, 12 * scale);
                else ctx.rect(screenX - tagW / 2, tagY - tagH / 2, tagW, tagH);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = `900 ${Math.round(11 * scale)}px 'PingFang SC', sans-serif`;
                ctx.fillText('👆 点击此处接球', screenX, tagY);

                // Downward pointer arrow
                ctx.fillStyle = '#FBBF24';
                ctx.beginPath();
                ctx.moveTo(screenX - 6 * scale, tagY + tagH / 2 + 1 * scale);
                ctx.lineTo(screenX + 6 * scale, tagY + tagH / 2 + 1 * scale);
                ctx.lineTo(screenX, tagY + tagH / 2 + 6 * scale);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }
}


