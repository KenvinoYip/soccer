/**
 * Shaolin Soccer - PhysicsSystem
 * Handles trajectory prediction, per-frame kinematics, and collision detection / resolution.
 * Coordinate space: Cocos Creator 3.8 (Center 0,0, Y-Up).
 */

import { BallData, BrickData, CONFIG } from '../Config';

export class PhysicsSystem {
  /**
   * Predicts ball trajectory points for aiming arc display.
   * Stops simulation if the path crosses the ground or exits canvas boundaries.
   */
  public predictTrajectory(
    startX: number,
    startY: number,
    vx: number,
    vy: number,
    gravity: number = CONFIG.PHYSICS.GRAVITY,
    steps: number = 25
  ): { x: number; y: number }[] {
    let curX = startX;
    let curY = startY;
    let curVx = vx;
    let curVy = vy;

    const points: { x: number; y: number }[] = [{ x: curX, y: curY }];
    const halfW = CONFIG.CANVAS.HALF_W;
    const halfH = CONFIG.CANVAS.HALF_H;
    const groundY = CONFIG.LAYOUT.GROUND_Y;

    for (let i = 0; i < steps; i++) {
      curX += curVx;
      curVy -= gravity;
      curY += curVy;

      // Stop if ball hits or drops below the ground level
      if (curY <= groundY) {
        points.push({ x: curX, y: groundY });
        break;
      }

      // Stop if ball leaves screen width or top bound
      if (curX < -halfW || curX > halfW || curY > halfH) {
        points.push({ x: curX, y: curY });
        break;
      }

      points.push({ x: curX, y: curY });
    }

    return points;
  }

  /**
   * Updates ball velocity with gravity, updates position, advances rotation,
   * and records position history in trail array (capped at max 12 points).
   */
  public moveBall(ball: BallData, gravity: number = CONFIG.PHYSICS.GRAVITY): void {
    // Kinematics update (Y is UP in Cocos Creator)
    ball.x += ball.vx;
    ball.vy -= gravity;
    ball.y += ball.vy;

    // Angular rotation based on horizontal linear speed
    const ballRadius = ball.r > 0 ? ball.r : CONFIG.LAYOUT.BALL_RADIUS;
    ball.rot += (ball.vx / ballRadius) * 0.45;

    // Trail management (maximum 12 history entries)
    ball.trail.unshift({ x: ball.x, y: ball.y, alpha: 1.0 });
    const maxTrail = CONFIG.PHYSICS.TRAIL_MAX_POINTS;
    if (ball.trail.length > maxTrail) {
      ball.trail.length = maxTrail;
    }

    // Smoothly attenuate alpha along the trail
    for (let i = 0; i < ball.trail.length; i++) {
      ball.trail[i].alpha = Math.max(0, 1.0 - i / maxTrail);
    }
  }

  /**
   * Circle vs AABB rectangle collision detection between ball and brick.
   * Assumes brick anchor is at its geometric center (brick.x, brick.y).
   */
  public checkBallBrickCollision(ball: BallData, brick: BrickData): boolean {
    if (brick.hp <= 0) return false;

    // Brick coordinates (x, y) represent bottom-left corner with width w and height h
    const minX = brick.x;
    const maxX = brick.x + brick.w;
    const minY = brick.y;
    const maxY = brick.y + brick.h;

    // Find the closest point on the brick AABB to the ball center
    const closestX = Math.max(minX, Math.min(ball.x, maxX));
    const closestY = Math.max(minY, Math.min(ball.y, maxY));

    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const distSq = dx * dx + dy * dy;

    return distSq <= ball.r * ball.r;
  }

