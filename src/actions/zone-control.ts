import streamDeck, {
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

const LAYOUT_MANUAL = "layouts/zone-control-layout.json";
const LAYOUT_SCHEDULE = "layouts/zone-schedule-layout.json";
const LAYOUT_BOOST = "layouts/zone-boost-layout.json";

type ZoneMode = "schedule" | "manual" | "boost";

function detectMode(state: ZoneState): ZoneMode {
  const overlay = (state as any).overlay;
  if (!overlay) return "schedule";
  if (overlay.setting?.isBoost || overlay.termination?.typeSkillBasedApp === "TIMER") return "boost";
  return "manual";
}

function formatRemaining(seconds: number): string {
  const m = Math.ceil(seconds / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

@action({ UUID: "dev.klauserdesignscoaching.tado-control.zone-control" })
export class ZoneControl extends SingletonAction<ZoneActionSettings> {
  private unsubscribe?: () => void;
  private debounceTimer?: ReturnType<typeof setTimeout>;
  private pendingTemp?: number;
  private currentLayout?: string;

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
    try {
      await this.manager.ensureAuthenticated();
      const settings = await ev.action.getSettings();
      if (ev.payload.event === "getHomes") {
        const { homes } = await this.manager.api.getMe();
        await streamDeck.ui.sendToPropertyInspector({
          event: "getHomes",
          items: homes.map((h: any) => ({ label: h.name, value: h.id })),
        });
      }
      if (ev.payload.event === "getZones" && settings.homeId) {
        await this.sendZones(settings.homeId);
      }
    } catch (error) {
      streamDeck.logger.error(`[ZoneControl] onSendToPlugin failed: ${error}`);
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
      streamDeck.logger.error(`[ZoneControl] sendZones failed: ${error}`);
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
    const mode = detectMode(state);
    const overlay = (state as any).overlay;

    try {
      if (!ev.action.isDial()) return;

      const layoutForMode = mode === "boost" ? LAYOUT_BOOST : mode === "schedule" ? LAYOUT_SCHEDULE : LAYOUT_MANUAL;
      if (this.currentLayout !== layoutForMode) {
        ev.action.setFeedbackLayout(layoutForMode);
        this.currentLayout = layoutForMode;
      }

      if (mode === "boost") {
        const remaining = overlay?.termination?.remainingTimeInSeconds ?? 0;
        ev.action.setFeedback({
          value: formatTemperature(currentValue, unit),
          status: "BOOST",
          remaining: formatRemaining(remaining),
          title: "",
          indicator: getIndicatorPercent(currentValue, unit),
        });
      } else if (mode === "schedule") {
        ev.action.setFeedback({
          value: formatTemperature(currentValue, unit),
          status: "Auto",
          title: "",
          indicator: getIndicatorPercent(currentValue, unit),
        });
      } else {
        const targetTemp = overlay?.setting?.temperature
          ? readTemperature(overlay.setting.temperature, unit)
          : undefined;
        ev.action.setFeedback({
          value: formatTemperature(currentValue, unit),
          target: targetTemp ? formatTemperature(targetTemp, unit) : "—",
          title: "",
          indicator: getIndicatorPercent(currentValue, unit),
        });
      }
    } catch {
    }
  }
}
