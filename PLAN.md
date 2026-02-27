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
- [ ] Imports anpassen: JSON Types aus `@elgato/utils` statt `@elgato/streamdeck`
- [ ] Logging: String-Literals (`"DEBUG"`, `"INFO"`) statt `LogLevel` Enum
- [ ] Property Inspector: `.action` Property statt `.current?`
- [ ] UI-Namespace Aenderungen umsetzen
- [ ] Manifest `Software.MinimumVersion` auf aktuelle SD-Version erhoehen

### 2.2 `tado-manager.ts` - Auth-Singleton (NEU)
**Behebt: Browser oeffnet sich bei jeder Action-Registrierung**
- [ ] Singleton-Pattern mit `getInstance()`
- [ ] Idempotentes `ensureAuthenticated()` - laeuft nur einmal, weitere Calls warten auf dasselbe Promise
- [ ] Token-Callback speichert Refresh-Token in Global Settings
- [ ] Browser oeffnet sich NUR wenn kein gueltiger Refresh-Token vorhanden
- [ ] `isReady` Property fuer Status-Abfrage
- [ ] Typisierte Global Settings (kein `any`)
- [ ] Error-Handling fuer `InvalidRefreshToken`, `AuthTimeout`, `NotAuthenticated`

### 2.3 `polling-service.ts` - Zentrales Polling (NEU)
**Behebt: Jede Action pollt einzeln = massive API-Verschwendung**
- [ ] Nutzt `getZoneStates(homeId)` = 1 API-Call pro Home statt N pro Zone
- [ ] Konfigurierbares Intervall (Default: 60s, Minimum: 30s)
- [ ] Event-basiert: Actions subscriben via `onUpdate()` Callback
- [ ] Cache-Layer: `getCached(homeId, zoneId)` fuer sofortige Anzeige
- [ ] `refreshZone()` fuer Force-Refresh nach Schreiboperationen
- [ ] **Visibility-aware**: Timer startet ERST wenn erste Action sichtbar
  - [ ] `registerZone()`: Startet Polling wenn vorher leer
  - [ ] `unregisterZone()`: Stoppt Polling wenn danach leer
  - [ ] Null API-Calls wenn kein Action auf aktuellem SD-Profil/Seite sichtbar
- [ ] Rate-Limit-Monitoring via `getRatelimit()`
- [ ] Automatisches Polling-Drosseln bei niedrigem API-Kontingent

### 2.4 `plugin.ts` - Entry Point (REWRITE)
**Behebt: Actions werden in onWillAppear mehrfach registriert**
- [ ] Actions EINMAL bei Modul-Load registrieren
- [ ] Auth EINMAL bei Startup
- [ ] Polling startet erst nach erfolgreicher Auth
- [ ] `streamDeck.connect()` nur einmal aufrufen

### 2.5 `types.ts` - Typdefinitionen
- [ ] `TadoGlobalSettings` (Token, Polling-Intervall, Default-Unit)
- [ ] `ZoneActionSettings` (homeId, zoneId, unit)
- [ ] `PowerSettings`, `BoostSettings`, `PresetSettings`, `PresenceSettings`, `ScheduleSettings`

### 2.6 `utils/temperature.ts` - Hilfsfunktionen
- [ ] `celsiusToFahrenheit()` / `fahrenheitToCelsius()`
- [ ] `formatTemperature()` (mit Einheit-Symbol)
- [ ] `getIndicatorPercent()` (fuer Dial-Balken)
- [ ] `clampTemperature()` (Min/Max pro Einheit)

### Phase 2 Verifikation
- [ ] `npm run build` kompiliert fehlerfrei
- [ ] Unit-Tests fuer TadoManager (Auth-Idempotenz)
- [ ] Unit-Tests fuer PollingService (Register/Unregister, Visibility-Stop)
- [ ] Unit-Tests fuer Temperature-Utils

---

## Phase 3: Bestehende Actions ueberarbeiten

### 3.1 Current Temperature (Keypad + Encoder)
- [ ] Eigenen `setInterval` entfernen -> `pollingService.onUpdate()` subscriben
- [ ] `onWillAppear`: Zone registrieren + Cache sofort anzeigen
- [ ] `onWillDisappear`: Zone deregistrieren + Listener entfernen
- [ ] Redundanten `getZones()`-Call entfernen
- [ ] Humidity-Daten in Anzeige integrieren (aus ZoneState verfuegbar)
- [ ] SDK v2 API-Aenderungen umsetzen

### 3.2 Power On/Off (Keypad + Encoder)
- [ ] Auf PollingService umstellen (wie 3.1)
- [ ] `getZoneOverlay()` Error abfangen wenn kein Overlay existiert
- [ ] Nach Temperatur-Aenderung `pollingService.refreshZone()` aufrufen
- [ ] `clearZoneOverlays()` statt manuelles Overlay-Loeschen fuer Schedule-Resume
- [ ] SDK v2 API-Aenderungen umsetzen

