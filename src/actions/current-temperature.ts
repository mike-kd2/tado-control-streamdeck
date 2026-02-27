import { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { ZoneState } from "node-tado-client";

import type { TadoManager } from "../tado-manager";
import type { PollingService } from "../polling-service";
import type { ZoneActionSettings } from "../types";
import { formatTemperature, getIndicatorPercent, readTemperature } from "../utils/temperature";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.current-temperature" })
export class CurrentTemperature extends SingletonAction<ZoneActionSettings> {
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

  override async onSendToPlugin(ev: any): Promise<void> {
    const settings = await ev.action.getSettings();
    if (ev.payload.event === "getHomes") {
      await this.sendHomes(ev);
    }
    if (ev.payload.event === "getZones" && settings.homeId) {
      await this.sendZones(ev, settings.homeId);
    }
  }

  override async onDidReceiveSettings(ev: any): Promise<void> {
    const { homeId, zoneId } = ev.payload.settings;
    if (homeId && !zoneId) {
      await this.sendZones(ev, homeId);
    }
  }

  private updateDisplay(ev: any, state: ZoneState): void {
    const unit = ev.payload.settings.unit || "celsius";
    const tempValue = readTemperature(state.sensorDataPoints?.insideTemperature, unit);
    const humidity = state.sensorDataPoints?.humidity?.percentage;

    try {
      if (ev.action.isKey()) {
        const title = humidity != null
          ? `${formatTemperature(tempValue, unit)}\n${humidity.toFixed(0)}%`
          : formatTemperature(tempValue, unit);
        ev.action.setTitle(title);
      }
      if (ev.action.isDial()) {
        ev.action.setFeedback({
          value: formatTemperature(tempValue, unit),
          title: humidity != null ? `${humidity.toFixed(0)}%` : "",
          indicator: getIndicatorPercent(tempValue, unit),
        });
      }
    } catch {
    }
  }

  private async sendHomes(ev: any): Promise<void> {
    try {
      const { homes } = await this.manager.api.getMe();
      ev.action.sendToPropertyInspector({
        event: "getHomes",
        items: homes.map((h: any) => ({ label: h.name, value: h.id })),
      });
    } catch {
    }
  }

  private async sendZones(ev: any, homeId: string): Promise<void> {
    try {
      const zones = await this.manager.api.getZones(parseInt(homeId, 10));
      ev.action.sendToPropertyInspector({
        event: "getZones",
        items: zones.map((z: any) => ({ label: z.name, value: z.id })),
      });
    } catch {
    }
  }
}
