import {
  action,
  SingletonAction,
  type DialDownEvent,
  type DialRotateEvent,
  type TouchTapEvent,
  type WillAppearEvent,
  type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { ZoneState } from "node-tado-client";

import type { TadoManager } from "../tado-manager";
import type { PollingService } from "../polling-service";
import type { ZoneActionSettings, UnitTemperature } from "../types";
import { formatTemperature, getIndicatorPercent, clampTemperature, buildTemperature, readTemperature, celsiusToFahrenheit } from "../utils/temperature";

@action({ UUID: "dev.klauserdesignscoaching.tado-control.zone-control" })
export class ZoneControl extends SingletonAction<ZoneActionSettings> {
  private unsubscribe?: () => void;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private pendingTemp?: number;

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
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const { homeId, zoneId } = ev.payload.settings;
    if (homeId && zoneId) {
      this.polling.unregisterZone(parseInt(homeId, 10), parseInt(zoneId, 10));
    }
  }

  override async onDialRotate(ev: DialRotateEvent<ZoneActionSettings>): Promise<void> {
    const { homeId, zoneId, unit } = ev.payload.settings;
    if (!homeId || !zoneId) return;

    const hid = parseInt(homeId, 10);
    const zid = parseInt(zoneId, 10);
    const step = unit === "fahrenheit" ? 1 : 0.5;
    const currentTarget = this.pendingTemp ?? this.getCurrentTarget(hid, zid, unit);
    const newTemp = clampTemperature(currentTarget + ev.payload.ticks * step, unit);
    this.pendingTemp = newTemp;

    if (ev.action.isDial()) {
      ev.action.setFeedback({ target: formatTemperature(newTemp, unit) });
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(async () => {
      await this.setTemperature(hid, zid, unit, newTemp);
      this.pendingTemp = undefined;
    }, 300);
  }

  override async onDialDown(ev: DialDownEvent<ZoneActionSettings>): Promise<void> {
    const { homeId, zoneId } = ev.payload.settings;
    if (!homeId || !zoneId) return;

    const hid = parseInt(homeId, 10);
    const zid = parseInt(zoneId, 10);

    try {
      try {
        await this.manager.api.getZoneOverlay(hid, zid);
        await this.manager.api.clearZoneOverlays(hid, [zid]);
      } catch {
        const state = this.polling.getCached(hid, zid);
        const temp = state?.sensorDataPoints?.insideTemperature?.celsius ?? 20;
        await this.manager.api.setZoneOverlays(
          hid,
          [{ power: "ON" as any, zone_id: zid, temperature: { celsius: temp, fahrenheit: celsiusToFahrenheit(temp) } }],
          "MANUAL",
        );
      }
      await this.polling.refreshZone(hid, zid);
    } catch {
      ev.action.showAlert();
    }
  }

  override async onTouchTap(ev: TouchTapEvent<ZoneActionSettings>): Promise<void> {
    const { homeId, zoneId, unit } = ev.payload.settings;
    if (!homeId || !zoneId) return;

    const hid = parseInt(homeId, 10);
    const zid = parseInt(zoneId, 10);
    const delta = ev.payload.tapPos[0] < 100 ? -1 : 1;
    const step = unit === "fahrenheit" ? delta : delta * 0.5;
    const currentTarget = this.getCurrentTarget(hid, zid, unit);
    const newTemp = clampTemperature(currentTarget + step, unit);

    await this.setTemperature(hid, zid, unit, newTemp);
  }

  override async onSendToPlugin(ev: any): Promise<void> {
    const settings = await ev.action.getSettings();
    if (ev.payload.event === "getHomes") {
      const { homes } = await this.manager.api.getMe();
      ev.action.sendToPropertyInspector({
        event: "getHomes",
        items: homes.map((h: any) => ({ label: h.name, value: h.id })),
      });
    }
    if (ev.payload.event === "getZones" && settings.homeId) {
      const zones = await this.manager.api.getZones(parseInt(settings.homeId, 10));
      ev.action.sendToPropertyInspector({
        event: "getZones",
        items: zones.map((z: any) => ({ label: z.name, value: z.id })),
      });
    }
  }

  private getCurrentTarget(homeId: number, zoneId: number, unit: UnitTemperature): number {
    const defaultTemp = unit === "celsius" ? 20 : 68;
    const cached = this.polling.getCached(homeId, zoneId);
    if (!cached) return defaultTemp;

    const overlay = (cached as any).overlay;
    if (overlay?.setting?.temperature) {
      return readTemperature(overlay.setting.temperature, unit) || defaultTemp;
    }
    return readTemperature(cached.sensorDataPoints?.insideTemperature, unit) || defaultTemp;
  }

  private async setTemperature(homeId: number, zoneId: number, unit: UnitTemperature, temp: number): Promise<void> {
    const temperature = buildTemperature(temp, unit);
    await this.manager.api.setZoneOverlays(homeId, [{ power: "ON" as any, zone_id: zoneId, temperature }], "MANUAL");
    await this.polling.refreshZone(homeId, zoneId);
  }

  private updateDisplay(ev: any, state: ZoneState): void {
    const unit = ev.payload.settings.unit || "celsius";
    const currentValue = readTemperature(state.sensorDataPoints?.insideTemperature, unit);

    const overlay = (state as any).overlay;
    const targetTemp = overlay?.setting?.temperature
      ? readTemperature(overlay.setting.temperature, unit)
      : undefined;

    try {
      if (ev.action.isDial()) {
        ev.action.setFeedback({
          value: formatTemperature(currentValue, unit),
          target: targetTemp ? formatTemperature(targetTemp, unit) : "Auto",
          title: "",
          indicator: getIndicatorPercent(currentValue, unit),
        });
      }
    } catch {
    }
  }
}
