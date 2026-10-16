import { Color, Graphics } from 'cc';

// Pre-calculated star positions (fixed so they don't flicker each frame)
const STARS: { x: number; y: number; r: number }[] = [];
for (let i = 0; i < 48; i++) {
    const seed = i * 137.508 + 23.7; // golden-angle pseudo-random
    STARS.push({
        x: ((seed * 17.3) % 440) - 220,
        y: 50 + ((seed * 23.1) % 340),
        r: 0.8 + (i % 3) * 0.5,
    });
}

/**
 * Draw the full stadium background.
 * All coordinates are in Cocos Y-up space: center (0,0), W=440, H=780.
 */
export function drawBackground(
    gfx: Graphics,
    W: number,
    H: number,
    flashAlpha: number,
    _shakeX: number,
    _shakeY: number
): void {
    const hw = W / 2;
    const hh = H / 2;

    // ─── 1. Night sky gradient (12 horizontal bands) ───────────────────────
    const skyBands = 12;
    const bandH = (hh + 50) / skyBands; // from top (hh) down to y=-50
    for (let i = 0; i < skyBands; i++) {
        const t = i / (skyBands - 1);
        const r = Math.round(8 + t * 14);
        const g = Math.round(12 + t * (-4));   // stays dark
        const b = Math.round(25 + t * 17);
        const bandTopY = hh - i * bandH;
        gfx.fillColor = new Color(r, g, b, 255);
        gfx.rect(-hw, bandTopY - bandH, W, bandH + 1); // +1 avoids 1-px gaps
        gfx.fill();
    }

    // ─── 2. Moon (top-right) ────────────────────────────────────────────────
    const moonX = 160;
    const moonY = 310;
    // Soft glow rings
    const moonGlows = [{ r: 28, a: 15 }, { r: 22, a: 30 }, { r: 16, a: 60 }];
    for (const g of moonGlows) {
        gfx.fillColor = new Color(255, 255, 255, g.a);
        gfx.circle(moonX, moonY, g.r);
        gfx.fill();
    }
    // Moon face
    gfx.fillColor = new Color(245, 245, 220, 255);
    gfx.circle(moonX, moonY, 13);
    gfx.fill();
    // Subtle crater shadow
    gfx.fillColor = new Color(210, 210, 190, 60);
    gfx.circle(moonX + 3, moonY - 2, 5);
    gfx.fill();

    // ─── 3. Stars ───────────────────────────────────────────────────────────
    for (let i = 0; i < STARS.length; i++) {
        const s = STARS[i];
        const alpha = 180 + (i * 7) % 75;
        gfx.fillColor = new Color(255, 255, 255, alpha);
        gfx.circle(s.x, s.y, s.r);
        gfx.fill();
    }

    // ─── 4. Stadium stands (left + right) ───────────────────────────────────
    // Left stand: trapezoid (-220 to -80, y 50→200)
    gfx.fillColor = new Color(18, 35, 18, 255);
    // Draw as thick vertical bands (no polygon API in Cocos Graphics without path)
    gfx.moveTo(-220, 50);
    gfx.lineTo(-80, 50);
    gfx.lineTo(-90, 200);
    gfx.lineTo(-220, 200);
    gfx.fill();
    // Right stand: mirror
    gfx.moveTo(220, 50);
    gfx.lineTo(80, 50);
    gfx.lineTo(90, 200);
    gfx.lineTo(220, 200);
    gfx.fill();

    // Stand seats — rows of colored dots
    for (let row = 0; row < 3; row++) {
        const rowY = 65 + row * 22;
        // Left stand seats
        for (let col = 0; col < 8; col++) {
            const seatX = -215 + col * 16;
            const heat = (row + col) % 3;
            const colors = [
                new Color(60, 20, 20, 200),
                new Color(20, 60, 20, 200),
                new Color(20, 20, 60, 200),
            ];
            gfx.fillColor = colors[heat];
            gfx.circle(seatX, rowY, 4);
            gfx.fill();
        }
        // Right stand seats (mirror)
        for (let col = 0; col < 8; col++) {
            const seatX = 215 - col * 16;
            const heat = (row + col + 1) % 3;
            const colors = [
                new Color(60, 20, 20, 200),
                new Color(20, 60, 20, 200),
                new Color(20, 20, 60, 200),
            ];
            gfx.fillColor = colors[heat];
            gfx.circle(seatX, rowY, 4);
            gfx.fill();
        }
    }

    // ─── 5. Crowd silhouettes (34 heads near top of stands) ─────────────────
    for (let i = 0; i < 34; i++) {
        const cx = -200 + i * 12;
        const cy = 55 + Math.sin(i * 0.9) * 8 + ((i * 31) % 12);
        const headR = 5 + ((i * 13) % 5);
        const isLight = i % 2 === 0;
        gfx.fillColor = isLight
            ? new Color(50, 70, 50, 220)
            : new Color(35, 50, 35, 220);
        gfx.circle(cx, cy, headR);
        gfx.fill();
    }

    // ─── 6. Stadium flood lights (4 sources) ────────────────────────────────
    const lightPositions = [
        { x: -210, y: 200 },
        { x: -210, y: 320 },
        { x: 210,  y: 200 },
        { x: 210,  y: 320 },
    ];
    for (const lp of lightPositions) {
        // Bloom rings
        const lightGlows = [{ r: 20, a: 12 }, { r: 12, a: 28 }, { r: 6, a: 55 }];
        for (const lg of lightGlows) {
            gfx.fillColor = new Color(255, 255, 230, lg.a);
            gfx.circle(lp.x, lp.y, lg.r);
            gfx.fill();
        }
        // Bright center
        gfx.fillColor = new Color(255, 255, 200, 230);
        gfx.circle(lp.x, lp.y, 4);
        gfx.fill();
    }

    // ─── 7. Grass pitch (y from -390 to -240) ───────────────────────────────
    gfx.fillColor = new Color(22, 160, 90, 255);
    gfx.rect(-hw, -390, W, 150);
    gfx.fill();

    // ─── 8. Grass stripes (8 alternating bands) ──────────────────────────────
    const stripeW = W / 8;
    for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
            gfx.fillColor = new Color(30, 175, 100, 200);
            gfx.rect(-hw + i * stripeW, -390, stripeW, 150);
            gfx.fill();
        }
    }

    // ─── 9. Ground line ──────────────────────────────────────────────────────
    gfx.strokeColor = new Color(255, 255, 255, 150);
    gfx.lineWidth = 1.5;
    gfx.moveTo(-hw, -240);
    gfx.lineTo(hw, -240);
    gfx.stroke();

    // ─── 10. Penalty box marking ─────────────────────────────────────────────
    gfx.strokeColor = new Color(255, 255, 255, 120);
    gfx.lineWidth = 1.5;
    gfx.rect(-80, -280, 160, 40);
    gfx.stroke();

    // Center spot
    gfx.fillColor = new Color(255, 255, 255, 100);
    gfx.circle(0, -240, 3);
    gfx.fill();

    // ─── 11. Flash overlay ───────────────────────────────────────────────────
    if (flashAlpha > 0) {
        const fa = Math.floor(Math.max(0, Math.min(1, flashAlpha)) * 255);
        gfx.fillColor = new Color(255, 255, 255, fa);
        gfx.rect(-hw, -hh, W, H);
        gfx.fill();
    }
}
