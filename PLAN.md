# Tado Control - Stream Deck Plugin Development Plan

> **WICHTIG - Fortschritts-Tracking:**
> - Diese Datei wird als `PLAN.md` im Projekt-Root angelegt.
> - **Jede abgeschlossene Aufgabe MUSS sofort mit `[x]` abgehakt werden.**
> - Checkboxen NICHT sammeln und spaeter abhaken - SOFORT nach Abschluss markieren.
> - Bei Session-Wechsel: Zuerst `PLAN.md` lesen und beim naechsten offenen `[ ]` weitermachen.
> - Phasen-Verifikation erst abhaken wenn ALLE Unterpunkte der Phase erledigt sind.
> - Format: `- [ ]` = offen, `- [x]` = erledigt
>
> **Git-Workflow:**
> - Zu Beginn: Git-Repo initialisieren und GitHub-Remote einrichten.
> - **Nach jeder abgeschlossenen Phase**: Commit mit aussagekraeftiger Message erstellen.
> - **Bei groesseren Zwischenschritten innerhalb einer Phase**: Ebenfalls committen.
> - **Nach jedem Commit**: Push zum Remote-Repo.
> - **Vor jedem Commit**: `/code-simplifier` ausfuehren um den Code zu vereinfachen/optimieren.
> - Commit-Message-Format: `phase X.Y: kurze Beschreibung` (z.B. `phase 2.2: add polling service`)
> - Erster Commit: `initial project setup` nach Phase 1.

## Context

