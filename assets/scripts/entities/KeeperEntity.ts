/**
 * KeeperEntity.ts — 少林金刚护法罗汉·玄铁门神
 * 
 * 全面废黜原先的低质红色方块人，重构为具备新国风水墨质感的“少林金刚玄铁罗汉”：
 * 1. 关节铰接姿态系统 (Articulated Kinematics):
 *    - 巡视戒备 (Patrol Horse Stance): 沉雄马步，重心沉着踏步，金刚怒目，佛珠环绕微动；
 *    - 飞身扑救 (Vajra Palm Dive): 40°横向俯冲滑扑，单臂探出金刚大力掌印与横向水墨风刃；
 *    - 合十格挡 (Mountain Push Block): 双臂骤然合十紧绷，反震金光涟漪与梵文护印；
 *    - 疲劳喘息 (Fatigued Opening): 扑救后短暂停歇，双肩下沉喘息，汗珠水墨微粒，产生破绽期；
 *    - 凌空击飞 (KO Knockback): 遭遇超级球大招时，金钟罩琉璃爆碎，罗汉失重旋身腾空，碎石金屑狂飙。
 * 2. 金刚八卦琉璃神钟 (Vajra Golden Bell Shield):
 *    - 八面鎏金结界，外环 6 颗自转金光佛珠，核心篆刻古印【罡】/【镇】；
 *    - 截挡时荡漾金色冲击波，破盾时触发物理多边形碎片爆散。
 * 3. 双渲染管线: Canvas 2D 高清滤镜发光渲染 + Cocos Graphics 高品质矢量降级保护。
 */
import { Color, Graphics } from 'cc';
import { CONFIG } from '../Config';

interface VajraShard {
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vRot: number;
    size: number;
    color: string;
    alpha: number;
    life: number;
    maxLife: number;
}

export class KeeperEntity {
    public x: number = 0;
    public y: number = CONFIG.LAYOUT.KEEPER_Y;
    public vx: number = 2.4;
    public r: number = 24;
    public shieldAngle: number = 0;
    public hasShield: boolean = true;
    public shieldHp: number = 3;
    public maxShieldHp: number = 3;
    public flying: boolean = false;
    public vy: number = 0;
    public rot: number = 0;
    public diveDir: number = 0;   // 0=none, 1=right, -1=left
    public diveTimer: number = 0;
    public fatigueTimer: number = 0;
    public blockTimer: number = 0;
    public alpha: number = 1.0;

    private _animTimer: number = 0;
    private _baseSpeed: number = 2.4;
    private _shieldPulse: number = 0;
    private _shards: VajraShard[] = [];
    private _blockFlash: number = 0;

    public reset(stage: number): void {
        this.x = 0;
        this.y = CONFIG.LAYOUT.KEEPER_Y;
        this._baseSpeed = 2.2 + stage * 0.32;
        this.vx = this._baseSpeed * (Math.random() < 0.5 ? 1 : -1);
        this.maxShieldHp = stage === 1 ? 2 : Math.min(5, 2 + stage);
        this.shieldHp = this.maxShieldHp;
        this.hasShield = true;
        this.flying = false;
        this.vy = 0;
        this.rot = 0;
        this.diveDir = 0;
        this.diveTimer = 0;
        this.fatigueTimer = 0;
        this.blockTimer = 0;
        this.alpha = 1.0;
        this.shieldAngle = 0;
        this._shieldPulse = 0;
        this._shards = [];
    }

    /**
     * 遭受攻击破盾判定：
     * 每次击中金钟罩扣除 1 点护盾 HP，护盾彻底破碎前不会被击飞
     */
    public hitShield(dmg: number): { broken: boolean; currentHp: number } {
        this.shieldHp = Math.max(0, this.shieldHp - 1);
        this.triggerBlock(this.x, this.y, true);
        if (this.shieldHp <= 0) {
            this.hasShield = false;
            const sp = this.getShieldPosition();
            this._spawnShatterShards(sp.x, sp.y);
            return { broken: true, currentHp: 0 };
        }
        return { broken: false, currentHp: this.shieldHp };
    }

    /**
     * 罗汉回旋反抽 (Counter-Smash)：
     * 守门员截挡后将球大力抽射回场，球速大幅提升，迫使玩家极限反应！
     */
    public counterSmash(ball: { vx: number; vy: number; x: number; y: number }): void {
        const speed = Math.max(16, Math.hypot(ball.vx, ball.vy) * 1.25);
        const counterAngle = -Math.PI / 2 + (this.x < 0 ? 0.22 : -0.22) + (Math.random() - 0.5) * 0.25;
        ball.vx = Math.cos(counterAngle) * speed;
        ball.vy = Math.sin(counterAngle) * speed;
        this.triggerBlock(this.x, this.y, false);
    }

