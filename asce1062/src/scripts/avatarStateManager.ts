/**
 * Avatar State Manager
 * Handles avatar state, URL management, and user interactions
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import {
  avatarConfig,
  getDefaultState,
  getRandomState,
} from "@/data/avatarConfig";

export class AvatarStateManager {
  private currentGender: Gender;
  private currentState: AvatarState;
  private currentLayer: string;
  private genderRadios: NodeListOf<Element>;
  private onStateChange?: () => void | Promise<void>;

  constructor(initialGender: Gender = "male") {
    this.currentGender = initialGender;
    this.currentState = getDefaultState(this.currentGender);
    this.currentLayer = avatarConfig[this.currentGender][0].name;
    this.genderRadios = document.querySelectorAll('input[name="gender"]');

    this.loadFromURL();
  }

  /**
   * Get current gender
   */
  getGender(): Gender {
    return this.currentGender;
  }

  /**
   * Get current avatar state
   */
  getState(): AvatarState {
    return this.currentState;
  }

  /**
   * Get current layer
   */
  getCurrentLayer(): string {
    return this.currentLayer;
  }

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: () => void | Promise<void>): void {
    this.onStateChange = callback;
  }

  /**
   * Notify listeners of state change
   */
  private async notifyStateChange(): Promise<void> {
    if (this.onStateChange) {
      await this.onStateChange();
    }
  }

  /**
   * Change gender and reset state
   */
  async changeGender(newGender: Gender): Promise<void> {
    if (this.currentGender === newGender) return;

    this.currentGender = newGender;
    this.currentState = getDefaultState(this.currentGender);
    this.currentLayer = avatarConfig[this.currentGender][0].name;

    this.updateURL();
    await this.notifyStateChange();
  }

  /**
   * Switch to a different layer
   */
  setCurrentLayer(layerName: string): void {
    this.currentLayer = layerName;
  }

  /**
   * Update a specific layer in the state
   */
  async updateLayerValue(layerName: string, value: number): Promise<void> {
    this.currentState[layerName] = value;
    this.updateURL();
    await this.notifyStateChange();
  }

  /**
   * Randomize the avatar state
   */
  async randomize(): Promise<void> {
    this.currentState = getRandomState(this.currentGender);
    this.updateURL();
    await this.notifyStateChange();
  }

  /**
   * Update URL with current state
   */
  updateURL(): void {
    const layers = avatarConfig[this.currentGender];
    const avatarParts: number[] = [];

    // Build avatar string in layer order: face-clothes-hair-eyes-mouth-background
    layers.forEach((layer) => {
      avatarParts.push(this.currentState[layer.name]);
    });

    const avatarString = avatarParts.join("-");
    const url = new URL(window.location.href);
    url.searchParams.set("gender", this.currentGender);
    url.searchParams.set("avatar", avatarString);

    // Update URL without reloading page
    window.history.replaceState({}, "", url.toString());
  }

  /**
   * Load state from URL parameters
   */
  private loadFromURL(): void {
    const url = new URL(window.location.href);
    const gender = url.searchParams.get("gender") as Gender;
    const avatarString = url.searchParams.get("avatar");

    // Load gender if valid
    if (gender && (gender === "male" || gender === "female")) {
      this.currentGender = gender;

      // Update gender radio button
      this.genderRadios.forEach((radio) => {
        const input = radio as HTMLInputElement;
        input.checked = input.value === gender;
      });
    }

    // Load avatar state if valid
    if (avatarString) {
      const parts = avatarString.split("-").map(Number);
      const layers = avatarConfig[this.currentGender];

      if (parts.length === layers.length) {
        // Validate and apply each part
        layers.forEach((layer, index) => {
          const value = parts[index];
          if (value >= 1 && value <= layer.count) {
            this.currentState[layer.name] = value;
          }
        });
      }
    }
  }

  /**
   * Get share URL for current avatar
   */
  getShareURL(): string {
    return window.location.href;
  }
}
