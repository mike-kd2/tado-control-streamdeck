import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { ZoneState } from "node-tado-client";

import type { TadoManager } from "../tado-manager";
import type { PollingService } from "../polling-service";
import type { ZoneActionSettings } from "../types";
import { createKeyImage } from "../utils/key-image";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.humidity" })
export class HumidityDisplay extends SingletonAction<ZoneActionSettings> {
  private unsubscribe?: () => void;

  constructor(
    private manager: TadoManager,
    private polling: PollingService,
  ) {
    super();
  }

  override async onWillAppear(ev: WillAppearEvent<ZoneActionSettings>): Promise<void> {
    const { homeId, zoneId } = ev.payload.settings;
    if (!homeId || !zoneId) return;

    const hid = parseInt(homeId, 10);
    const zid = parseInt(zoneId, 10);

    this.polling.registerZone(hid, zid);
    this.unsubscribe = this.polling.onUpdate((h, z, state) => {
      if (h === hid && z === zid) {
        this.updateDisplay(ev, state);
      }
    });

    const cached = this.polling.getCached(hid, zid);
    if (cached) this.updateDisplay(ev, cached);
  }

  override onWillDisappear(ev: WillDisappearEvent<ZoneActionSettings>): void {
    this.unsubscribe?.();
    const { homeId, zoneId } = ev.payload.settings;
    if (homeId && zoneId) {
      this.polling.unregisterZone(parseInt(homeId, 10), parseInt(zoneId, 10));
    }
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    const { homeId, zoneId } = ev.payload.settings;
    if (homeId && !zoneId) {
      await this.sendZones(homeId);
      return;
    }
    if (homeId && zoneId) {
      this.unsubscribe?.();
      const hid = parseInt(homeId, 10);
      const zid = parseInt(zoneId, 10);
      this.polling.registerZone(hid, zid);
      this.unsubscribe = this.polling.onUpdate((h, z, state) => {
        if (h === hid && z === zid) this.updateDisplay(ev, state);
      });
      const cached = this.polling.getCached(hid, zid);
      if (cached) this.updateDisplay(ev, cached);
    }
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    await this.manager.ensureAuthenticated();
    const settings = await ev.action.getSettings();
    if (ev.payload.event === "getHomes") {
      try {
        const { homes } = await this.manager.api.getMe();
        await streamDeck.ui.sendToPropertyInspector({
          event: "getHomes",
          items: homes.map((h: any) => ({ label: h.name, value: h.id })),
        });
      } catch (error) {
        streamDeck.logger.error(`[HumidityDisplay] sendHomes failed: ${error}`);
      }
    }
    if (ev.payload.event === "getZones" && settings.homeId) {
      await this.sendZones(settings.homeId);
    }
  }

  private async sendZones(homeId: string): Promise<void> {
    try {
      const zones = await this.manager.api.getZones(parseInt(homeId, 10));
      await streamDeck.ui.sendToPropertyInspector({
        event: "getZones",
        items: zones.map((z: any) => ({ label: z.name, value: z.id })),
      });
    } catch (error) {
      streamDeck.logger.error(`[HumidityDisplay] sendZones failed: ${error}`);
    }
  }

  private updateDisplay(ev: any, state: ZoneState): void {
    const humidity = state.sensorDataPoints?.humidity?.percentage ?? 0;
    const formatted = `${humidity.toFixed(0)}%`;

    try {
      if (ev.action.isKey()) {
        ev.action.setImage(createKeyImage([formatted]));
      }
      if (ev.action.isDial()) {
        ev.action.setFeedback({
          value: formatted,
          title: "Humidity",
          indicator: humidity,
        });
      }
    } catch {
    }
  }
}
