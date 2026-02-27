import { action, SingletonAction, type KeyDownEvent } from "@elgato/streamdeck";
import type { Power as TadoPower } from "node-tado-client";

import type { TadoManager } from "../tado-manager";
import type { PollingService } from "../polling-service";
import type { PresetSettings } from "../types";
import { buildTemperature } from "../utils/temperature";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.quick-preset" })
export class QuickPreset extends SingletonAction<PresetSettings> {
  constructor(
    private manager: TadoManager,
    private polling: PollingService,
  ) {
    super();
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    if (ev.payload.event === "getHomes") {
      try {
        const { homes } = await this.manager.api.getMe();
        ev.action.sendToPropertyInspector({
          event: "getHomes",
          items: homes.map((h: any) => ({ label: h.name, value: h.id })),
        });
      } catch { }
    }
  }

  override async onKeyDown(ev: KeyDownEvent<PresetSettings>): Promise<void> {
    const { homeId, presetTemperature, terminationType } = await ev.action.getSettings();
    if (!homeId) return;

    try {
      const hid = parseInt(homeId, 10);
      const zones = await this.manager.api.getZones(hid);
      const temp = presetTemperature || 22;
      const power: TadoPower = temp <= 5 ? "OFF" : "ON";

      const overlays = zones.map((zone) => ({
        power,
        zone_id: zone.id,
        temperature: buildTemperature(temp, "celsius"),
      }));

      let termination: string | number = "MANUAL";
      if (terminationType === "MANUAL" || terminationType === "NEXT_TIME_BLOCK") {
        termination = terminationType;
      } else if (terminationType) {
        termination = parseInt(terminationType, 10) || "MANUAL";
      }

      await this.manager.api.setZoneOverlays(hid, overlays, termination as any);
      ev.action.showOk();

      for (const zone of zones) {
        this.polling.refreshZone(hid, zone.id);
      }
    } catch {
      ev.action.showAlert();
    }
  }
}
