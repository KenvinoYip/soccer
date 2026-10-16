/**
 * Shaolin Soccer - InputSystem
 * Handles pointer & touch input normalization to Cocos Creator 3.8 canvas coordinate system:
 * Center (0, 0), X-Right, Y-Up (W: 440, H: 780).
 */

import { CONFIG } from '../Config';

export type InputCallback = (x: number, y: number) => void;

export class InputSystem {
  private onDown: InputCallback | null = null;
  private onMove: InputCallback | null = null;
  private onUp: InputCallback | null = null;

  private attachedCanvas: HTMLCanvasElement | null = null;
  private isPointerDown: boolean = false;
  private activePointerId: number | null = null;
  private activeTouchId: number | null = null;
  private hasPointerSupport: boolean = false;

  // Bound event listener references for clean detachment
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;
  private boundPointerMove: ((e: PointerEvent) => void) | null = null;
  private boundPointerUp: ((e: PointerEvent) => void) | null = null;
  private boundPointerCancel: ((e: PointerEvent) => void) | null = null;

  private boundTouchStart: ((e: TouchEvent) => void) | null = null;
  private boundTouchMove: ((e: TouchEvent) => void) | null = null;
  private boundTouchEnd: ((e: TouchEvent) => void) | null = null;
  private boundTouchCancel: ((e: TouchEvent) => void) | null = null;

  /**
   * Set event callbacks for input lifecycle
   */
  public setCallbacks(
    onDown?: InputCallback | null,
    onMove?: InputCallback | null,
    onUp?: InputCallback | null
  ): void {
    if (onDown !== undefined) this.onDown = onDown;
    if (onMove !== undefined) this.onMove = onMove;
    if (onUp !== undefined) this.onUp = onUp;
  }

  /**
   * Converts clientX / clientY screen coordinates to Cocos Creator world coordinates.
   * Coordinate origin: Center (0, 0)
   * Horizontal range: [-220, +220] (Left to Right)
   * Vertical range: [-390, +390] (Bottom to Top, Y-up)
   */
  public normalizeCoords(clientX: number, clientY: number, targetCanvas?: HTMLCanvasElement | null): { x: number; y: number } {
    const canvas = targetCanvas || this.attachedCanvas;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return { x: 0, y: 0 };
    }

    // Cocos Creator SHOW_ALL uniform scaling matching game viewport:
    const scale = Math.min(rect.width / CONFIG.CANVAS.W, rect.height / CONFIG.CANVAS.H);
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;

    // Convert to Cocos 3.8 Coordinate System (Center 0,0, Y-up)
    const x = (clientX - originX) / scale;
    const y = (originY - clientY) / scale;

