import streamDeck, { action, SingletonAction, type KeyDownEvent } from "@elgato/streamdeck";
import type { Power as TadoPower } from "node-tado-client";

import type { TadoManager } from "../tado-manager";
import type { PollingService } from "../polling-service";
import type { HomeActionSettings } from "../types";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.off" })
export class PowerAllOff extends SingletonAction<HomeActionSettings> {
  constructor(
    private manager: TadoManager,
    private polling: PollingService,
  ) {
    super();
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    await this.manager.ensureAuthenticated();
    if (ev.payload.event === "getHomes") {
      await this.sendHomes(ev);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<HomeActionSettings>): Promise<void> {
    const { homeId } = await ev.action.getSettings();
    if (!homeId) return;

    try {
      const hid = parseInt(homeId, 10);
      const zones = await this.manager.api.getZones(hid);

      const overlays = zones.map((zone) => ({
        power: "OFF" as TadoPower,
        type: "HEATING" as const,
        zone_id: zone.id,
        temperature: { celsius: 5, fahrenheit: 41 },
      }));

      await this.manager.api.setZoneOverlays(hid, overlays, "MANUAL");
      ev.action.showOk();

      for (const zone of zones) {
        this.polling.refreshZone(hid, zone.id);
      }
    } catch {
      ev.action.showAlert();
    }
  }

  private async sendHomes(ev: any): Promise<void> {
    try {
      const { homes } = await this.manager.api.getMe();
      await streamDeck.ui.sendToPropertyInspector({
        event: "getHomes",
        items: homes.map((h: any) => ({ label: h.name, value: h.id })),
      });
    } catch (error) {
      streamDeck.logger.error(`[PowerAllOff] sendHomes failed: ${error}`);
    }
  }
}
