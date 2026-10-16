/**
 * Configuration and Shared Data Interfaces for Shaolin Soccer
 * Cocos Creator 3.8 Coordinate System: Center (0, 0), Y-Up
 * Canvas Dimensions: 440 x 780
 */

export interface BrickData {
    id?: number;
    x: number;
    y: number;
    w: number;
    h: number;
    row: number;
    col: number;
    type: 'normal' | 'metal' | 'tnt';
    hp: number;
    maxHp: number;
    color?: string;
    crackLevel: number; // 0: no cracks, 1: light, 2: medium, 3: heavy
    hitFlash: number;   // frames remaining for white flash
    shakeX: number;     // horizontal offset for hit shake animation
    active?: boolean;
    vy?: number;
    targetY?: number;
}

export interface BallData {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    rot: number;
    dmg: number;
    pierceLeft: number;
    isSuper: boolean;
    mode: number;
    trail: { x: number; y: number; alpha: number }[];
    volleyCount?: number;
    speedMult?: number;
    isSkillProjectile?: boolean;
    curl?: number;          // Lateral Magnus acceleration for banana curve shots
    squashX?: number;       // Horizontal squash factor (0.5 = squashed, 1.4 = stretched)
    squashY?: number;       // Vertical squash factor
    squashTimer?: number;   // Frames remaining for squash/stretch recovery
}

export interface ParticleData {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    r: number;
    color: string;
    type: 'spark' | 'smoke' | 'debris' | 'fire' | 'gold' | string;
    rot: number;
    vRot: number;
    w: number;
    h: number;
}

export interface FloatTextData {
    x: number;
    y: number;
    text: string;
    color: string;
    size: number;
    alpha: number;
    vy: number;
    life: number;
    maxLife?: number;
}

export interface ShockwaveData {
    x: number;
    y: number;
    r: number;
    maxR: number;
    alpha: number;
    color: string;
    lineWidth: number;
}

export interface KeeperData {
    x: number;
    y: number;
    r: number;
    vx: number;
    minX: number;
    maxX: number;
    isGuarding: boolean;
    shieldFlash: number;
}

export interface ModeConfig {
    id: number;
    name: string;
    title: string;
    dmgMultiplier: number;
    speedMultiplier: number;
    count: number;
    spreadRad?: number;
    pierces?: number;
    color: string;
    secondaryColor: string;
}

export const GAME_CONFIG = {
    GROUND_Y: -240,
    WALL_TOP: 290,
    WALL_BOTTOM: 130,
    WALL_WIDTH: 380,
    BRICK_COLS: 7,
    COLORS: {
        NORMAL: ['#c0392b', '#922b21'],
        METAL: '#7f8c8d',
        TNT: '#e67e22',
        SKIN: '#E8A87C',
        MONK_ORANGE: '#E67E22',
        SASH_DARK: '#8E44AD',
        GOLD_AURA: '#F39C12',
        KEEPER_RED: '#e74c3c'
    }
};

export const CONFIG = {
    W: 440,
    H: 780,
    GROUND_Y: -240,
    PLAYER_X: 0,
    WALL_TOP: 290,
    WALL_BOTTOM: 130,
    BALL_MAX_SPEED: 28,
    GRAVITY: 0.18,

    CANVAS: {
        W: 440,
        H: 780,
        HALF_W: 220,
        HALF_H: 390,
    },

    LAYOUT: {
        GROUND_Y: -240,
        WALL_BOTTOM: 130,
        WALL_TOP: 290,
        PLAYER_X: 0,
        PLAYER_Y: -240,
        KEEPER_Y: 85,
        KEEPER_PATROL_MIN_X: -135,
        KEEPER_PATROL_MAX_X: 135,
        KEEPER_RADIUS: 24,
        KEEPER_BASE_SPEED: 2.4,
        BALL_RADIUS: 9,
        BALL_START_Y: -215,
        AIM_MAX_DRAG: 160,
    },

    PHYSICS: {
        GRAVITY: 0.18,
        BALL_MAX_SPEED: 28,
        BALL_MIN_SPEED: 7,
        WALL_ELASTICITY: 0.94,
        BRICK_BOUNCE: 0.92,
        TRAIL_MAX_POINTS: 12,
        TRAIL_FADE_SPEED: 0.08,
    },

    POWER_ZONES: {
        GREEN: [0, 0.65] as [number, number],
        YELLOW: [0.65, 0.85] as [number, number],
        RED: [0.85, 1.0] as [number, number],
    },

    MODES: {
        0: {
            id: 0,
            name: 'fire',
            title: 'FIRE SPIN',
            dmgMultiplier: 1.0,
            speedMultiplier: 1.0,
            count: 1,
            spreadRad: 0,
            pierces: 0,
            color: '#ff4d4d',
            secondaryColor: '#f39c12',
        } as ModeConfig,
        1: {
            id: 1,
            name: 'clone',
            title: 'SHADOW CLONE',
            dmgMultiplier: 0.75,
            speedMultiplier: 0.9,
            count: 3,
            spreadRad: 0.18,
            pierces: 0,
            color: '#3498db',
            secondaryColor: '#00d2d3',
        } as ModeConfig,
        2: {
            id: 2,
            name: 'pierce',
            title: 'DRAGON PIERCE',
            dmgMultiplier: 0.9,
            speedMultiplier: 1.1,
            count: 1,
            spreadRad: 0,
            pierces: 5,
            color: '#f1c40f',
            secondaryColor: '#ff9ff3',
        } as ModeConfig,
    } as Record<number, ModeConfig>,

    PALETTE: {
        skyTop: '#0a0e1a',
        skyBottom: '#1a0a2e',
        ground: '#2ecc71',
        groundLine: '#ffffff',
        groundShadow: '#1e824c',
        wallFrame: '#334155',
        wallFrameInner: '#1e293b',
        brickNormal: '#e67e22',
        brickMetal: '#94a3b8',
        brickTnt: '#ef4444',
        ballBody: '#f8fafc',
        ballPatches: '#0f172a',
        powerGreen: '#2ecc71',
        powerYellow: '#ffa502',
        powerRed: '#ff3838',
        shockwave: '#ffffff',
        textGold: '#ffd700',
        textRed: '#ff3838',
        textWhite: '#ffffff',
    },
};