Neuentwicklung eines Tado Stream Deck Plus Plugins basierend auf dem bestehenden
[aperezm85/streamdeck-tado-v2-plugin](https://github.com/aperezm85/streamdeck-tado-v2-plugin).
Eigenes Repo mit voller Kontrolle, modernisierter Architektur, aktuellen Dependencies,
und umfassendem Testing.

**Eckdaten:**
- Tado V2/V3 (Zonen-basiert, `Tado`-Klasse aus node-tado-client)
- 4-6 Zonen
- Plugin-Name: "Tado Control"
- UUID: `dev.klauserdesignscoaching.tado-control`
- Repo-Name: `tado-control-streamdeck` (oeffentlich)
- 9 Actions total (4 bestehende ueberarbeitet + 5 neue)

---

## Phase 1: Projekt-Setup

- [x] 1.1 Git-Repo initialisieren (`git init`)
- [x] 1.2 Source-Dateien selektiv aus Upstream kopieren (kein Fork, sauberer Start)
- [x] 1.3 Plugin-Identitaet setzen
  - [x] UUID: `dev.klauserdesignscoaching.tado-control`
  - [x] Name: "Tado Control"
  - [x] sdPlugin-Ordner: `dev.klauserdesignscoaching.tado-control.sdPlugin/`
- [x] 1.4 `package.json` erstellen mit aktuellen Dependencies (Feb 2026):
  - [x] `@elgato/streamdeck` ^2.0.1 (MAJOR upgrade von 1.3.1)
  - [x] `node-tado-client` ^1.1.1
  - [x] `@elgato/cli` ^1.7.1
  - [x] `typescript` ^5.9.3
  - [x] `rollup` ^4.59.0
  - [x] `@rollup/plugin-typescript` ^12.3.0
  - [x] `@rollup/plugin-commonjs` ^29.0.0
  - [x] `@rollup/plugin-node-resolve` ^16.0.3
  - [x] `@rollup/plugin-json` ^6.1.0
  - [x] `@rollup/plugin-terser` ^0.4.4
  - [x] `tslib` ^2.8.1
  - [x] Test-Dependencies (siehe Phase 7)
- [x] 1.5 `rollup.config.mjs` anpassen (neuer sdPlugin-Pfad)
- [x] 1.6 `tsconfig.json` konfigurieren (strict mode, Node 20)
- [x] 1.7 `.gitignore`, `.prettierrc.js`, `.editorconfig` einrichten
- [x] 1.8 `npm install` erfolgreich
- [x] 1.9 Projektstruktur anlegen:
  ```
  src/
    plugin.ts
    tado-manager.ts
    polling-service.ts
    types.ts
    utils/temperature.ts
    actions/
      current-temperature.ts
      power.ts
      boost.ts
      off.ts
      zone-control.ts
      quick-preset.ts
      presence-status.ts
      humidity-display.ts
      schedule-status.ts
  dev.klauserdesignscoaching.tado-control.sdPlugin/
    manifest.json
    bin/
    ui/
    layouts/
    imgs/
  ```

### Phase 1 Verifikation
- [x] `npm install` laeuft fehlerfrei
- [x] Projektstruktur vollstaendig angelegt

---

## Phase 2: SDK v2 Migration & Kern-Architektur

### 2.1 SDK v2 Breaking Changes umsetzen
- [x] Imports anpassen: JSON Types aus `@elgato/utils` statt `@elgato/streamdeck`
- [x] Logging: String-Literals (`"DEBUG"`, `"INFO"`) statt `LogLevel` Enum
- [x] Property Inspector: `.action` Property statt `.current?`
- [x] UI-Namespace Aenderungen umsetzen
- [x] Manifest `Software.MinimumVersion` auf aktuelle SD-Version erhoehen

### 2.2 `tado-manager.ts` - Auth-Singleton (NEU)
**Behebt: Browser oeffnet sich bei jeder Action-Registrierung**
- [x] Singleton-Pattern mit `getInstance()`
- [x] Idempotentes `ensureAuthenticated()` - laeuft nur einmal, weitere Calls warten auf dasselbe Promise
- [x] Token-Callback speichert Refresh-Token in Global Settings
- [x] Browser oeffnet sich NUR wenn kein gueltiger Refresh-Token vorhanden
- [x] `isReady` Property fuer Status-Abfrage
- [x] Typisierte Global Settings (kein `any`)
- [x] Error-Handling fuer `InvalidRefreshToken`, `AuthTimeout`, `NotAuthenticated`

### 2.3 `polling-service.ts` - Zentrales Polling (NEU)
**Behebt: Jede Action pollt einzeln = massive API-Verschwendung**
- [x] Nutzt `getZoneStates(homeId)` = 1 API-Call pro Home statt N pro Zone
- [x] Konfigurierbares Intervall (Default: 60s, Minimum: 30s)
- [x] Event-basiert: Actions subscriben via `onUpdate()` Callback
- [x] Cache-Layer: `getCached(homeId, zoneId)` fuer sofortige Anzeige
- [x] `refreshZone()` fuer Force-Refresh nach Schreiboperationen
- [x] **Visibility-aware**: Timer startet ERST wenn erste Action sichtbar
  - [x] `registerZone()`: Startet Polling wenn vorher leer
  - [x] `unregisterZone()`: Stoppt Polling wenn danach leer
  - [x] Null API-Calls wenn kein Action auf aktuellem SD-Profil/Seite sichtbar
- [x] Rate-Limit-Monitoring via `getRatelimit()`
- [x] Automatisches Polling-Drosseln bei niedrigem API-Kontingent

### 2.4 `plugin.ts` - Entry Point (REWRITE)
**Behebt: Actions werden in onWillAppear mehrfach registriert**
- [x] Actions EINMAL bei Modul-Load registrieren
- [x] Auth EINMAL bei Startup
- [x] Polling startet erst nach erfolgreicher Auth
- [x] `streamDeck.connect()` nur einmal aufrufen

### 2.5 `types.ts` - Typdefinitionen
- [x] `TadoGlobalSettings` (Token, Polling-Intervall, Default-Unit)
- [x] `ZoneActionSettings` (homeId, zoneId, unit)
- [x] `PowerSettings`, `BoostSettings`, `PresetSettings`, `PresenceSettings`, `ScheduleSettings`

### 2.6 `utils/temperature.ts` - Hilfsfunktionen
- [x] `celsiusToFahrenheit()` / `fahrenheitToCelsius()`
- [x] `formatTemperature()` (mit Einheit-Symbol)
- [x] `getIndicatorPercent()` (fuer Dial-Balken)
- [x] `clampTemperature()` (Min/Max pro Einheit)

### Phase 2 Verifikation
- [x] `npm run build` kompiliert fehlerfrei
- [x] Unit-Tests fuer TadoManager (Auth-Idempotenz)
- [x] Unit-Tests fuer PollingService (Register/Unregister, Visibility-Stop)
- [x] Unit-Tests fuer Temperature-Utils

---

## Phase 3: Bestehende Actions ueberarbeiten

### 3.1 Current Temperature (Keypad + Encoder)
- [x] Eigenen `setInterval` entfernen -> `pollingService.onUpdate()` subscriben
- [x] `onWillAppear`: Zone registrieren + Cache sofort anzeigen
- [x] `onWillDisappear`: Zone deregistrieren + Listener entfernen
- [x] Redundanten `getZones()`-Call entfernen
- [x] Humidity-Daten in Anzeige integrieren (aus ZoneState verfuegbar)
- [x] SDK v2 API-Aenderungen umsetzen

### 3.2 Power On/Off (Keypad + Encoder)
- [x] Auf PollingService umstellen (wie 3.1)
- [x] `getZoneOverlay()` Error abfangen wenn kein Overlay existiert
- [x] Nach Temperatur-Aenderung `pollingService.refreshZone()` aufrufen
- [x] `clearZoneOverlays()` statt manuelles Overlay-Loeschen fuer Schedule-Resume
- [x] SDK v2 API-Aenderungen umsetzen

### 3.3 Boost All Rooms (Keypad)
- [x] Auf TadoManager umstellen
- [x] Nach Ausfuehrung Force-Refresh aller betroffenen Zonen
- [x] Visuelles Feedback (showOk/showAlert)
- [x] SDK v2 API-Aenderungen umsetzen

### 3.4 Power Off All Rooms (Keypad)
- [x] Auf TadoManager umstellen
- [x] Nach Ausfuehrung Force-Refresh aller Zonen
- [x] Visuelles Feedback
- [x] SDK v2 API-Aenderungen umsetzen

### 3.5 Lokalisierung fixen
- [x] `locale.js` durch `shared.js` ersetzen
- [x] `shared.js`: Locales definieren UND Sprache automatisch setzen
- [x] Deutsche Uebersetzungen vervollstaendigen und korrigieren
- [x] Alle HTML Property Inspectors auf `shared.js` umstellen
- [ ] Testen: SD auf Deutsch -> PI zeigt deutsche Labels

### Phase 3 Verifikation
- [x] Alle 4 bestehenden Actions bauen fehlerfrei
- [ ] Unit-Tests fuer jede Action (Subscribe/Unsubscribe, Display-Updates)
- [ ] Integration-Test: Action erscheint auf SD, zeigt korrekte Daten
- [ ] Kein erneuter Browser-Popup bei Profilwechsel

---

## Phase 4: Neue Actions

### 4.1 Zone Control (Encoder/Dial) - HAUPT-ACTION
- [x] `zone-control.ts` implementieren
- [x] **Dial drehen**: Zieltemperatur in 0.5C-Schritten (Debounce 300ms vor API-Call)
- [x] **Dial druecken**: Zwischen manueller Steuerung und Zeitplan-Resume wechseln
- [x] **Touch-Tap**: Heizung an/aus fuer Zone
- [x] Custom Layout `zone-control-layout.json`:
  - [x] Raumname (oben, 14px bold)
  - [x] Aktuelle Temperatur (grau, kleiner)
  - [x] Zieltemperatur (orange, groesser)
  - [x] Heizbalken (gradient blau->gelb->rot)
- [x] Property Inspector: Home/Zone/Unit Auswahl
- [x] Manifest-Eintrag mit Encoder + TriggerDescriptions

### 4.2 Quick Preset (Keypad)
- [x] `quick-preset.ts` implementieren
- [x] Property Inspector:
  - [x] Preset-Name (frei editierbar)
  - [x] Home-Auswahl
  - [x] Dynamische Zonenliste mit Temperatur-Input pro Zone
  - [x] Termination-Typ: Manuell / Bis naechster Zeitblock / Zeitdauer
- [x] Nutzt `setZoneOverlays()` fuer atomare Multi-Zonen-Aenderung
- [x] Default-Presets als Vorschlaege: "Heat On" (22C), "Heat Off" (alle aus), "Eco" (17C), "Frost Protection" (5C)
- [x] Visuelles Feedback nach Ausfuehrung (showOk/showAlert)
- [x] Manifest-Eintrag (Keypad only)

### 4.3 Presence Status (Keypad + Encoder)
- [x] `presence-status.ts` implementieren
- [x] Zeigt HOME/AWAY Status via `getState(homeId)`
- [x] Tastendruck wechselt via `setPresence(homeId, newPresence)`
- [x] Zwei Key-States: HOME (gruen) / AWAY (grau)
- [x] Eigenes Polling (alle 5 Min, Presence aendert sich selten)
- [x] Property Inspector: Home-Auswahl
- [x] Manifest-Eintrag

### 4.4 Humidity Display (Keypad + Encoder)
- [x] `humidity-display.ts` implementieren
- [x] Nutzt `sensorDataPoints.humidity.percentage` aus ZoneState (kein extra API-Call)
- [x] Encoder Layout `humidity-layout.json`: Zone-Name + Humidity % + Balken
- [x] Property Inspector: Home/Zone Auswahl
- [x] Manifest-Eintrag

### 4.5 Schedule Status (Keypad + Encoder)
- [x] `schedule-status.ts` implementieren
- [x] Zeigt aktuellen Zeitplanblock via `getTimeTables()` / `getTimeTable()`
- [x] Berechnet aktiven Block basierend auf Wochentag + Uhrzeit
- [x] Anzeige: z.B. "22C bis 18:00"
- [x] Eigenes Polling-Intervall (alle 15 Min)
- [x] Property Inspector: Home/Zone Auswahl
- [x] Manifest-Eintrag

### Phase 4 Verifikation
- [x] Alle 5 neuen Actions bauen fehlerfrei
- [ ] Unit-Tests fuer jede neue Action
- [ ] Zone Control: Dial dreht Temperatur korrekt (0.5C Schritte)
- [ ] Zone Control: Druecken wechselt Modus (manuell <-> Zeitplan)
- [ ] Quick Preset: Setzt alle konfigurierten Zonen atomar
- [ ] Presence: Toggle HOME/AWAY funktioniert
- [ ] Humidity: Zeigt korrekte Werte ohne extra API-Calls
- [ ] Schedule: Zeigt richtigen Zeitblock fuer aktuellen Wochentag/Uhrzeit

---

## Phase 5: Stream Deck Plus Optimierung

- [x] 5.1 Verbesserte Custom Layouts fuer 200x100px Touch-Strip
  - [x] `zone-control-layout.json` finalisieren
  - [x] `humidity-layout.json` erstellen
  - [x] `power-control-layout.json` erstellen
  - [x] `presence-layout.json` erstellen
- [ ] 5.2 Dynamischer Layout-Wechsel je nach Zustand
  - [ ] Zeitplan-Modus: Schedule-Layout
  - [ ] Manueller Modus: Control-Layout mit Zieltemperatur
  - [ ] Boost-Modus: Boost-Layout mit Restzeit
- [x] 5.3 Touch-Tap fuer Zone Control
  - [x] Linke Haelfte = -1C
  - [x] Rechte Haelfte = +1C

### Phase 5 Verifikation
- [ ] Alle Layouts rendern korrekt auf SD Plus
- [ ] Layout-Wechsel bei Modus-Aenderung funktioniert
- [x] Touch-Tap Temperatur-Anpassung funktioniert

---

## Phase 6: Zuverlaessigkeit & Error Handling

### 6.1 Error Handling
- [x] Konsistentes Try/Catch in allen Actions
- [x] `showAlert()` auf Key/Dial bei Fehlern
- [x] Strukturiertes Logging mit Action-Kontext: `[ActionName:zoneId] message`
- [x] Graceful Degradation: Zeigt letzten Cache-Wert bei API-Fehler

### 6.2 Rate-Limit-Awareness
- [x] `getRatelimit()` nach jedem Poll-Zyklus pruefen
- [x] Automatisch Polling verlangsamen bei < 100 verbleibenden Calls
- [x] Warnung im Log bei niedrigem Kontingent

### 6.3 Reconnection
- [x] Bei 401-Fehler: `initialized = false`, `ensureAuthenticated()` erneut
- [x] Kein Browser-Popup wenn Refresh-Token noch gueltig
- [ ] Refresh-Token Ablauf-Warnung (30 Tage Limit)

### 6.4 Robustheit
- [ ] Alle API-Calls mit Timeout (15s)
- [x] Keine unbehandelten Promise-Rejections
- [x] Kein Memory-Leak bei Action-Registrierung/Deregistrierung
- [x] Sauberes Cleanup bei Plugin-Stop

### Phase 6 Verifikation
- [ ] Simulierter API-Fehler: Plugin zeigt Alert, pollt weiter
- [ ] Simulierter Auth-Ablauf: Re-Auth ohne Browser-Spam
- [ ] 24h Dauerbetrieb ohne Memory-Leak oder Haenger

---

## Phase 7: Testing

### 7.1 Test-Setup
- [x] Test-Framework installieren (vitest oder mocha)
- [x] Test-Konfiguration (`vitest.config.ts` oder `.mocharc.yml`)
- [x] Mock-Setup fuer `@elgato/streamdeck` (streamDeck.connect, actions, settings)
- [x] Mock-Setup fuer `node-tado-client` (Tado-Klasse, API-Responses)
- [x] Test-Fixtures: Beispiel-ZoneState, Beispiel-Token, Beispiel-Settings
- [x] Coverage-Reporting einrichten

### 7.2 Unit Tests - Kern-Module
- [x] **TadoManager Tests:**
  - [x] `ensureAuthenticated()` laeuft nur einmal (Idempotenz)
  - [x] Mehrere gleichzeitige Calls warten auf dasselbe Promise
  - [x] Refresh-Token wird korrekt aus Settings geladen
  - [x] Browser oeffnet sich nur bei fehlender/ungueltiger Auth
  - [x] Token-Callback speichert korrekt in Global Settings
  - [x] Error-Handling: InvalidRefreshToken, AuthTimeout
- [x] **PollingService Tests:**
  - [x] `registerZone()` startet Polling wenn vorher leer
  - [x] `unregisterZone()` stoppt Polling wenn danach leer
  - [x] Kein Polling wenn keine Zonen registriert (Visibility-aware)
  - [x] `getZoneStates()` wird einmal pro Home aufgerufen (nicht pro Zone)
  - [x] Cache wird korrekt aktualisiert
  - [x] `refreshZone()` aktualisiert einzelne Zone sofort
  - [x] Listener werden korrekt benachrichtigt
  - [x] Listener-Unsubscribe funktioniert (kein Memory-Leak)
  - [ ] Rate-Limit-Drosslung bei niedrigem Kontingent
  - [x] Error in einem Listener blockiert nicht andere Listener
- [x] **Temperature Utils Tests:**
  - [x] Celsius <-> Fahrenheit Konvertierung (inkl. Randfaelle)
  - [x] `formatTemperature()` korrekte Formatierung
  - [x] `clampTemperature()` Min/Max Grenzen
  - [x] `getIndicatorPercent()` korrekte Prozentberechnung

### 7.3 Unit Tests - Actions
- [ ] **Current Temperature:**
  - [ ] Registriert Zone bei onWillAppear
  - [ ] Deregistriert Zone bei onWillDisappear
  - [ ] Zeigt Cache-Daten sofort bei Erscheinen
  - [ ] Update-Callback aktualisiert Display korrekt (Celsius + Fahrenheit)
  - [ ] Kein Fehler wenn homeId/zoneId nicht konfiguriert
- [ ] **Power:**
  - [ ] Toggle On/Off setzt korrekte Zone-Overlay
  - [ ] Dial-Rotation aendert Temperatur in korrekten Schritten
  - [ ] `refreshZone()` wird nach Schreiboperation aufgerufen
  - [ ] Kein Fehler wenn kein Overlay existiert
- [ ] **Boost:**
  - [ ] Setzt alle Zonen auf Maximum
  - [ ] Ruft Force-Refresh auf
  - [ ] showOk() nach Erfolg, showAlert() nach Fehler
- [ ] **Off:**
  - [ ] Schaltet alle Zonen aus
  - [ ] Ruft Force-Refresh auf
- [ ] **Zone Control:**
  - [ ] Dial-Rotation: 0.5C Schritte, korrekte Grenzen (5-25C)
  - [ ] Debounce: API-Call erst nach 300ms Pause
  - [ ] Dial-Press: Toggle manuell <-> Zeitplan
  - [ ] Touch-Tap: Links = -1C, Rechts = +1C
  - [ ] Layout-Feedback korrekt (Name, Current, Target, Bar)
- [ ] **Quick Preset:**
  - [ ] Parst Zone-Config aus Settings korrekt
  - [ ] `setZoneOverlays()` wird mit korrekten Daten aufgerufen
  - [ ] Verschiedene Termination-Typen werden korrekt uebergeben
- [ ] **Presence Status:**
  - [ ] Zeigt HOME/AWAY korrekt an
  - [ ] Toggle ruft `setPresence()` mit korrektem Wert
  - [ ] Key-State wechselt korrekt (0=HOME, 1=AWAY)
- [ ] **Humidity Display:**
  - [ ] Zeigt Humidity aus ZoneState (kein eigener API-Call)
  - [ ] Korrekte Prozent-Anzeige
- [ ] **Schedule Status:**
  - [ ] Berechnet korrekten Zeitblock fuer verschiedene Wochentage/Uhrzeiten
  - [ ] Anzeige-Format korrekt ("22C bis 18:00")

### 7.4 Integration Tests
- [ ] **Auth-Flow Ende-zu-Ende:**
  - [ ] Erst-Auth mit Device-Flow (Mock Browser)
  - [ ] Re-Auth mit gespeichertem Refresh-Token (kein Browser)
  - [ ] Auth-Ablauf und Re-Auth
- [ ] **Polling-Lifecycle:**
  - [ ] Action erscheint -> Polling startet -> Daten kommen -> Display aktualisiert
  - [ ] Action verschwindet -> Polling stoppt -> Keine API-Calls
  - [ ] Profilwechsel: Alte Actions weg, neue Actions da -> Polling passt sich an
- [ ] **Multi-Action-Szenarien:**
  - [ ] 3 Zonen gleichzeitig sichtbar: Nur 1 API-Call pro Home
  - [ ] Quick Preset + Zone Control: Preset aendern -> Zone Control zeigt neuen Wert
  - [ ] Boost + Power: Boost aktivieren -> Power-Action zeigt neuen Status

### 7.5 Stabilitaetstests
- [ ] Kein Memory-Leak nach 100x Action appear/disappear Zyklen
- [ ] Kein unhandled Promise Rejection bei Netzwerk-Timeout
- [ ] Korrekte Bereinigung bei Plugin-Stop (alle Intervals/Listener geloescht)
- [ ] Kein doppeltes Polling nach schnellem Profilwechsel

### Phase 7 Verifikation
- [ ] `npm test` laeuft fehlerfrei
- [ ] Code Coverage > 80% fuer Kern-Module (TadoManager, PollingService, Utils)
- [ ] Code Coverage > 70% fuer Actions
- [ ] Keine fehlschlagenden Tests

---

## Phase 8: Lokalisierung & Polish

- [ ] 8.1 `shared.js` mit vollstaendigen Locales (EN + DE)
- [ ] 8.2 Manifest-Lokalisierung: `en.json` + `de.json` fuer Action-Namen
- [ ] 8.3 Deutsche Uebersetzungen pruefen und korrigieren
- [ ] 8.4 Icons fuer alle 9 Actions erstellen/anpassen
- [ ] 8.5 README.md fuer oeffentliches Repo
  - [ ] Features-Uebersicht
  - [ ] Installation
  - [ ] Konfiguration
  - [ ] Screenshots
  - [ ] Credits/Links zu Upstream-Repos
  - [ ] Lizenz (MIT)

### Phase 8 Verifikation
- [ ] PI zeigt deutsche Labels wenn SD auf Deutsch
- [ ] PI zeigt englische Labels wenn SD auf Englisch
- [ ] Alle Icons sichtbar und korrekt

---

## Phase 9: Finaler Build & Release

- [ ] 9.1 `npm run build` fehlerfrei
- [ ] 9.2 `npm test` alle Tests gruen
- [ ] 9.3 Plugin via `streamdeck link` installieren
- [ ] 9.4 Manueller End-to-End Test auf echtem Stream Deck Plus:
  - [ ] Auth-Flow (Erst-Authentifizierung)
  - [ ] Zone Control Dial: Temperatur drehen, druecken, tippen
  - [ ] Current Temperature: Zeigt korrekte Werte
  - [ ] Power On/Off: Toggle funktioniert
  - [ ] Quick Preset: Multi-Zonen-Aenderung
  - [ ] Boost / Off All: Ein-Knopf-Steuerung
  - [ ] Presence: HOME/AWAY Toggle
  - [ ] Humidity: Korrekte Anzeige
  - [ ] Schedule: Richtiger Zeitblock
  - [ ] Profilwechsel: Polling startet/stoppt korrekt
  - [ ] 1h Dauerbetrieb: Stabil, keine Haenger
- [ ] 9.5 Git-Repo finalisieren
  - [ ] Alle Aenderungen committed
  - [ ] GitHub Repo erstellen
  - [ ] Push
  - [ ] Release Tag v1.0.0

---

## Kritische Dateien

| Datei | Aktion | Zweck |
|-------|--------|-------|
| `src/tado-manager.ts` | NEU | Auth-Singleton, behebt Browser-Popup-Bug |
| `src/polling-service.ts` | NEU | Zentrales Polling, Visibility-aware, Cache |
| `src/plugin.ts` | REWRITE | Entry Point, einmalige Registrierung |
| `src/types.ts` | NEU | Typisierte Settings fuer alle Actions |
| `src/utils/temperature.ts` | NEU | Shared Temperature-Utilities |
| `manifest.json` | REWRITE | Neue Identitaet + 9 Actions |
| `src/actions/zone-control.ts` | NEU | Haupt-Dial-Action |
| `src/actions/quick-preset.ts` | NEU | Multi-Zonen-Presets |
| `src/actions/presence-status.ts` | NEU | HOME/AWAY Toggle |
| `src/actions/humidity-display.ts` | NEU | Luftfeuchtigkeit |
| `src/actions/schedule-status.ts` | NEU | Zeitplan-Info |
| `src/actions/current-temperature.ts` | EDIT | Auf PollingService umstellen |
| `src/actions/power.ts` | EDIT | Auf PollingService + Fixes |
| `src/actions/boost.ts` | EDIT | Auf TadoManager + Feedback |
| `src/actions/off.ts` | EDIT | Auf TadoManager + Feedback |
| `ui/shared.js` | NEU | Lokalisierung fix |
| `layouts/*.json` | NEU/EDIT | SD Plus Layouts |

## Dependencies (Februar 2026)

| Package | Version | Typ |
|---------|---------|-----|
| `@elgato/streamdeck` | ^2.0.1 | Runtime |
| `@elgato/cli` | ^1.7.1 | Dev |
| `node-tado-client` | ^1.1.1 | Dev (bundled) |
| `typescript` | ^5.9.3 | Dev |
| `rollup` | ^4.59.0 | Dev |
| `@rollup/plugin-typescript` | ^12.3.0 | Dev |
| `@rollup/plugin-commonjs` | ^29.0.0 | Dev |
| `@rollup/plugin-node-resolve` | ^16.0.3 | Dev |
| `@rollup/plugin-json` | ^6.1.0 | Dev |
| `@rollup/plugin-terser` | ^0.4.4 | Dev |
| `tslib` | ^2.8.1 | Dev |
| `vitest` | ^3.x | Dev (Testing) |
| `@vitest/coverage-v8` | ^3.x | Dev (Coverage) |