### 3.3 Boost All Rooms (Keypad)
- [ ] Auf TadoManager umstellen
- [ ] Nach Ausfuehrung Force-Refresh aller betroffenen Zonen
- [ ] Visuelles Feedback (showOk/showAlert)
- [ ] SDK v2 API-Aenderungen umsetzen

### 3.4 Power Off All Rooms (Keypad)
- [ ] Auf TadoManager umstellen
- [ ] Nach Ausfuehrung Force-Refresh aller Zonen
- [ ] Visuelles Feedback
- [ ] SDK v2 API-Aenderungen umsetzen

### 3.5 Lokalisierung fixen
- [ ] `locale.js` durch `shared.js` ersetzen
- [ ] `shared.js`: Locales definieren UND Sprache automatisch setzen
- [ ] Deutsche Uebersetzungen vervollstaendigen und korrigieren
- [ ] Alle HTML Property Inspectors auf `shared.js` umstellen
- [ ] Testen: SD auf Deutsch -> PI zeigt deutsche Labels

### Phase 3 Verifikation
- [ ] Alle 4 bestehenden Actions bauen fehlerfrei
- [ ] Unit-Tests fuer jede Action (Subscribe/Unsubscribe, Display-Updates)
- [ ] Integration-Test: Action erscheint auf SD, zeigt korrekte Daten
- [ ] Kein erneuter Browser-Popup bei Profilwechsel

---

## Phase 4: Neue Actions

### 4.1 Zone Control (Encoder/Dial) - HAUPT-ACTION
- [ ] `zone-control.ts` implementieren
- [ ] **Dial drehen**: Zieltemperatur in 0.5C-Schritten (Debounce 300ms vor API-Call)
- [ ] **Dial druecken**: Zwischen manueller Steuerung und Zeitplan-Resume wechseln
- [ ] **Touch-Tap**: Heizung an/aus fuer Zone
- [ ] Custom Layout `zone-control-layout.json`:
  - [ ] Raumname (oben, 14px bold)
  - [ ] Aktuelle Temperatur (grau, kleiner)
  - [ ] Zieltemperatur (orange, groesser)
  - [ ] Heizbalken (gradient blau->gelb->rot)
- [ ] Property Inspector: Home/Zone/Unit Auswahl
- [ ] Manifest-Eintrag mit Encoder + TriggerDescriptions

### 4.2 Quick Preset (Keypad)
- [ ] `quick-preset.ts` implementieren
- [ ] Property Inspector:
  - [ ] Preset-Name (frei editierbar)
  - [ ] Home-Auswahl
  - [ ] Dynamische Zonenliste mit Temperatur-Input pro Zone
  - [ ] Termination-Typ: Manuell / Bis naechster Zeitblock / Zeitdauer
- [ ] Nutzt `setZoneOverlays()` fuer atomare Multi-Zonen-Aenderung
- [ ] Default-Presets als Vorschlaege: "Heat On" (22C), "Heat Off" (alle aus), "Eco" (17C), "Frost Protection" (5C)
- [ ] Visuelles Feedback nach Ausfuehrung (showOk/showAlert)
- [ ] Manifest-Eintrag (Keypad only)

### 4.3 Presence Status (Keypad + Encoder)
- [ ] `presence-status.ts` implementieren
- [ ] Zeigt HOME/AWAY Status via `getState(homeId)`
- [ ] Tastendruck wechselt via `setPresence(homeId, newPresence)`
- [ ] Zwei Key-States: HOME (gruen) / AWAY (grau)
- [ ] Eigenes Polling (alle 5 Min, Presence aendert sich selten)
- [ ] Property Inspector: Home-Auswahl
- [ ] Manifest-Eintrag

### 4.4 Humidity Display (Keypad + Encoder)
- [ ] `humidity-display.ts` implementieren
- [ ] Nutzt `sensorDataPoints.humidity.percentage` aus ZoneState (kein extra API-Call)
- [ ] Encoder Layout `humidity-layout.json`: Zone-Name + Humidity % + Balken
- [ ] Property Inspector: Home/Zone Auswahl
- [ ] Manifest-Eintrag

### 4.5 Schedule Status (Keypad + Encoder)
- [ ] `schedule-status.ts` implementieren
- [ ] Zeigt aktuellen Zeitplanblock via `getTimeTables()` / `getTimeTable()`
- [ ] Berechnet aktiven Block basierend auf Wochentag + Uhrzeit
- [ ] Anzeige: z.B. "22C bis 18:00"
- [ ] Eigenes Polling-Intervall (alle 15 Min)
- [ ] Property Inspector: Home/Zone Auswahl
- [ ] Manifest-Eintrag

### Phase 4 Verifikation
- [ ] Alle 5 neuen Actions bauen fehlerfrei
- [ ] Unit-Tests fuer jede neue Action
- [ ] Zone Control: Dial dreht Temperatur korrekt (0.5C Schritte)
- [ ] Zone Control: Druecken wechselt Modus (manuell <-> Zeitplan)
- [ ] Quick Preset: Setzt alle konfigurierten Zonen atomar
- [ ] Presence: Toggle HOME/AWAY funktioniert
- [ ] Humidity: Zeigt korrekte Werte ohne extra API-Calls
- [ ] Schedule: Zeigt richtigen Zeitblock fuer aktuellen Wochentag/Uhrzeit