    /**
     * 获取金刚神钟护盾的当前世界坐标
     */
    public getShieldPosition(): { x: number; y: number } {
        return {
            x: this.x + Math.cos(this.shieldAngle) * 38,
            y: this.y + Math.sin(this.shieldAngle) * 16,
        };
    }

    /**
     * 触发成功格挡反馈 (震颤、金刚法印涟漪)
     */
    public triggerBlock(hitX?: number, hitY?: number, isShield: boolean = false): void {
        this.blockTimer = 14;
        this._blockFlash = 1.0;
        if (isShield) {
            this._shieldPulse = 1.0;
        }
    }

    /**
     * 超级球或必杀技破防KO：金钟罩爆碎，罗汉腾空旋转飞出！
     */
    public knockback(): void {
        this.flying = true;
        this.vy = 16 + Math.random() * 4;
        this.vx = (Math.random() - 0.5) * 12;
        this.diveDir = 0;
        this.diveTimer = 0;
        this.blockTimer = 0;

        // 爆散 18~24 块金刚琉璃破损结晶碎片
        const shieldPos = this.getShieldPosition();
        this._spawnShatterShards(shieldPos.x, shieldPos.y);
        this._spawnShatterShards(this.x, this.y);
    }

    private _spawnShatterShards(cx: number, cy: number): void {
        const shardColors = ['#FFD700', '#F59E0B', '#FDE68A', '#FFFFFF', '#D97706'];
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 4 + Math.random() * 11;
            const life = 35 + Math.floor(Math.random() * 25);
            this._shards.push({
                x: cx + (Math.random() - 0.5) * 16,
                y: cy + (Math.random() - 0.5) * 16,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                rot: Math.random() * Math.PI * 2,
                vRot: (Math.random() - 0.5) * 0.45,
                size: 4 + Math.random() * 7,
                color: shardColors[Math.floor(Math.random() * shardColors.length)],
                alpha: 1.0,
                life,
                maxLife: life,
            });
        }
    }

    public update(balls: { x: number; y: number; vx: number; vy: number }[], stage: number): void {
        this._animTimer += 0.05;
        this.shieldAngle += 0.052;
        this._shieldPulse = Math.max(0, this._shieldPulse - 0.07);
        this._blockFlash = Math.max(0, this._blockFlash - 0.08);

        // 更新爆碎金刚琉璃碎片
        for (let i = this._shards.length - 1; i >= 0; i--) {
            const s = this._shards[i];
            s.x += s.vx;
            s.y += s.vy;
            s.vy -= 0.35; // 重力下坠
            s.rot += s.vRot;
            s.life--;
            s.alpha = Math.max(0, s.life / s.maxLife);
            if (s.life <= 0) {
                this._shards.splice(i, 1);
            }
        }

        // 击飞升空状态
        if (this.flying) {
            this.x += this.vx;
            this.y += this.vy;
            this.vy -= CONFIG.GRAVITY * 1.25;
            this.rot += 0.16;
            if (this.y < -CONFIG.H / 2 - 80) {
                // 从天际回落重置守门
                this.reset(stage);
                this.y = CONFIG.WALL_TOP + 25;
            }
            return;
        }

        // 扑救冷却与恢复
        if (this.blockTimer > 0) this.blockTimer--;
        if (this.fatigueTimer > 0) this.fatigueTimer--;

        if (this.diveTimer > 0) {
            // 爆发扑救冲刺
            this.x += this.diveDir * 9.2;
            this.x = Math.max(-185, Math.min(185, this.x));
            this.diveTimer--;
            if (this.diveTimer === 0) {
                this.fatigueTimer = 60; // 扑救后留下 1 秒虚弱破绽期！
            }
            return;
        }

        // ── 智能预判扑救 AI ─────────────────────────────
        let targetX = this.x;
        let nearestBallDist = Infinity;

        for (const ball of balls) {
            // 仅锁定朝守门员飞来的上行球 (vy > 0)
            if (ball.vy <= 0) continue;
            const dist = Math.hypot(ball.x - this.x, ball.y - this.y);
            if (dist < nearestBallDist) {
                nearestBallDist = dist;
                const dy = this.y - ball.y;
                if (Math.abs(ball.vy) > 0.1) {
                    const t = dy / ball.vy;
                    targetX = ball.x + ball.vx * t;
                } else {
                    targetX = ball.x;
                }
                targetX = Math.max(-185, Math.min(185, targetX));
            }
        }

        // 横移归位与拦截
        const dx = targetX - this.x;
        const currentSpeed = this.fatigueTimer > 0 ? this._baseSpeed * 0.45 : this._baseSpeed;
        const step = nearestBallDist < Infinity ? currentSpeed * 1.05 : currentSpeed * 0.72;
        this.x += Math.sign(dx) * Math.min(Math.abs(dx), step);

        // 边界回弹
        if (this.x < -185) { this.x = -185; this.vx = Math.abs(this.vx); }
        if (this.x > 185) { this.x = 185; this.vx = -Math.abs(this.vx); }

        // 危险近距离触发飞身扑救
        if (nearestBallDist < 72 && this.fatigueTimer === 0 && this.diveTimer === 0) {
            const nearestBall = balls.find(b => Math.hypot(b.x - this.x, b.y - this.y) < 72 && b.vy > 0);
            if (nearestBall) {
                this.diveDir = nearestBall.x > this.x ? 1 : -1;
                this.diveTimer = 18;
            }
        }
    }

    /**
     * 主绘制入口：优先采用 Canvas 2D 高清国潮发光渲染，并提供纯 Graphics 矢量降级
     */
    public draw(gfx: Graphics, ctx?: CanvasRenderingContext2D | null): void {
        const kx = this.x;
        const ky = this.y;

        // 1. 绘制足下阴影 (Graphics)
        this._drawGroundShadow(gfx, kx, ky);

        // 2. 绘制高清 2D Canvas 水墨金刚罗汉
        if (ctx) {
            const cw = ctx.canvas.width;
            const ch = ctx.canvas.height;
            const scale = Math.min(cw / 440, ch / 780);
            const cx = cw / 2 + kx * scale;
            const cy = ch / 2 - ky * scale;

            ctx.save();

            // 绘制爆散的金刚琉璃碎片
            this._drawCanvasShards(ctx, cw, ch, scale);

            // 根据状态铰接不同武术姿态
            if (this.flying) {
                this._drawFlyingArhat(ctx, cx, cy, scale);
            } else if (this.diveTimer > 0) {
                this._drawDiveArhat(ctx, cx, cy, scale);
            } else if (this.blockTimer > 0) {
                this._drawBlockArhat(ctx, cx, cy, scale);
            } else if (this.fatigueTimer > 0) {
                this._drawFatiguedArhat(ctx, cx, cy, scale);
            } else {
                this._drawPatrolArhat(ctx, cx, cy, scale);
            }

            // 绘制金刚八卦琉璃神钟
            if (this.hasShield && !this.flying) {
                this._drawGoldenBellShield(ctx, cw, ch, scale);
            }

            ctx.restore();
        } else {
            // Graphics 矢量降级 (绝不回到老旧红色方块)
            this._drawVectorFallback(gfx, kx, ky);
        }
    }

    /**
     * 足下沉重马步阴影
     */
    private _drawGroundShadow(gfx: Graphics, x: number, y: number): void {
        const shadowAlpha = this.flying ? Math.max(10, Math.round(50 * (1 - Math.abs(this.vy) * 0.05))) : 75;
        const shadowW = this.diveTimer > 0 ? 32 : (this.flying ? 18 : 28);
        const shadowH = this.flying ? 8 : 12;

        gfx.fillColor = new Color(0, 0, 0, shadowAlpha);
        gfx.circle(x, y - 32, shadowH);
        gfx.fill();
        gfx.rect(x - shadowW / 2, y - 36, shadowW, shadowH * 0.8);
        gfx.fill();
    }

    // ─────────────────────────────────────────────────────────────
    // A. 巡逻戒备姿态 (Patrol Stance: 沉雄马步·金刚巡视)
    // ─────────────────────────────────────────────────────────────
    private _drawPatrolArhat(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
        const t = this._animTimer;
        const breathY = Math.sin(t * 3.5) * 1.5 * scale;
        const swayX = Math.sin(t * 1.8) * 1.8 * scale;

        ctx.save();
        ctx.translate(cx + swayX, cy + breathY);

        // 1. 健硕下盘马步双腿 (Sturdy Martial Stance Legs)
        this._drawLegs(ctx, scale, 0, false);

        // 2. 魁梧玄铁铠甲躯干 (Iron Muscle Torso & Pauldrons)
        this._drawTorsoAndPauldrons(ctx, scale, 0);

        // 3. 九品沉香大佛珠 (Vajra Prayer Beads)
        this._drawPrayerBeads(ctx, scale, 0);

        // 4. 庄严金刚罗汉面庞与金光怒目 (Fierce Golden Eyes Head)
        this._drawArhatHead(ctx, scale, 0, false);

        // 5. 罗汉开门势守备双臂 (Guardian Iron Arms)
        this._drawPatrolArms(ctx, scale);

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // B. 飞身扑救姿态 (Dive Stance: 猛虎扑食·金刚翻江)
    // ─────────────────────────────────────────────────────────────
    private _drawDiveArhat(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
        const tilt = this.diveDir * 0.58; // 倾斜俯冲
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);

        // 飞身水墨横向气浪破风残影
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.moveTo(-this.diveDir * 28 * scale, 0);
        ctx.lineTo(this.diveDir * 36 * scale, 0);
        ctx.stroke();
        ctx.restore();

        // 伸展双腿
        this._drawLegs(ctx, scale, this.diveDir, true);

        // 倾斜躯干
        this._drawTorsoAndPauldrons(ctx, scale, tilt * 0.4);

        // 佛珠随气流向后拉扯
        this._drawPrayerBeads(ctx, scale, -this.diveDir * 0.4);

        // 咆哮面容
        this._drawArhatHead(ctx, scale, this.diveDir * 0.25, true);

        // 探出金刚大力掌 (Outstretched Divine Palms)
        this._drawDiveArms(ctx, scale, this.diveDir);

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // C. 触球合十格挡姿态 (Block Stance: 罗汉推山·万法不侵)
    // ─────────────────────────────────────────────────────────────
    private _drawBlockArhat(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
        const shakeX = (Math.random() - 0.5) * 3 * scale;
        const shakeY = (Math.random() - 0.5) * 3 * scale;

        ctx.save();
        ctx.translate(cx + shakeX, cy + shakeY);

        // 稳固马步下潜
        this._drawLegs(ctx, scale, 0, false);

        // 紧绷躯干带有淡金色受击高亮
        this._drawTorsoAndPauldrons(ctx, scale, 0, true);

        this._drawPrayerBeads(ctx, scale, 0);

        this._drawArhatHead(ctx, scale, 0, true);

        // 双臂十字交叉硬化格挡 (Iron Cross Block)
        this._drawBlockArms(ctx, scale);

        // 金刚冲击震荡环
        ctx.save();
        ctx.strokeStyle = `rgba(255, 215, 0, ${Math.min(1, this._blockFlash * 1.5)})`;
        ctx.lineWidth = 2.5 * scale;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12 * scale;
        ctx.beginPath();
        ctx.arc(0, 0, (26 + (1 - this._blockFlash) * 20) * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // D. 疲劳喘息姿态 (Fatigued Stance: 气机受挫·破绽初现)
    // ─────────────────────────────────────────────────────────────
    private _drawFatiguedArhat(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
        const pant = Math.sin(this._animTimer * 7.0) * 3.2 * scale;

        ctx.save();
        ctx.translate(cx, cy + pant);

        this._drawLegs(ctx, scale, 0, false);
        this._drawTorsoAndPauldrons(ctx, scale, 0);
        this._drawPrayerBeads(ctx, scale, 0);

        // 头部微垂
        ctx.save();
        ctx.translate(0, 4 * scale);
        this._drawArhatHead(ctx, scale, 0, false, true);
        ctx.restore();

        // 双臂下垂微喘
        this._drawFatiguedArms(ctx, scale);

        // 蒸腾汗珠微粒
        if (Math.random() < 0.3) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc((Math.random() - 0.5) * 16 * scale, -24 * scale, 1.2 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // E. 击飞升空旋转 (Flying KO Stance: 琉璃碎裂·倒栽横飞)
    // ─────────────────────────────────────────────────────────────
    private _drawFlyingArhat(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.rot);

        // 四肢在失重力矩下翻滚
        this._drawLegs(ctx, scale, 1, true);
        this._drawTorsoAndPauldrons(ctx, scale, 0.2);
        this._drawPrayerBeads(ctx, scale, 0.5);
        this._drawArhatHead(ctx, scale, 0, true);

        // 甩开的双臂
        ctx.fillStyle = '#1E232A';
        ctx.beginPath();
        ctx.rect(-24 * scale, -10 * scale, 10 * scale, 22 * scale);
        ctx.rect(14 * scale, -18 * scale, 10 * scale, 24 * scale);
        ctx.fill();

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // 细节绘制组件 (Detailed Anatomical Anatomy)
    // ─────────────────────────────────────────────────────────────

    private _drawLegs(ctx: CanvasRenderingContext2D, scale: number, dir: number, isDiving: boolean): void {
        ctx.save();
        ctx.fillStyle = '#171B22'; // 深墨色宽幅僧裤
        ctx.strokeStyle = '#2D3748';
        ctx.lineWidth = 1.2 * scale;

        if (isDiving) {
            // 俯冲伸腿
            ctx.beginPath();
            ctx.rect(-dir * 18 * scale, 8 * scale, 11 * scale, 22 * scale);
            ctx.rect(dir * 4 * scale, 12 * scale, 12 * scale, 18 * scale);
            ctx.fill();
            ctx.stroke();
        } else {
            // 沉稳马步双腿 (外八字站桩)
            // 左腿
            ctx.beginPath();
            ctx.moveTo(-16 * scale, 6 * scale);
            ctx.lineTo(-24 * scale, 26 * scale);
            ctx.lineTo(-12 * scale, 26 * scale);
            ctx.lineTo(-6 * scale, 6 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 右腿
            ctx.beginPath();
            ctx.moveTo(6 * scale, 6 * scale);
            ctx.lineTo(12 * scale, 26 * scale);
            ctx.lineTo(24 * scale, 26 * scale);
            ctx.lineTo(16 * scale, 6 * scale);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // 精钢护胫与白布绑腿 (White Leg Wraps & Shin Guards)
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(-22 * scale, 18 * scale, 8 * scale, 7 * scale);
            ctx.fillRect(14 * scale, 18 * scale, 8 * scale, 7 * scale);

            // 暗金护膝 (Golden Knee Guards)
            ctx.fillStyle = '#D97706';
            ctx.beginPath();
            ctx.arc(-14 * scale, 14 * scale, 3.5 * scale, 0, Math.PI * 2);
            ctx.arc(14 * scale, 14 * scale, 3.5 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private _drawTorsoAndPauldrons(ctx: CanvasRenderingContext2D, scale: number, tilt: number, isHitFlash: boolean = false): void {
        ctx.save();
        ctx.rotate(tilt);

        // 1. 玄铁胸铠基底 (Dark Steel Torso)
        ctx.fillStyle = isHitFlash ? '#FEF08A' : '#1A202C';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5 * scale;

        ctx.beginPath();
        // 倒三角魁梧上身
        ctx.moveTo(-20 * scale, -14 * scale);
        ctx.lineTo(20 * scale, -14 * scale);
        ctx.lineTo(13 * scale, 8 * scale);
        ctx.lineTo(-13 * scale, 8 * scale);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 2. 胸甲内层冷锻钢纹
        ctx.fillStyle = '#2D3748';
        ctx.fillRect(-12 * scale, -10 * scale, 24 * scale, 12 * scale);

        // 3. 赤金武僧戒带 (Crimson Martial Sash)
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(-14 * scale, 4 * scale, 28 * scale, 5 * scale);
        // 青铜狮蛮搭扣 (Bronze Belt Lion Buckle)
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 6.5 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();

        // 4. 左右玄铁兽首肩甲 (Dark Steel Pauldrons with Golden Trim)
        // 左肩
        ctx.fillStyle = '#171923';
        ctx.beginPath();
        ctx.arc(-21 * scale, -13 * scale, 8 * scale, Math.PI * 0.5, Math.PI * 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.8 * scale;
        ctx.stroke();

        // 右肩
        ctx.fillStyle = '#171923';
        ctx.beginPath();
        ctx.arc(21 * scale, -13 * scale, 8 * scale, Math.PI * 1.2, Math.PI * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.8 * scale;
        ctx.stroke();

        // 5. 胸口少林金刚神符印记 (Golden Shaolin Vajra Emblem)
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(-4 * scale, -4 * scale);
        ctx.lineTo(4 * scale, -4 * scale);
        ctx.moveTo(0, -8 * scale);
        ctx.lineTo(0, 0);
        ctx.stroke();

        ctx.restore();
    }

    private _drawPrayerBeads(ctx: CanvasRenderingContext2D, scale: number, beadOffset: number): void {
        ctx.save();
        // 环绕颈肩的大号沉香念珠
        const beadCount = 8;
        const radiusX = 14 * scale;
        const radiusY = 10 * scale;

        for (let i = 0; i < beadCount; i++) {
            const angle = (i / beadCount) * Math.PI + Math.PI + beadOffset;
            const bx = Math.cos(angle) * radiusX;
            const by = -12 * scale + Math.sin(angle) * radiusY;

            // 木质佛珠渐变光泽
            ctx.fillStyle = '#3E2723';
            ctx.beginPath();
            ctx.arc(bx, by, 3.2 * scale, 0, Math.PI * 2);
            ctx.fill();

            // 高光
            ctx.fillStyle = '#D7CCC8';
            ctx.beginPath();
            ctx.arc(bx - 0.8 * scale, by - 0.8 * scale, 0.9 * scale, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    private _drawArhatHead(
        ctx: CanvasRenderingContext2D,
        scale: number,
        lookDir: number,
        isRoaring: boolean = false,
        isFatigued: boolean = false
    ): void {
        const headY = -23 * scale;

        ctx.save();
        ctx.translate(lookDir * 3 * scale, headY);

        // 1. 古铜光泽罗汉光头 (Bronze Monk Head)
        ctx.fillStyle = '#C48458';
        ctx.beginPath();
        ctx.arc(0, 0, 11 * scale, 0, Math.PI * 2);
        ctx.fill();

        // 下颌硬朗阴影
        ctx.fillStyle = '#9C5B32';
        ctx.beginPath();
        ctx.arc(0, 3 * scale, 9 * scale, 0, Math.PI);
        ctx.fill();

        // 2. 六点金刚戒疤 (Six Incense Burn Dots on Forehead)
        ctx.fillStyle = '#FEF08A';
        const dotR = 0.8 * scale;
        for (let row = -1; row <= 1; row += 2) {
            for (let col = -1; col <= 1; col++) {
                ctx.beginPath();
                ctx.arc(col * 2.8 * scale, -6 * scale + row * 1.5 * scale, dotR, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 3. 浓墨剑眉 (Angry Brows)
        ctx.strokeStyle = '#1F2937';
        ctx.lineWidth = 2.2 * scale;
        ctx.beginPath();
        // 紧锁怒目双眉
        ctx.moveTo(-7 * scale, -3 * scale);
        ctx.lineTo(-1 * scale, -1 * scale);
        ctx.moveTo(1 * scale, -1 * scale);
        ctx.lineTo(7 * scale, -3 * scale);
        ctx.stroke();

        // 4. 金刚怒目 (Piercing Amber-Gold Eyes)
        ctx.save();
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8 * scale;
        ctx.fillStyle = isFatigued ? '#F59E0B' : '#FFE600';

        // 左目
        ctx.beginPath();
        ctx.ellipse(-4 * scale, 0, 2.2 * scale, 1.2 * scale, -0.2, 0, Math.PI * 2);
        ctx.fill();
        // 右目
        ctx.beginPath();
        ctx.ellipse(4 * scale, 0, 2.2 * scale, 1.2 * scale, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 5. 口部 (嘴型：咆哮 vs 沉毅)
        if (isRoaring) {
            ctx.fillStyle = '#450A0A';
            ctx.beginPath();
            ctx.arc(0, 5 * scale, 3 * scale, 0, Math.PI);
            ctx.fill();
        } else {
            ctx.strokeStyle = '#451A03';
            ctx.lineWidth = 1.2 * scale;
            ctx.beginPath();
            ctx.moveTo(-3 * scale, 5 * scale);
            ctx.lineTo(3 * scale, 5 * scale);
            ctx.stroke();
        }

        ctx.restore();
    }

    private _drawPatrolArms(ctx: CanvasRenderingContext2D, scale: number): void {
        ctx.save();
        ctx.fillStyle = '#1A202C';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.2 * scale;

        // 左臂：曲臂立掌护胸
        ctx.beginPath();
        ctx.rect(-24 * scale, -10 * scale, 8 * scale, 18 * scale);
        ctx.fill();
        ctx.stroke();

        // 右臂：前探蓄势铁拳
        ctx.beginPath();
        ctx.rect(16 * scale, -10 * scale, 8 * scale, 18 * scale);
        ctx.fill();
        ctx.stroke();

        // 掌心金刚内劲光辉
        ctx.fillStyle = '#C48458';
        ctx.beginPath();
        ctx.arc(-20 * scale, 10 * scale, 3.8 * scale, 0, Math.PI * 2);
        ctx.arc(20 * scale, 10 * scale, 3.8 * scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    private _drawDiveArms(ctx: CanvasRenderingContext2D, scale: number, dir: number): void {
        ctx.save();
        ctx.fillStyle = '#1A202C';

        // 迎球侧前臂笔直探出
        const leadX = dir * 26 * scale;
        ctx.beginPath();
        ctx.rect(leadX - 5 * scale, -6 * scale, 12 * scale, 24 * scale);
        ctx.fill();

        // 金刚大力掌法虚影 (Giant Radiant Golden Palm Qi)
        ctx.save();
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 14 * scale;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.85)';
        ctx.beginPath();
        ctx.arc(leadX + dir * 6 * scale, 20 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    private _drawBlockArms(ctx: CanvasRenderingContext2D, scale: number): void {
        ctx.save();
        ctx.fillStyle = '#1A202C';
        ctx.strokeStyle = '#FEF08A';
        ctx.lineWidth = 1.6 * scale;

        // 双臂在胸前交叉死死锁紧 (Iron Cross Guard)
        ctx.beginPath();
        ctx.moveTo(-18 * scale, -10 * scale);
        ctx.lineTo(14 * scale, 10 * scale);
        ctx.moveTo(18 * scale, -10 * scale);
        ctx.lineTo(-14 * scale, 10 * scale);
        ctx.stroke();

        ctx.restore();
    }

    private _drawFatiguedArms(ctx: CanvasRenderingContext2D, scale: number): void {
        ctx.save();
        ctx.fillStyle = '#1A202C';
        // 双手撑在膝盖上
        ctx.fillRect(-22 * scale, -2 * scale, 7 * scale, 22 * scale);
        ctx.fillRect(15 * scale, -2 * scale, 7 * scale, 22 * scale);
        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // F. 金刚八卦琉璃神钟 (Vajra Golden Bell Shield)
    // ─────────────────────────────────────────────────────────────
    private _drawGoldenBellShield(
        ctx: CanvasRenderingContext2D,
        cw: number,
        ch: number,
        scale: number
    ): void {
        const shieldPos = this.getShieldPosition();
        const sx = cw / 2 + shieldPos.x * scale;
        const sy = ch / 2 - shieldPos.y * scale;
        const baseR = (22 + this._shieldPulse * 7) * scale;
        const angle = this.shieldAngle;

        ctx.save();
        ctx.translate(sx, sy);

        // 1. 金光外耀气罩 (Luminous Golden Aura)
        ctx.save();
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = (15 + this._shieldPulse * 15) * scale;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.28 + this._shieldPulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(0, 0, baseR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 2. 正八边形八卦琉璃法盘 (Octagonal Sacred Barrier)
        ctx.save();
        ctx.rotate(angle);
        ctx.strokeStyle = '#FCD34D';
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        const sides = 8;
        for (let i = 0; i < sides; i++) {
            const a = (i / sides) * Math.PI * 2;
            const px = Math.cos(a) * baseR;
            const py = Math.sin(a) * baseR;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // 内层十字降魔符线
        ctx.strokeStyle = 'rgba(255, 230, 100, 0.45)';
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(-baseR * 0.7, 0); ctx.lineTo(baseR * 0.7, 0);
        ctx.moveTo(0, -baseR * 0.7); ctx.lineTo(0, baseR * 0.7);
        ctx.stroke();
        ctx.restore();

        // 3. 外环自转的 6 颗流光金刚宝珠 (Orbiting Sanskrit Beads)
        const orbCount = 6;
        for (let i = 0; i < orbCount; i++) {
            const orbA = -angle * 1.5 + (i / orbCount) * Math.PI * 2;
            const ox = Math.cos(orbA) * (baseR + 4 * scale);
            const oy = Math.sin(orbA) * (baseR + 4 * scale);

            ctx.fillStyle = '#FFE600';
            ctx.beginPath();
            ctx.arc(ox, oy, 2.4 * scale, 0, Math.PI * 2);
            ctx.fill();
        }

        // 4. 核心古篆法印【罡】 (Ancient Invulnerable Vajra Seal)
        ctx.save();
        ctx.fillStyle = '#FFFBEB';
        ctx.font = `900 ${Math.round(13 * scale)}px "PingFang SC", "SimHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#D97706';
        ctx.shadowBlur = 4 * scale;
        ctx.fillText('罡', 0, 1 * scale);
        ctx.restore();

        // 5. 护盾层数指示 (Shield HP Pips: 3/3 -> 2/3 -> 1/3)
        const pipW = 7 * scale;
        const pipH = 3.5 * scale;
        const totalPipsW = this.maxShieldHp * (pipW + 3 * scale);
        const pipStartX = -totalPipsW / 2;
        const pipY = -baseR - 11 * scale;

        for (let p = 0; p < this.maxShieldHp; p++) {
            const px = pipStartX + p * (pipW + 3 * scale);
            const isAlive = p < this.shieldHp;
            ctx.fillStyle = isAlive ? '#FEF08A' : 'rgba(71, 85, 105, 0.45)';
            ctx.strokeStyle = isAlive ? '#F59E0B' : '#334155';
            ctx.lineWidth = 1 * scale;
            ctx.beginPath();
            ctx.rect(px, pipY, pipW, pipH);
            ctx.fill();
            ctx.stroke();
        }

        // 临近破碎警戒残红裂痕 (Cracking warning when only 1 shield left)
        if (this.shieldHp === 1) {
            ctx.strokeStyle = '#EF4444';
            ctx.lineWidth = 1.6 * scale;
            ctx.beginPath();
            ctx.moveTo(-baseR * 0.45, -baseR * 0.35);
            ctx.lineTo(0, baseR * 0.1);
            ctx.lineTo(baseR * 0.5, baseR * 0.45);
            ctx.stroke();
        }

        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // G. 金钟罩爆碎碎片 (Canvas Shards Rendering)
    // ─────────────────────────────────────────────────────────────
    private _drawCanvasShards(
        ctx: CanvasRenderingContext2D,
        cw: number,
        ch: number,
        scale: number
    ): void {
        if (this._shards.length === 0) return;

        ctx.save();
        for (const s of this._shards) {
            const sx = cw / 2 + s.x * scale;
            const sy = ch / 2 - s.y * scale;

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(s.rot);
            ctx.globalAlpha = s.alpha;
            ctx.fillStyle = s.color;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 6 * scale;

            // 绘制尖锐多边形琉璃水晶碎片
            ctx.beginPath();
            const sz = s.size * scale;
            ctx.moveTo(-sz * 0.6, -sz * 0.8);
            ctx.lineTo(sz * 0.8, -sz * 0.3);
            ctx.lineTo(sz * 0.4, sz * 0.7);
            ctx.lineTo(-sz * 0.7, sz * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // ─────────────────────────────────────────────────────────────
    // H. Cocos Graphics 矢量降级后备 (Vector Fallback)
    // ─────────────────────────────────────────────────────────────
    private _drawVectorFallback(gfx: Graphics, kx: number, ky: number): void {
        const bodyAlpha = Math.round(this.alpha * 255);
        const tilt = this.diveDir !== 0 ? this.diveDir * 0.35 : 0;
        const bodyX = kx + Math.sin(tilt) * 12;
        const bodyY = ky;

        // 健硕躯干
        gfx.fillColor = new Color(26, 32, 44, bodyAlpha);
        gfx.rect(bodyX - 16, bodyY - 14, 32, 28);
        gfx.fill();

        // 金刚赤红戒带
        gfx.fillColor = new Color(220, 38, 38, bodyAlpha);
        gfx.rect(bodyX - 16, bodyY - 10, 32, 6);
        gfx.fill();

        // 头部
        gfx.fillColor = new Color(196, 132, 88, bodyAlpha);
        gfx.circle(bodyX, bodyY + 22, 12);
        gfx.fill();

        // 金刚怒目
        gfx.fillColor = new Color(255, 230, 0, bodyAlpha);
        gfx.circle(bodyX - 4, bodyY + 22, 2.5);
        gfx.fill();
        gfx.circle(bodyX + 4, bodyY + 22, 2.5);
        gfx.fill();

        // 护盾
        if (this.hasShield && !this.flying) {
            const sp = this.getShieldPosition();
            gfx.fillColor = new Color(255, 215, 0, 70);
            gfx.circle(sp.x, sp.y, 24);
            gfx.fill();
            gfx.strokeColor = new Color(245, 158, 11, bodyAlpha);
            gfx.lineWidth = 2;
            gfx.circle(sp.x, sp.y, 18);
            gfx.stroke();
        }
    }
}
