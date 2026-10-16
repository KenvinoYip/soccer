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

    // ─── 1. Deep Ink Wash Night Sky Gradient (新国风玄夜墨韵渐变) ───────────
    const skyBands = 14;
    const bandH = (hh + 50) / skyBands;
    for (let i = 0; i < skyBands; i++) {
        const t = i / (skyBands - 1);
        const r = Math.round(6 + t * 24);
        const g = Math.round(8 + t * 4);
        const b = Math.round(16 + t * 20);
        const bandTopY = hh - i * bandH;
        gfx.fillColor = new Color(r, g, b, 255);
        gfx.rect(-hw, bandTopY - bandH, W, bandH + 1);
        gfx.fill();
    }

    // ─── 2. Colossal Crimson Blood Moon (绯红血月悬空) ────────────────────────
    const moonX = 135;
    const moonY = 275;
    // Multi-layer ominous crimson lunar halos
    const bloodHalos = [
        { r: 72, a: 16, c: new Color(231, 76, 60) },
        { r: 54, a: 32, c: new Color(231, 76, 60) },
        { r: 42, a: 65, c: new Color(243, 156, 18) },
        { r: 35, a: 110, c: new Color(255, 80, 50) },
    ];
    for (const h of bloodHalos) {
        gfx.fillColor = new Color(h.c.r, h.c.g, h.c.b, h.a);
        gfx.circle(moonX, moonY, h.r);
        gfx.fill();
    }
    // Blood moon solid face
    gfx.fillColor = new Color(214, 48, 49, 255);
    gfx.circle(moonX, moonY, 30);
    gfx.fill();

    // Lunar ink crater silhouettes (血月暗斑)
    gfx.fillColor = new Color(130, 20, 20, 150);
    gfx.circle(moonX - 7, moonY + 6, 9);  gfx.fill();
    gfx.circle(moonX + 9, moonY - 5, 12); gfx.fill();
    gfx.circle(moonX - 4, moonY - 10, 6); gfx.fill();

    // Subtle golden moon rim
    gfx.strokeColor = new Color(255, 230, 150, 120);
    gfx.lineWidth = 1.2;
    gfx.circle(moonX, moonY, 30);
    gfx.stroke();

    // ─── 3. Distant Ink Wash Stars & Drifting Embers (星芒与风动余烬) ────────
    for (let i = 0; i < STARS.length; i++) {
        const s = STARS[i];
        const isEmber = i % 4 === 0;
        if (isEmber) {
            gfx.fillColor = new Color(255, 71, 87, 160 + (i * 9) % 85);
            gfx.circle(s.x, s.y, s.r * 1.3);
        } else {
            gfx.fillColor = new Color(240, 245, 255, 120 + (i * 7) % 75);
            gfx.circle(s.x, s.y, s.r);
        }
        gfx.fill();
    }

    // ─── 4. Layered Misty Mountain Peaks (层峦叠嶂水墨群山) ──────────────────
    // Far mountain range (Soft indigo mist)
    gfx.fillColor = new Color(14, 20, 32, 230);
    gfx.moveTo(-hw, 80);
    gfx.lineTo(-140, 145);
    gfx.lineTo(-60, 110);
    gfx.lineTo(20, 165);
    gfx.lineTo(95, 125);
    gfx.lineTo(170, 180);
    gfx.lineTo(hw, 100);
    gfx.lineTo(hw, 40);
    gfx.lineTo(-hw, 40);
    gfx.closePath();
    gfx.fill();

    // Mid mountain range (Darker jagged peaks)
    gfx.fillColor = new Color(9, 13, 22, 255);
    gfx.moveTo(-hw, 60);
    gfx.lineTo(-170, 115);
    gfx.lineTo(-100, 75);
    gfx.lineTo(-20, 130);
    gfx.lineTo(60, 85);
    gfx.lineTo(130, 135);
    gfx.lineTo(hw, 70);
    gfx.lineTo(hw, -20);
    gfx.lineTo(-hw, -20);
    gfx.closePath();
    gfx.fill();

    // Ethereal drifting mist ribbon between mountains
    gfx.fillColor = new Color(200, 215, 235, 18);
    gfx.rect(-hw, 85, W, 14);
    gfx.fill();
    gfx.fillColor = new Color(200, 215, 235, 12);
    gfx.rect(-hw, 65, W, 22);
    gfx.fill();

    // ─── 5. Shaolin Pagoda Flying Eave Silhouettes (少林古刹飞檐角楼) ─────────
    // Left Pagoda roof (x: -220 to -140, y: 130 to 185)
    gfx.fillColor = new Color(7, 10, 16, 255);
    // Roof body
    gfx.moveTo(-220, 130);
    gfx.lineTo(-155, 130);
    gfx.lineTo(-145, 142); // flying eave curve tip
    gfx.lineTo(-175, 165);
    gfx.lineTo(-220, 165);
    gfx.closePath();
    gfx.fill();

    // Right Pagoda roof (mirror)
    gfx.moveTo(220, 130);
    gfx.lineTo(155, 130);
    gfx.lineTo(145, 142);
    gfx.lineTo(175, 165);
    gfx.lineTo(220, 165);
    gfx.closePath();
    gfx.fill();

    // Wind bell dot on eave tips
    gfx.fillColor = new Color(243, 156, 18, 160);
    gfx.circle(-145, 140, 2); gfx.fill();
    gfx.circle(145, 140, 2);  gfx.fill();

    // ─── 6. Ancient Martial Flagstone Ground (青石校场擂台 × 足球场线) ───────
    // Dark green weathered flagstone pitch base
    gfx.fillColor = new Color(18, 38, 28, 255);
    gfx.rect(-hw, -390, W, 150);
    gfx.fill();

    // Alternating flagstone tiles
    const tileW = W / 8;
    for (let i = 0; i < 8; i++) {
        if (i % 2 === 0) {
            gfx.fillColor = new Color(24, 48, 35, 180);
            gfx.rect(-hw + i * tileW, -390, tileW, 150);
            gfx.fill();
        }
    }

    // Subtle stone seam grid lines
    gfx.strokeColor = new Color(10, 24, 16, 160);
    gfx.lineWidth = 1.0;
    gfx.moveTo(-hw, -315); gfx.lineTo(hw, -315); gfx.stroke();

    // ─── 7. Soccer Pitch Calligraphy Markings (古风水墨白灰球场标线) ────────
    // Touchline / Ground line (y = -240)
    gfx.strokeColor = new Color(245, 245, 250, 175);
    gfx.lineWidth = 2.0;
    gfx.moveTo(-hw, -240);
    gfx.lineTo(hw, -240);
    gfx.stroke();

    // Penalty Area Box (禁区方正边界)
    gfx.strokeColor = new Color(245, 245, 250, 140);
    gfx.lineWidth = 1.8;
    gfx.rect(-85, -285, 170, 45);
    gfx.stroke();

    // Penalty Arc (禁区弧顶)
    gfx.strokeColor = new Color(245, 245, 250, 120);
    gfx.lineWidth = 1.5;
    gfx.arc(0, -285, 32, 0, Math.PI, true);
    gfx.stroke();

    // Center Penalty Spot (点球白金石印)
    gfx.fillColor = new Color(255, 255, 255, 180);
    gfx.circle(0, -240, 3.5);
    gfx.fill();

    // ─── 8. Golden Flash Overlay on Mega Kicks ──────────────────────────────
    if (flashAlpha > 0) {
        const fa = Math.floor(Math.max(0, Math.min(1, flashAlpha)) * 255);
        gfx.fillColor = new Color(255, 250, 235, fa);
        gfx.rect(-hw, -hh, W, H);
        gfx.fill();
    }
}
