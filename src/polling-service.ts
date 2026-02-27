import streamDeck from "@elgato/streamdeck";
import type { ZoneState } from "node-tado-client";

import { TadoManager } from "./tado-manager";

type ZoneUpdateListener = (homeId: number, zoneId: number, state: ZoneState) => void;

interface CachedZoneState {
  state: ZoneState;
  lastUpdated: number;
}

export class PollingService {
  private static instance: PollingService;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private cache = new Map<string, CachedZoneState>();
  private listeners = new Set<ZoneUpdateListener>();
  private homeZones = new Map<number, Set<number>>();
  private pollIntervalMs = 60_000;

  static getInstance(): PollingService {
    if (!PollingService.instance) {
      PollingService.instance = new PollingService();
    }
    return PollingService.instance;
  }

  setPollInterval(ms: number): void {
    this.pollIntervalMs = Math.max(30_000, ms);
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }

  registerZone(homeId: number, zoneId: number): void {
    const wasEmpty = this.totalZoneCount === 0;

    if (!this.homeZones.has(homeId)) {
      this.homeZones.set(homeId, new Set());
    }
    this.homeZones.get(homeId)!.add(zoneId);

    if (wasEmpty) {
      this.start();
    }
  }

  unregisterZone(homeId: number, zoneId: number): void {
    const zones = this.homeZones.get(homeId);
    if (zones) {
      zones.delete(zoneId);
      if (zones.size === 0) {
        this.homeZones.delete(homeId);
      }
    }

    if (this.totalZoneCount === 0) {
      this.stop();
    }
  }

  onUpdate(cb: ZoneUpdateListener): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  getCached(homeId: number, zoneId: number): ZoneState | undefined {
    return this.cache.get(`${homeId}:${zoneId}`)?.state;
  }

  async refreshZone(homeId: number, zoneId: number): Promise<ZoneState | undefined> {
    const manager = TadoManager.getInstance();
    try {
      const state = await manager.api.getZoneState(homeId, zoneId);
      this.updateCache(homeId, zoneId, state);
      this.notifyListeners(homeId, zoneId, state);
      return state;
    } catch (error) {
      streamDeck.logger.error(`[PollingService] Refresh error for zone ${homeId}:${zoneId}: ${error}`);
      return undefined;
    }
  }

  private start(): void {
    if (this.intervalId) return;
    streamDeck.logger.info("[PollingService] Starting polling");
    this.pollAll();
    this.intervalId = setInterval(() => this.pollAll(), this.pollIntervalMs);
  }

  private stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      streamDeck.logger.info("[PollingService] Stopped polling - no visible actions");
    }
  }

  private get totalZoneCount(): number {
    return Array.from(this.homeZones.values()).reduce((sum, zones) => sum + zones.size, 0);
  }

  private async pollAll(): Promise<void> {
    const manager = TadoManager.getInstance();
    if (!manager.isReady) return;

    for (const [homeId, zoneIds] of this.homeZones) {
      try {
        const zoneStates = await manager.api.getZoneStates(homeId);
        for (const zoneId of zoneIds) {
          const state = (zoneStates as any).zoneStates?.[zoneId];
          if (state) {
            this.updateCache(homeId, zoneId, state);
            this.notifyListeners(homeId, zoneId, state);
          }
        }
      } catch (error) {
        streamDeck.logger.error(`[PollingService] Poll error for home ${homeId}: ${error}`);
        for (const zoneId of zoneIds) {
          try {
            const state = await manager.api.getZoneState(homeId, zoneId);
            this.updateCache(homeId, zoneId, state);
            this.notifyListeners(homeId, zoneId, state);
          } catch (innerError) {
            streamDeck.logger.error(`[PollingService] Fallback error for zone ${homeId}:${zoneId}: ${innerError}`);
          }
        }
      }
    }

    try {
      const rateLimit = manager.api.getRatelimit();
      if (rateLimit && (rateLimit as any).remaining < 100) {
        streamDeck.logger.warn(`[PollingService] Rate limit low: ${(rateLimit as any).remaining} remaining`);
        this.setPollInterval(Math.max(this.pollIntervalMs, 120_000));
      }
    } catch {
    }
  }

  private updateCache(homeId: number, zoneId: number, state: ZoneState): void {
    this.cache.set(`${homeId}:${zoneId}`, { state, lastUpdated: Date.now() });
  }

  private notifyListeners(homeId: number, zoneId: number, state: ZoneState): void {
    for (const listener of this.listeners) {
      try {
        listener(homeId, zoneId, state);
      } catch (error) {
        streamDeck.logger.error(`[PollingService] Listener error: ${error}`);
      }
    }
  }
}