    return { x, y };
  }

  /**
   * Attaches pointer and touch event listeners to target canvas
   */
  public attach(canvas: HTMLCanvasElement): void {
    if (!canvas) return;

    if (this.attachedCanvas) {
      this.detach(this.attachedCanvas);
    }

    this.attachedCanvas = canvas;
    this.hasPointerSupport = false;

    // Pointer events
    this.boundPointerDown = (e: PointerEvent): void => {
      this.hasPointerSupport = true;
      if (this.isPointerDown && this.activePointerId !== e.pointerId) {
        return;
      }
      this.isPointerDown = true;
      this.activePointerId = e.pointerId;

      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignored if pointer capture is not supported
      }

      const { x, y } = this.normalizeCoords(e.clientX, e.clientY, canvas);
      this.onDown?.(x, y);
    };

    this.boundPointerMove = (e: PointerEvent): void => {
      if (!this.isPointerDown || this.activePointerId !== e.pointerId) {
        return;
      }
      const { x, y } = this.normalizeCoords(e.clientX, e.clientY, canvas);
      this.onMove?.(x, y);
    };

    this.boundPointerUp = (e: PointerEvent): void => {
      if (!this.isPointerDown || this.activePointerId !== e.pointerId) {
        return;
      }
      this.isPointerDown = false;
      this.activePointerId = null;

      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignored
      }

      const { x, y } = this.normalizeCoords(e.clientX, e.clientY, canvas);
      this.onUp?.(x, y);
    };

    this.boundPointerCancel = (e: PointerEvent): void => {
      if (this.activePointerId === e.pointerId) {
        this.isPointerDown = false;
        this.activePointerId = null;
        const { x, y } = this.normalizeCoords(e.clientX, e.clientY, canvas);
        this.onUp?.(x, y);
      }
    };

    // Touch events fallback and touch gesture support
    this.boundTouchStart = (e: TouchEvent): void => {
      // Avoid duplicate triggers when pointer events are already active
      if (this.hasPointerSupport) return;
      if (e.changedTouches.length === 0) return;

      if (e.cancelable) {
        e.preventDefault();
      }

      const touch = e.changedTouches[0];
      this.isPointerDown = true;
      this.activeTouchId = touch.identifier;

      const { x, y } = this.normalizeCoords(touch.clientX, touch.clientY, canvas);
      this.onDown?.(x, y);
    };

    this.boundTouchMove = (e: TouchEvent): void => {
      if (this.hasPointerSupport || !this.isPointerDown) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.activeTouchId) {
          if (e.cancelable) {
            e.preventDefault();
          }
          const { x, y } = this.normalizeCoords(touch.clientX, touch.clientY, canvas);
          this.onMove?.(x, y);
          break;
        }
      }
    };

    this.boundTouchEnd = (e: TouchEvent): void => {
      if (this.hasPointerSupport || !this.isPointerDown) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.activeTouchId) {
          this.isPointerDown = false;
          this.activeTouchId = null;

          if (e.cancelable) {
            e.preventDefault();
          }

          const { x, y } = this.normalizeCoords(touch.clientX, touch.clientY, canvas);
          this.onUp?.(x, y);
          break;
        }
      }
    };

    this.boundTouchCancel = (e: TouchEvent): void => {
      if (this.hasPointerSupport || !this.isPointerDown) return;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.activeTouchId) {
          this.isPointerDown = false;
          this.activeTouchId = null;

          const { x, y } = this.normalizeCoords(touch.clientX, touch.clientY, canvas);
          this.onUp?.(x, y);
          break;
        }
      }
    };

    // Attach listeners
    canvas.addEventListener('pointerdown', this.boundPointerDown, { passive: false });
    window.addEventListener('pointermove', this.boundPointerMove, { passive: false });
    window.addEventListener('pointerup', this.boundPointerUp, { passive: false });
    window.addEventListener('pointercancel', this.boundPointerCancel, { passive: false });

    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    window.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    window.addEventListener('touchend', this.boundTouchEnd, { passive: false });
    window.addEventListener('touchcancel', this.boundTouchCancel, { passive: false });
  }

  /**
   * Detaches all pointer and touch event listeners
   */
  public detach(canvas?: HTMLCanvasElement): void {
    const target = canvas || this.attachedCanvas;
    if (!target) return;

    if (this.boundPointerDown) {
      target.removeEventListener('pointerdown', this.boundPointerDown);
    }
    if (this.boundPointerMove) {
      window.removeEventListener('pointermove', this.boundPointerMove);
    }
    if (this.boundPointerUp) {
      window.removeEventListener('pointerup', this.boundPointerUp);
    }
    if (this.boundPointerCancel) {
      window.removeEventListener('pointercancel', this.boundPointerCancel);
    }

    if (this.boundTouchStart) {
      target.removeEventListener('touchstart', this.boundTouchStart);
    }
    if (this.boundTouchMove) {
      window.removeEventListener('touchmove', this.boundTouchMove);
    }
    if (this.boundTouchEnd) {
      window.removeEventListener('touchend', this.boundTouchEnd);
    }
    if (this.boundTouchCancel) {
      window.removeEventListener('touchcancel', this.boundTouchCancel);
    }

    this.boundPointerDown = null;
    this.boundPointerMove = null;
    this.boundPointerUp = null;
    this.boundPointerCancel = null;

    this.boundTouchStart = null;
    this.boundTouchMove = null;
    this.boundTouchEnd = null;
    this.boundTouchCancel = null;

    this.isPointerDown = false;
    this.activePointerId = null;
    this.activeTouchId = null;
    this.attachedCanvas = null;
  }
}

export const inputSystem = new InputSystem();
