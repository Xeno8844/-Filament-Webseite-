/* ==========================================================================
   Filament-Lager — Service Worker
   --------------------------------------------------------------------------
   Zweck: Die App startet auch ohne Internet und laesst sich als richtige
   Anwendung installieren (eigenes Fenster, Icon im Startmenue bzw. auf dem
   Startbildschirm).

   Strategie: "Netz zuerst, Zwischenspeicher als Rueckfall".
   Damit bekommst du beim Hochladen einer neuen Fassung immer sofort die
   aktuelle Seite und bist trotzdem offline arbeitsfaehig.

   WICHTIG: Anfragen an Supabase werden bewusst NICHT abgefangen. Der
   Bestand darf nie aus einem Zwischenspeicher kommen - sonst saehe man
   veraltete Daten und der Konfliktschutz liefe ins Leere.
   ========================================================================== */

var CACHE = "filament-lager-v1";

var DATEIEN = [
  "./",
  "./index.html",
  "./site.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon-180.png",
  "./icon.svg"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Jede Datei einzeln ablegen: fehlt eine, soll die Installation
      // trotzdem gelingen (addAll wuerde komplett abbrechen).
      return Promise.all(DATEIEN.map(function (u) {
        return c.add(u).catch(function () { /* nicht vorhanden - egal */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;

  // Nur einfache Abrufe. Speichern und Anmelden nie anfassen.
  if (req.method !== "GET") return;

  // Alles Fremde (Supabase) direkt durchlassen.
  var url;
  try { url = new URL(req.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === "basic") {
        var kopie = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, kopie); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (treffer) {
        // Beim Seitenaufruf notfalls die gespeicherte Startseite liefern
        if (treffer) return treffer;
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
