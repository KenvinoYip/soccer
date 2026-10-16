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

/**
 * Draw a soccer ball with trail, fire/electric effects, and pentagon patches.
 */
export function drawBall(gfx: Graphics, ball: BallData): void {
    // ─── 1. Trail ────────────────────────────────────────────────────────────
    for (let i = 0; i < ball.trail.length; i++) {
        const t = ball.trail[i];
        const ratio = i / ball.trail.length;
        const trailR = ball.r * (0.25 + ratio * 0.55);
        const alpha = Math.floor(t.alpha * 120);
        if (alpha <= 0) continue;

        if (ball.isSuper) {
            gfx.fillColor = new Color(255, 120, 0, alpha);
        } else if (ball.mode === 1) {
            gfx.fillColor = new Color(80, 120, 255, alpha);
        } else {
            gfx.fillColor = new Color(255, 255, 255, alpha);
        }
        gfx.circle(t.x, t.y, trailR);
        gfx.fill();
    }

    // ─── 2. Fire effect for super ball ───────────────────────────────────────
    if (ball.isSuper) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > 0.1) {
            const baseAngle = Math.atan2(-ball.vy, -ball.vx); // opposite to movement
            for (let j = 0; j < 8; j++) {
                const spread = (j / 7) * 0.8 - 0.4;
                const fireAngle = baseAngle + spread;
                const fireLen = 8 + Math.random() * 12;
                const fx = ball.x + Math.cos(fireAngle) * (ball.r + fireLen);
                const fy = ball.y + Math.sin(fireAngle) * (ball.r + fireLen);
                const fireAlpha = 180 - j * 15;
                const innerFire = j < 3;
                const midFire = j < 5;
                if (innerFire) {
                    gfx.fillColor = new Color(255, 255, 180, fireAlpha);
                } else if (midFire) {
                    gfx.fillColor = new Color(255, 120, 0, fireAlpha);
                } else {
                    gfx.fillColor = new Color(180, 40, 0, fireAlpha);
                }
                gfx.circle(fx, fy, 3 + (7 - j) * 0.8);
                gfx.fill();
            }
        }
    }

    // ─── 3. Glow rings for super ball ────────────────────────────────────────
    if (ball.isSuper) {
        const glowRings = [
            { r: ball.r + 14, a: 20 },
            { r: ball.r + 8,  a: 40 },
            { r: ball.r + 3,  a: 70 },
        ];
        for (const ring of glowRings) {
            gfx.fillColor = new Color(255, 160, 0, ring.a);
            gfx.circle(ball.x, ball.y, ring.r);
            gfx.fill();
        }
    }

    // ─── 4. Clone mode (mode 1) glow ─────────────────────────────────────────
    if (ball.mode === 1 && !ball.isSuper) {
        gfx.fillColor = new Color(100, 160, 255, 35);
        gfx.circle(ball.x, ball.y, ball.r + 8);
        gfx.fill();
        gfx.fillColor = new Color(100, 160, 255, 55);
        gfx.circle(ball.x, ball.y, ball.r + 4);
        gfx.fill();
    }

    // ─── 5. Drop shadow ──────────────────────────────────────────────────────
    gfx.fillColor = new Color(0, 0, 0, 50);
    gfx.circle(ball.x + 3, ball.y - 3, ball.r);
    gfx.fill();

    // ─── 6. Base ball circle ─────────────────────────────────────────────────
    if (ball.isSuper) {
        gfx.fillColor = new Color(255, 240, 160, 255);
    } else if (ball.mode === 1) {
        gfx.fillColor = new Color(220, 235, 255, 255);
    } else {
        gfx.fillColor = new Color(248, 248, 248, 255);
    }
    gfx.circle(ball.x, ball.y, ball.r);
    gfx.fill();

    // ─── 7. Soccer pentagon patches (5 patches) ──────────────────────────────
    // Relative positions scaled by ball radius, rotated by ball.rot
    const patchOffsets = [
        { px: 0,     py: -0.6 },
        { px: 0.55,  py: 0.3  },
        { px: -0.55, py: 0.3  },
        { px: 0.35,  py: -0.45 },
        { px: -0.35, py: -0.45 },
    ];
    const patchColor = ball.isSuper
        ? new Color(180, 100, 0, 180)
        : new Color(30, 30, 30, 200);
    gfx.fillColor = patchColor;

    const cos = Math.cos(ball.rot);
    const sin = Math.sin(ball.rot);

    for (const offset of patchOffsets) {
        // Apply 2D rotation matrix to offset
        const ox = offset.px * ball.r * 0.65;
        const oy = offset.py * ball.r * 0.65;
        const rx = ox * cos - oy * sin;
        const ry = ox * sin + oy * cos;
        const pcx = ball.x + rx;
        const pcy = ball.y + ry;
        const patchR = ball.r * 0.22;

        drawPolygon(gfx, pcx, pcy, patchR, 5, ball.rot);
        gfx.fill();
    }

    // ─── 8. Highlight glint ───────────────────────────────────────────────────
    gfx.fillColor = new Color(255, 255, 255, ball.isSuper ? 100 : 160);
    gfx.circle(
        ball.x - ball.r * 0.35,
        ball.y + ball.r * 0.35,
        ball.r * 0.2
    );
    gfx.fill();

    // ─── 9. Electric arcs for clone mode (mode 1) ────────────────────────────
    if (ball.mode === 1) {
        gfx.strokeColor = new Color(100, 150, 255, 200);
        gfx.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
            const angle = ball.rot + k * ((Math.PI * 2) / 3);
            const x1 = ball.x + Math.cos(angle) * (ball.r + 2);
            const y1 = ball.y + Math.sin(angle) * (ball.r + 2);
            const x2 = ball.x + Math.cos(angle) * (ball.r + 9);
            const y2 = ball.y + Math.sin(angle) * (ball.r + 9);
            // Jagged lightning
            const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * 4;
            const my = (y1 + y2) / 2 + (Math.random() - 0.5) * 4;
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
 * Predicts and draws martial landing target indicator on the grass for descending balls.
 * Green when within Bruce Lee's catch range, amber when moving outside.
 */
export function drawBallLandingMarker(gfx: Graphics, balls: BallData[], playerX: number): void {
    const halfW = 220;
    const groundY = -240;

    for (const ball of balls) {
        // Only descending balls heading towards ground
        if (ball.vy >= 0 || ball.y < groundY - 15) continue;

        // Kinematics trajectory simulation to ground line
        let simX = ball.x;
        let simY = ball.y;
        let simVx = ball.vx;
        let simVy = ball.vy;
        let landed = false;

        for (let step = 0; step < 50; step++) {
            simX += simVx;
            simVy -= 0.45; // CONFIG.GRAVITY
            simY += simVy;

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

        const isCatchable = Math.abs(simX - playerX) <= 44;
        const colorMain = isCatchable ? new Color(46, 213, 115, 230) : new Color(255, 165, 2, 210);
        const colorGlow = isCatchable ? new Color(46, 213, 115, 65) : new Color(255, 165, 2, 55);

        // Ground shadow oval
        gfx.fillColor = new Color(0, 0, 0, 85);
        gfx.circle(simX, groundY, 18);
        gfx.fill();

        // Pulsing target aura ring
        gfx.fillColor = colorGlow;
        gfx.circle(simX, groundY, 24);
        gfx.fill();

        // Concentric target boundary
        gfx.lineWidth = 2.0;
        gfx.strokeColor = colorMain;
        gfx.circle(simX, groundY, 14);
        gfx.stroke();

        // Inner bullseye
        gfx.fillColor = colorMain;
        gfx.circle(simX, groundY, 4.5);
        gfx.fill();

        // Directional crosshair lines
        gfx.lineWidth = 1.5;
        gfx.strokeColor = colorMain;
        gfx.moveTo(simX - 20, groundY);
        gfx.lineTo(simX + 20, groundY);
        gfx.stroke();
        gfx.moveTo(simX, groundY - 8);
        gfx.lineTo(simX, groundY + 8);
        gfx.stroke();
    }
}