  /**
   * Resolves ball bounce against a brick surface and adjusts ball velocity.
   */
  public resolveBallBrickBounce(
    ball: BallData,
    brick: BrickData,
    elasticity: number = CONFIG.PHYSICS.BRICK_BOUNCE
  ): { hit: boolean; normalX: number; normalY: number } {
    if (!this.checkBallBrickCollision(ball, brick)) {
      return { hit: false, normalX: 0, normalY: 0 };
    }

    const centerX = brick.x + brick.w / 2;
    const centerY = brick.y + brick.h / 2;
    const halfW = brick.w / 2;
    const halfH = brick.h / 2;
    const dx = ball.x - centerX;
    const dy = ball.y - centerY;

    const overlapX = halfW + ball.r - Math.abs(dx);
    const overlapY = halfH + ball.r - Math.abs(dy);

    let normalX = 0;
    let normalY = 0;

    if (overlapX < overlapY) {
      // Lateral collision (left or right face)
      normalX = dx > 0 ? 1 : -1;
      ball.vx = -ball.vx * elasticity;
      ball.x = centerX + (halfW + ball.r) * normalX;
    } else {
      // Vertical collision (top or bottom face)
      normalY = dy > 0 ? 1 : -1;
      ball.vy = -ball.vy * elasticity;
      ball.y = centerY + (halfH + ball.r) * normalY;
    }

    return { hit: true, normalX, normalY };
  }

  /**
   * Circle vs Circle collision detection between ball and goalkeeper.
   */
  public checkBallKeeperCollision(ball: BallData, keeper: { x: number; y: number; r: number }): boolean {
    const dx = ball.x - keeper.x;
    const dy = ball.y - keeper.y;
    const distSq = dx * dx + dy * dy;
    const radiusSum = ball.r + keeper.r;
    return distSq <= radiusSum * radiusSum;
  }

  /**
   * Reflects ball velocity away from goalkeeper center with dynamic push-out.
   */
  public reflectBallOffKeeper(ball: BallData, keeper: { x: number; y: number; r?: number }): void {
    let dx = ball.x - keeper.x;
    let dy = ball.y - keeper.y;
    let dist = Math.hypot(dx, dy);

    if (dist <= 0.0001) {
      dx = 0;
      dy = 1;
      dist = 1;
    }

    const nx = dx / dist;
    const ny = dy / dist;

    // Normal velocity component
    const dot = ball.vx * nx + ball.vy * ny;

    if (dot < 0) {
      // Elastic reflection along contact normal
      ball.vx = ball.vx - 2 * dot * nx;
      ball.vy = ball.vy - 2 * dot * ny;
    } else {
      // Ball is already moving outward; apply extra push
      ball.vx += nx * 5;
      ball.vy += ny * 5;
    }

    // Maintain dynamic speed feel
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    const deflectedSpeed = Math.max(currentSpeed * 0.95, CONFIG.PHYSICS.BALL_MIN_SPEED);
    const deflectionAngle = Math.atan2(ball.vy, ball.vx);

    ball.vx = Math.cos(deflectionAngle) * deflectedSpeed;
    ball.vy = Math.sin(deflectionAngle) * deflectedSpeed;

    // Displace ball outside keeper body to avoid sticky overlap
    const keeperRadius = keeper.r !== undefined ? keeper.r : CONFIG.LAYOUT.KEEPER_RADIUS;
    const safeDistance = ball.r + keeperRadius + 1.5;
    if (dist < safeDistance) {
      ball.x = keeper.x + nx * safeDistance;
      ball.y = keeper.y + ny * safeDistance;
    }
  }

  /**
   * Checks whether the ball has exited the canvas viewport.
   * Coordinate origin: Center (0, 0), bounds: [-W/2, W/2] and [-H/2, H/2].
   */
  public isOutOfBounds(ball: BallData, W: number = CONFIG.CANVAS.W, H: number = CONFIG.CANVAS.H): boolean {
    const halfW = W / 2;
    const halfH = H / 2;
    return (
      ball.x + ball.r < -halfW ||
      ball.x - ball.r > halfW ||
      ball.y + ball.r < -halfH ||
      ball.y - ball.r > halfH
    );
  }

  /**
   * Helper to bounce ball off lateral screen borders [-halfW, halfW].
   */
  public handleWallBounce(ball: BallData, halfW: number = CONFIG.CANVAS.HALF_W): boolean {
    let bounced = false;
    if (ball.x - ball.r < -halfW) {
      ball.x = -halfW + ball.r;
      ball.vx = -ball.vx * CONFIG.PHYSICS.WALL_ELASTICITY;
      bounced = true;
    } else if (ball.x + ball.r > halfW) {
      ball.x = halfW - ball.r;
      ball.vx = -ball.vx * CONFIG.PHYSICS.WALL_ELASTICITY;
      bounced = true;
    }
    return bounced;
  }
}

export const physicsSystem = new PhysicsSystem();