---

## Phase 5: Stream Deck Plus Optimierung

- [ ] 5.1 Verbesserte Custom Layouts fuer 200x100px Touch-Strip
  - [ ] `zone-control-layout.json` finalisieren
  - [ ] `humidity-layout.json` erstellen
  - [ ] `power-control-layout.json` erstellen
  - [ ] `presence-layout.json` erstellen
- [ ] 5.2 Dynamischer Layout-Wechsel je nach Zustand
  - [ ] Zeitplan-Modus: Schedule-Layout
  - [ ] Manueller Modus: Control-Layout mit Zieltemperatur
  - [ ] Boost-Modus: Boost-Layout mit Restzeit
- [ ] 5.3 Touch-Tap fuer Zone Control
  - [ ] Linke Haelfte = -1C
  - [ ] Rechte Haelfte = +1C

### Phase 5 Verifikation
- [ ] Alle Layouts rendern korrekt auf SD Plus
- [ ] Layout-Wechsel bei Modus-Aenderung funktioniert
- [ ] Touch-Tap Temperatur-Anpassung funktioniert

---

## Phase 6: Zuverlaessigkeit & Error Handling

### 6.1 Error Handling
- [ ] Konsistentes Try/Catch in allen Actions
- [ ] `showAlert()` auf Key/Dial bei Fehlern
- [ ] Strukturiertes Logging mit Action-Kontext: `[ActionName:zoneId] message`
- [ ] Graceful Degradation: Zeigt letzten Cache-Wert bei API-Fehler

### 6.2 Rate-Limit-Awareness
- [ ] `getRatelimit()` nach jedem Poll-Zyklus pruefen
- [ ] Automatisch Polling verlangsamen bei < 100 verbleibenden Calls
- [ ] Warnung im Log bei niedrigem Kontingent

### 6.3 Reconnection
- [ ] Bei 401-Fehler: `initialized = false`, `ensureAuthenticated()` erneut
- [ ] Kein Browser-Popup wenn Refresh-Token noch gueltig
- [ ] Refresh-Token Ablauf-Warnung (30 Tage Limit)

### 6.4 Robustheit
- [ ] Alle API-Calls mit Timeout (15s)
- [ ] Keine unbehandelten Promise-Rejections
- [ ] Kein Memory-Leak bei Action-Registrierung/Deregistrierung
- [ ] Sauberes Cleanup bei Plugin-Stop

### Phase 6 Verifikation
- [ ] Simulierter API-Fehler: Plugin zeigt Alert, pollt weiter
- [ ] Simulierter Auth-Ablauf: Re-Auth ohne Browser-Spam
- [ ] 24h Dauerbetrieb ohne Memory-Leak oder Haenger

---

## Phase 7: Testing

### 7.1 Test-Setup
- [ ] Test-Framework installieren (vitest oder mocha)
- [ ] Test-Konfiguration (`vitest.config.ts` oder `.mocharc.yml`)
- [ ] Mock-Setup fuer `@elgato/streamdeck` (streamDeck.connect, actions, settings)
- [ ] Mock-Setup fuer `node-tado-client` (Tado-Klasse, API-Responses)
- [ ] Test-Fixtures: Beispiel-ZoneState, Beispiel-Token, Beispiel-Settings
- [ ] Coverage-Reporting einrichten

### 7.2 Unit Tests - Kern-Module
- [ ] **TadoManager Tests:**
  - [ ] `ensureAuthenticated()` laeuft nur einmal (Idempotenz)
  - [ ] Mehrere gleichzeitige Calls warten auf dasselbe Promise
  - [ ] Refresh-Token wird korrekt aus Settings geladen
  - [ ] Browser oeffnet sich nur bei fehlender/ungueltiger Auth
  - [ ] Token-Callback speichert korrekt in Global Settings
  - [ ] Error-Handling: InvalidRefreshToken, AuthTimeout
- [ ] **PollingService Tests:**
  - [ ] `registerZone()` startet Polling wenn vorher leer
  - [ ] `unregisterZone()` stoppt Polling wenn danach leer
  - [ ] Kein Polling wenn keine Zonen registriert (Visibility-aware)
  - [ ] `getZoneStates()` wird einmal pro Home aufgerufen (nicht pro Zone)
  - [ ] Cache wird korrekt aktualisiert
  - [ ] `refreshZone()` aktualisiert einzelne Zone sofort
  - [ ] Listener werden korrekt benachrichtigt
  - [ ] Listener-Unsubscribe funktioniert (kein Memory-Leak)
  - [ ] Rate-Limit-Drosslung bei niedrigem Kontingent
  - [ ] Error in einem Listener blockiert nicht andere Listener
- [ ] **Temperature Utils Tests:**
  - [ ] Celsius <-> Fahrenheit Konvertierung (inkl. Randfaelle)
  - [ ] `formatTemperature()` korrekte Formatierung
  - [ ] `clampTemperature()` Min/Max Grenzen
  - [ ] `getIndicatorPercent()` korrekte Prozentberechnung

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
