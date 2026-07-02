import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  durationToSeconds,
  toIso,
  mapVehicle,
  dedupeVehicles,
  buildVehicleData,
  selectPassages,
} from "./index.js";

const load = (name) =>
  JSON.parse(readFileSync(new URL(`../../data-example/${name}`, import.meta.url), "utf8"));

test("durationToSeconds parse les durées ISO-8601 signées", () => {
  assert.equal(durationToSeconds("PT3M"), 180);
  assert.equal(durationToSeconds("PT30S"), 30);
  assert.equal(durationToSeconds("-PT1M30S"), -90);
  assert.equal(durationToSeconds("PT1H"), 3600);
  assert.equal(durationToSeconds(null), null);
  assert.equal(durationToSeconds("n'importe quoi"), null);
});

test("toIso normalise ou renvoie null", () => {
  assert.equal(toIso("2025-12-29T18:38:54.2159193Z"), "2025-12-29T18:38:54.215Z");
  assert.equal(toIso(null), null);
  assert.equal(toIso("pas une date"), null);
});

test("mapVehicle extrait les bons champs d'une VehicleActivity SIRI réelle", () => {
  const siri = load("vehicle-monitoring.json");
  const activity = siri.Siri.ServiceDelivery.VehicleMonitoringDelivery[0].VehicleActivity[0];
  const v = mapVehicle(activity);
  assert.equal(v.vehicleId, "ActIV:Vehicle:Bus:1401:LOC");
  assert.equal(v.lineId, "ActIV:Line::C20E:SYTRAL");
  assert.equal(v.direction, "inbound");
  assert.equal(v.latitude, 45.75751);
  assert.equal(v.longitude, 4.82874);
  assert.equal(v.delay, "PT3M");
  assert.equal(v.dataSource, "TCL");
  assert.equal(v.bearing, 108);
  assert.equal(v.vehicleStatus, "EXPECTED");
  assert.equal(v.destinationName, "ActIV:StopArea:SP:48376:SYTRAL");
  assert.equal(v.recordedAtTime, "2025-12-29T18:38:54.215Z");
});

test("mapVehicle renvoie null sans MonitoredVehicleJourney", () => {
  assert.equal(mapVehicle({}), null);
  assert.equal(mapVehicle(null), null);
});

test("dedupeVehicles garde un seul enregistrement par vehicleId", () => {
  const base = { vehicleId: "V1", delay: "PT5M" };
  const deduped = dedupeVehicles([
    { ...base, delay: "PT5M" },
    { ...base, delay: "PT1M" }, // retard absolu plus faible → gagnant
    { vehicleId: "V2", delay: null },
    null,
    { vehicleId: null, delay: "PT1M" }, // sans id → ignoré
  ]);
  assert.equal(deduped.length, 2);
  const v1 = deduped.find((v) => v.vehicleId === "V1");
  assert.equal(v1.delay, "PT1M");
});

test("dedupeVehicles préfère un retard non-null à un null", () => {
  const deduped = dedupeVehicles([
    { vehicleId: "V1", delay: null },
    { vehicleId: "V1", delay: "PT9M" },
  ]);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].delay, "PT9M");
});

test("buildVehicleData produit un VehicleData complet depuis le flux réel", () => {
  const siri = load("vehicle-monitoring.json");
  const data = buildVehicleData(siri);
  assert.equal(data.apiStatus, "OK");
  assert.ok(data.vehicles.length > 0);
  assert.equal(data.apiResponseTimestamp, "2025-12-29T18:41:02.602Z");
  assert.ok(typeof data.lastFetchTime === "string");
  // pas de doublon de vehicleId
  const ids = data.vehicles.map((v) => v.vehicleId);
  assert.equal(new Set(ids).size, ids.length);
  // tous les champs du contrat présents
  for (const v of data.vehicles.slice(0, 5)) {
    for (const k of ["vehicleId", "lineId", "latitude", "longitude", "vehicleStatus"]) {
      assert.ok(k in v, `champ manquant: ${k}`);
    }
  }
});

test("buildVehicleData gère une réponse vide", () => {
  assert.equal(buildVehicleData({}).apiStatus, "EMPTY_RESPONSE");
  assert.equal(buildVehicleData(null).apiStatus, "EMPTY_RESPONSE");
});

test("selectPassages filtre par stopId et trie par heurepassage", () => {
  const values = load("tcl_sytral.tclpassagearret.json").values;
  const anId = String(values[0].id);
  const filtered = selectPassages(values, anId);
  assert.ok(filtered.length >= 1);
  assert.ok(filtered.every((p) => String(p.id) === anId));
  // trié croissant sur heurepassage
  for (let i = 1; i < filtered.length; i++) {
    assert.ok(String(filtered[i - 1].heurepassage) <= String(filtered[i].heurepassage));
  }
  // les champs du contrat sont préservés tels quels (transfert direct)
  const p = filtered[0];
  for (const k of ["id", "ligne", "direction", "delaipassage", "heurepassage", "gid"]) {
    assert.ok(k in p, `champ passage manquant: ${k}`);
  }
});

test("selectPassages sans stopId renvoie tout", () => {
  const values = load("tcl_sytral.tclpassagearret.json").values;
  assert.equal(selectPassages(values, null).length, values.length);
  assert.deepEqual(selectPassages(null, "x"), []);
});
