const lineSelect = document.getElementById('lineSelect');
const directionSelect = document.getElementById('directionSelect');
const results = document.getElementById('results');
const maxmins = 100;
const maxSeconds = maxmins * 60;

let currentStopId = null;
let stopId = null;
let stopIdSelectedByUser = null;

let currentAtmStopId = null;
let ATMstopIdSelectedByUser = null;
let ATMstopName = null;

let currentCorbStopId = null;
let CORBstopIdSelectedByUser = null;

let currentTgoStopId = null;
let TGOstopIdSelectedByUser = null;
let TGOstopName = null;

let currentSagStopId = null;
let SAGstopIdSelectedByUser = null;
let SAGstopName = null;

let currentTusStopId = null;
let TUSstopIdSelectedByUser = null;
let TUSstopName = null;

let currentMonStopId = null;
let MONstopIdSelectedByUser = null;
let MONstopName = null;

let tmbLineCodes = new Set();

let mapInitialized = false;
let allStopsLayer = null;
let map

let isLoadingStopInfo = false;
let searchEnabled = false;

let sisAtmBuses = [];
let movAtmBuses = [];

let busItems = [];

let currentTgoDirectionId = null;
let currentTgoLineId = null;

let currentSagDirectionId = null;
let currentSagLineId = null;

let sagSelectedLineData = null;

function capitalizar(texto) {
  const minusculas = ['de', 'del', 'la', 'el', 'i', 'd\'', 'da', 'do', 'dos'];

  return texto
    .toLowerCase()
    .split(/([\s-])/)
    .map((palabra, i) =>
      i !== 0 && minusculas.includes(palabra)
        ? palabra
        : palabra.charAt(0).toUpperCase() + palabra.slice(1)
    )
    .join(' ');
}

async function loadTmbLineCodes() {
  try {
    const res = await protectedFetch(`/php/api/tmb/v1/transit/linies/bus/endpoint.php`);
    const data = await res.json();
    tmbLineCodes = new Set(
      data.features
        .map(f => f.properties.NOM_LINIA)
        .filter(code => !!code)
    );
    // Añadir manualmente H44 y V45
    tmbLineCodes.add('H44');
    tmbLineCodes.add('V45');
  } catch (err) {
    console.error("Error carregant línies TMB:", err);
    showError("No s'han pogut carregar les línies de TMB per filtrar correctament els autobusos.");
  }
}

window.onload = function () {
  document.getElementById("reloadBtn").disabled = true;
};

let restartbtn = document.getElementById('restartBtn')
if (restartbtn != null) {
  restartbtn.addEventListener('click', () => {
  location.reload();
  });
};



document.getElementById("enabler").addEventListener("click", () => {
  const container = document.getElementById("cercador");
  // Evitem activar la cerca per línia i sentit per duplicat
  if (!searchEnabled) {
    container.style.display = "block";
    document.getElementById("enabler").style.display = "none";
    searchEnabled = true; // Fem constar que la cerca per línia i sentit ja s'ha carregat.
  }
});

// Quan l'usuari demana el plànol clicant el botó activem la carrega del plànol
document.getElementById("mapSearchBtn").addEventListener("click", () => {
  const container = document.getElementById("map");
  container.style.display = "block";
  document.getElementById("mapSearchBtn").style.display = "none";

  // Evitem carregar el plànol si ja ho està amb el condicional
  if (!mapInitialized) {
    initMap(); // Funció que carrega el plànol
    mapInitialized = true; // Fem constar que el plànol ja està carregat.
  }
});

// Carreguem el plànol
function initMap() {
  map = L.map('map').setView([41.3851, 2.1734], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  markerClusters = L.markerClusterGroup();
  markerClusters.clearLayers();
    map.addLayer(markerClusters);
    Promise.all([
      loadTmbStopsOnMap(),
      loadAmbStopsOnMap(),
      loadSisStopsOnMap(),
      loadMovStopsOnMap(),
      loadCorbStopsOnMap(),
      loadTgoStopsOnMap(),
      loadSagStopsOnMap(),
      loadTusStopsOnMap(),
      loadMonStopsOnMap()
    ]);
    map.on("popupopen", function (e) {

      const buttons = e.popup._contentNode.querySelectorAll(".popup-btn");

      buttons.forEach(btn => {

        btn.addEventListener("click", () => {

          const handlerName = btn.dataset.handler;
          const code = decodeURIComponent(btn.dataset.code);
          const name = decodeURIComponent(btn.dataset.name);

          if (typeof window[handlerName] === "function") {
            window[handlerName](code, name);
          }

        });

      });

    });
}

function createPopupButton(handler, code, name, text = "Veure temps d'espera") {
  return `
    <button class="popup-btn"
      data-handler="${handler}"
      data-code="${encodeURIComponent(code)}"
      data-name="${encodeURIComponent(name)}">
      ${text}
    </button>
  `;
}

function addStopMarker({lat, lon, name, code, handler, buttonText = "Veure temps d'espera", extraHtml = ""}) {
  if (isNaN(lat) || isNaN(lon)) return;
  const marker = L.marker([lat, lon]).bindPopup(`
    <strong>${name}</strong><br>
    ${extraHtml}
    ${createPopupButton(handler, code, name, buttonText)}
  `);
  markerClusters.addLayer(marker);
}

async function loadGenericStops({url, extractStops, parseStop, errorMessage}) {
  try {

    const res = await protectedFetch(url);

    if (!res.ok) {
      throw new Error(errorMessage);
    }

    const data = await res.json();

    const stops = extractStops(data);

    stops.forEach(stop => {

      try {

        const parsed = parseStop(stop);

        addStopMarker(parsed);

      } catch (e) {

        console.error("Error processant parada:", stop, e);

      }

    });

  } catch (err) {

    console.error(errorMessage, err);

  }
}

function loadTmbStopsOnMap() {

  loadGenericStops({

    url: '/php/api/tmb/v1/transit/parades/endpoint.php',

    extractStops: data => data.features || [],

    parseStop: stop => {

      const [lon, lat] = stop.geometry.coordinates;

      const rawname = stop.properties.NOM_PARADA || "Parada";

      const name = rawname.replace(/ - Final (de )?trajecte/, "");

      return {
        lat,
        lon,
        name,
        code: stop.properties.CODI_PARADA,
        handler: "handleMapStopClick",
        extraHtml: `Codi: ${stop.properties.CODI_PARADA}<br>`
      };

    },

    errorMessage: 'Error carregant parades TMB:'

  });

}

function loadAmbStopsOnMap() {

  loadGenericStops({

    url: '/php/api/amb/v2/bus/stops/endpoint.php',

    extractStops: data => {

      return data.filter(
        stop => !/^0{1,5}\d{1,4}$/.test(stop.document.codAMB)
      );

    },

    parseStop: stop => ({

      lat: stop.document.utmx,
      lon: stop.document.utmy,
      name: stop.document.name,
      code: stop.document.id,
      handler: "handleMapStopClick",
      extraHtml: `Codi: ${stop.document.id}<br>`

    }),

    errorMessage: 'Error carregant parades AMB:'

  });

}

function loadSisStopsOnMap() {

  loadGenericStops({

    url: '/php/api/sis/stops/endpoint.php',

    extractStops: data => data,

    parseStop: stop => ({

      lat: stop.latitude,
      lon: stop.longitude,
      name: stop.name,
      code: stop.ATMstopId,
      handler: "handleAtmMapStopClick"

    }),

    errorMessage: 'Error carregant parades de Soler i Sauret:'

  });

}

function loadMovStopsOnMap() {

  loadGenericStops({

    url: '/php/api/mov/endpoint.php?op=stops_map',

    extractStops: data => data.stops || [],

    parseStop: stop => ({

      lat: stop.lat,
      lon: stop.lon,
      name: stop.name,
      code: stop.stopId,
      handler: "handleAtmMapStopClick"

    }),

    errorMessage: 'Error carregant parades MOVENTIS:'

  });

}

function loadCorbStopsOnMap() {

  loadGenericStops({

    url: '/php/api/corb/stops/endpoint.php',

    extractStops: data => data || [],

    parseStop: stop => ({

      lat: parseFloat(stop.lat),
      lon: parseFloat(stop.lon),
      name: stop.name,
      code: stop.stop_id,
      handler: "handleCorbMapStopClick"

    }),

    errorMessage: 'Error carregant parades Autocorb:'

  });

}

function loadTgoStopsOnMap() {

  loadGenericStops({

    url: '/php/api/tgo/stops/endpoint.php',

    extractStops: data => data.stops || [],

    parseStop: stop => ({
      lat: parseFloat(stop.stopLat),
      lon: parseFloat(stop.stopLon),
      name: stop.stopName,
      code: stop.stopId,
      handler: "handleTgoMapStopClick"
    }),

    errorMessage: 'Error carregant parades TGO:'

  });

}

function loadSagStopsOnMap() {

  loadGenericStops({

    url: '/php/api/sag/stops/endpoint.php',

    extractStops: data => data.stops || [],

    parseStop: stop => ({
      lat: parseFloat(stop.lat),
      lon: parseFloat(stop.lon),
      name: stop.name,
      code: stop.stopCode,
      handler: "handleSagMapStopClick"
    }),

    errorMessage: 'Error carregant parades Sagalés:'

  });

}

function loadTusStopsOnMap() {

  loadGenericStops({

    url: '/php/api/tus/stops/endpoint.php',

    extractStops: data => data,

    parseStop: stop => ({
      lat: stop.latitude,
      lon: stop.longitude,
      name: stop.name,
      code: stop.code,
      handler: "handleTusMapStopClick"
    }),

    errorMessage: 'Error carregant parades TUS:'

  });

}

function loadMonStopsOnMap() {

  loadGenericStops({

    url: '/php/api/mon/stops/endpoint.php',

    extractStops: data => data,

    parseStop: stop => ({
      lat: stop.latitude,
      lon: stop.longitude,
      name: stop.name,
      code: stop.code,
      handler: "handleMonMapStopClick"
    }),

    errorMessage: 'Error carregant parades MON:'

  });

}

/*
// Afegim les parades de TMB al plànol
function loadTmbStopsOnMap() {
  protectedFetch(`/php/api/tmb/v1/transit/parades/endpoint.php`)
    .then(response => {
      if (!response.ok) throw new Error("No es pot carregar la llista de parades.");
      return response.json();
    })
    .then(data => {
      const stops = data.features;

      if (allStopsLayer) {
        map.removeLayer(allStopsLayer);
      }

      stops.filter(stop => {
        const coords = stop.geometry?.coordinates;
        return coords && !isNaN(coords[0]) && !isNaN(coords[1]);
      })

      .map(stop => {
        const [lon, lat] = stop.geometry.coordinates;
        const rawname = stop.properties.NOM_PARADA || "Parada";
        const name = rawname.replace(/ - Final (de )?trajecte/, "");
        const code = stop.properties.CODI_PARADA;

        const marker = L.marker([lat, lon])
          .bindPopup(`<strong>${name}</strong><br>Codi: ${code}<button onclick="handleMapStopClick('${code}')">Veure temps d'espera</button>`);
        markerClusters.addLayer(marker);
      });

      // Centrar el mapa a todas las paradas
      // const bounds = L.latLngBounds(markers.map(m => m.getLatLng()));
      // map.fitBounds(bounds, { padding: [50, 50] });
    })
}

// Afegim les parades de l'AMB al plànol
async function loadAmbStopsOnMap() {
  try {
    const res = await protectedFetch('/php/api/amb/v2/bus/stops/endpoint.php');
    const rawAmbStops = await res.json()

    // Filtrar les que NO son TMB
    const nonTmbStops = rawAmbStops.filter(stop => !/^0{1,5}\d{1,4}$/.test(stop.document.codAMB));

    nonTmbStops
    .filter(stop =>
      stop.document.utmx && stop.document.utmy &&
      !isNaN(stop.document.utmx) && !isNaN(stop.document.utmy)
    )

    .map(stop => {
      const lat = stop.document.utmx;
      const lon = stop.document.utmy;
      const name = stop.document.name;
      const code = stop.document.id;

      const marker = L.marker([lat, lon])
        .bindPopup(`<strong>${name}</strong><br>Codi: ${code}<br><button onclick="handleMapStopClick('${code}')">Veure temps d'espera</button>`);
      markerClusters.addLayer(marker);
    })

    // Añadir al mapa junto con las demás
    //allStopsLayer.addLayer(ambLayer); // Si usas layerGroup general
  } catch (err) {
    console.error('Error carregant parades AMB:', err);
  }
}

async function loadSisStopsOnMap() {
  try {
    const res = await protectedFetch('/php/api/sis/stops/endpoint.php');
    const rawAtmStops = await res.json()
    console.log('rawAtmStops', rawAtmStops, Array.isArray(rawAtmStops));

    // Filtrar les que NO son AMB
    //const nonAmbStops = rawAmbStops.filter(stop => !/^0{1,5}\d{1,4}$/.test(stop.document.codAMB));

    rawAtmStops
    //.filter(stop =>
    //  stop.document.utmx && stop.document.utmy &&
    //  !isNaN(stop.document.utmx) && !isNaN(stop.document.utmy)
    //)

    .map(stop => {
      try {
        const lat = stop.latitude;
        const lon = stop.longitude;
        const name = stop.name;
        const ATMcode = stop.ATMstopId;

        const marker = L.marker([lat, lon])
          .bindPopup(`<strong>${name}</strong><br><button onclick="handleAtmMapStopClick('${ATMcode}','${name}')">Veure temps d'espera</button>`);
        markerClusters.addLayer(marker);
      } catch(e) {
        console.error('Error creando marcador ATM:', stop, e);
      }
    })

    // Añadir al mapa junto con las demás
    //allStopsLayer.addLayer(ambLayer); // Si usas layerGroup general
  } catch (err) {
    console.error('Error carregant parades ATM:', err);
  }
}

async function loadMovStopsOnMap() {
  try {
    const res = await protectedFetch('/php/api/mov/endpoint.php?op=stops_map');
    const movstops = await res.json();

    movstops.stops.forEach(s => {
      const lat = s.lat;
      const lon = s.lon;
      const name = s.name;
      const code = String(s.stopId);

      if (!lat || !lon) return;

      const marker = L.marker([lat, lon])
        .bindPopup(`<strong>${name}</strong><br><button onclick="handleAtmMapStopClick('${code}','${name.replaceAll("'","")}')">Veure temps d'espera</button>`);
      markerClusters.addLayer(marker);
    });
  } catch (e) {
    console.error('Error carregant parades MOVENTIS:', e);
  }
}

async function loadCorbStopsOnMap() {
  try {
    const res = await protectedFetch('/php/api/corb/stops/endpoint.php');
    const data = await res.json();
    const corbStops = data || [];

    corbStops.forEach(stop => {
      const lat = parseFloat(stop.lat);
      const lon = parseFloat(stop.lon);
      const name = stop.name;
      const code = String(stop.stop_id).replaceAll("'", "");

      if (isNaN(lat) || isNaN(lon)) return;

      const marker = L.marker([lat, lon]).bindPopup(
        `<strong>${name}</strong><br><button onclick="handleCorbMapStopClick('${code}','${name.replaceAll("'", "")}')">Veure informació</button>`
      );

      markerClusters.addLayer(marker);
    });
  } catch (err) {
    console.error('Error carregant parades Autocorb:', err);
  }
}

async function loadTgoStopsOnMap() {
  try {
    const res = await protectedFetch('/php/api/tgo/stops/endpoint.php');
    const data = await res.json();
    const tgoStops = data.stops || [];

    tgoStops.forEach(stop => {
      const lat = parseFloat(stop.stopLat);
      const lon = parseFloat(stop.stopLon);
      const name = stop.stopName;
      const code = String(stop.stopId).replaceAll("'", "");

      if (isNaN(lat) || isNaN(lon)) return;

      const marker = L.marker([lat, lon]).bindPopup(
        `<strong>${name}</strong><br><button onclick="handleTgoMapStopClick('${code}','${name.replaceAll("'", "")}')">Veure informació</button>`
      );

      markerClusters.addLayer(marker);
    });
  } catch (err) {
    console.error('Error carregant parades TGO:', err);
  }
}

async function loadSagStopsOnMap() {
  try {

    const res = await protectedFetch('/php/api/sag/stops/endpoint.php');
    const data = await res.json();

    const sagStops = data.stops || [];
    console.log(sagStops);

    sagStops.forEach(stop => {

      const lat = parseFloat(stop.lat);
      const lon = parseFloat(stop.lon);
      const name = stop.name;
      const code = String(stop.stopCode).replaceAll("'", "");

      if (isNaN(lat) || isNaN(lon)) return;

      const marker = L.marker([lat, lon]).bindPopup(
        `<strong>${name}</strong><br><button onclick="handleSagMapStopClick('${code}','${name.replaceAll("'", "")}')">Veure informació</button>`
      );

      markerClusters.addLayer(marker);

    });

  } catch (err) {
    console.error('Error carregant parades Sagalés:', err);
  }
}

// Nova funció per a les parades de TUS
async function loadTusStopsOnMap() {
  try {
    // Fem la petició a l'endpoint que hem creat (ajusta la ruta si cal)
    const res = await protectedFetch('/php/api/tus/stops/endpoint.php'); 
    if (!res.ok) throw new Error("No s'ha pogut carregar el fitxer de parades TUS.");
    
    const tusStops = await res.json();

    tusStops.forEach(stop => {
      // Comprovem que tinguem coordenades vàlides
      if (stop.latitude && stop.longitude) {
        const lat = stop.latitude;
        const lon = stop.longitude;
        const name = stop.name;
        const code = stop.code;

        // Creem el marcador amb el format que ja utilitzes
        const marker = L.marker([lat, lon])
          .bindPopup(`
            <strong>${name}</strong><br>
            <button onclick="handleTusMapStopClick('${code}', '${name}')">Veure temps d'espera</button>
          `);
        
        markerClusters.addLayer(marker);
      }
    });
  } catch (err) {
    console.error('Error carregant parades TUS:', err);
  }
}

async function loadMonStopsOnMap() {
  try {
    // Fem la petició a l'endpoint que hem creat (ajusta la ruta si cal)
    const res = await protectedFetch('/php/api/mon/stops/endpoint.php'); 
    if (!res.ok) throw new Error("No s'ha pogut carregar el fitxer de parades MON.");
    
    const monStops = await res.json();

    monStops.forEach(stop => {
      // Comprovem que tinguem coordenades vàlides
      if (stop.latitude && stop.longitude) {
        const lat = stop.latitude;
        const lon = stop.longitude;
        const name = stop.name;
        const code = stop.code;

        // Creem el marcador amb el format que ja utilitzes
        const marker = L.marker([lat, lon])
          .bindPopup(`
            <strong>${name}</strong><br>
            <button onclick='handleMonMapStopClick(${JSON.stringify(code)}, ${JSON.stringify(name)})'>Veure temps d'espera</button>
          `);
        
        markerClusters.addLayer(marker);
      }
    });
  } catch (err) {
    console.error('Error carregant parades MON:', err);
  }
}
*/


function handleMapStopClick(code) {
  //document.getElementById("stopIdInput").value = code; // actualiza el input manual
  currentStopId = code; // guarda para recarga
  stopId = code;
  loadArrivals(stopId);
}

function handleAtmMapStopClick(code, ATMparamStopName) {
  //document.getElementById("stopIdInput").value = code; // actualiza el input manual
  currentAtmStopId = code; // guarda para recarga
  stopId = code;
  ATMstopName = ATMparamStopName;
  //console.log('stopId = ', stopId, 'currentAtmStopId = ', currentAtmStopId, 'code = ', code, 'ATMstopName = ', ATMstopName)
  loadAtmArrivals(stopId, ATMparamStopName);
}

async function handleCorbMapStopClick(code, CORBparamStopName) {
  currentCorbStopId = code; // guarda para recarga
  stopId = code;
  CORBstopName = CORBparamStopName;
  loadCorbArrivals(stopId, CORBparamStopName);
}

async function handleTgoMapStopClick(code, TGOparamStopName) {
  currentTgoStopId = code; // guarda para recarga
  stopId = code;
  TGOstopName = TGOparamStopName;
  loadTgoArrivals(stopId, TGOparamStopName);
}

async function handleSagMapStopClick(code, SAGparamStopName) {
  currentSagStopId = code;
  stopId = code;
  SAGstopName = SAGparamStopName;
  loadSagArrivals(stopId, SAGparamStopName);
}

async function handleTusMapStopClick(code, TUSparamStopName) {
  currentTusStopId = code;
  stopId = code;
  TUSstopName = TUSparamStopName;
  loadTusArrivals(stopId, TUSparamStopName);
}

async function handleMonMapStopClick(code, MONparamStopName) {
  currentMonStopId = code;
  stopId = code;
  MONstopName = MONparamStopName;
  loadMonArrivals(stopId, MONparamStopName);
}

function buildCategorySelect() {
  const sel = document.getElementById("categorySelect");
  sel.innerHTML = "";

  const LINE_CATEGORIES = [
    "1 – 60",
    "61 – 100",
    "101 – 120",
    "121 – 140",
    "141 – 200",
    "201+",
    "A",
    "B",
    "C",
    "D / H / V (Nova Xarxa de Bus)",
    "L",
    "M",
    "N (Nocturnes)",
    "E / X (Exprés)",
    "Autobusos locals"
  ];


  const def = document.createElement("option");
  def.value = "";
  def.textContent = "-- Seleccioneu categoria --";
  def.disabled = true;
  def.selected = true;
  sel.appendChild(def);

  LINE_CATEGORIES.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

async function loadLines() {
  const lineSelect = document.getElementById('lineSelect');
  const categorySelect = document.getElementById('categorySelect');

  // Limpia todo porque este es el "reset" inicial real
  lineSelect.innerHTML = "";
  directionSelect.innerHTML = "";
  stopSelect.innerHTML = "";

  allLines = []; // reset global

  try {
    // Fetch TMB
    const resTMB = await protectedFetch(`/php/api/tmb/v1/transit/linies/bus/endpoint.php`);
    const dataTMB = await resTMB.json();

    const linesTMB = dataTMB.features.map(f => ({
      value: f.properties.CODI_LINIA,
      name: f.properties.NOM_LINIA,
      desc: f.properties.DESC_LINIA,
      source: 'TMB'
    }));

    allLines.push(...linesTMB);
  } catch (err) {
    console.error("Error cargando TMB:", err);
  }

  // --- AMB ---
  try {
    const resAMB = await protectedFetch(`/php/api/tmb/v1/transit/core/linies/endpoint.php`);
    const dataAMB = await resAMB.json();

    const filtered = dataAMB.features
      .filter(g => g.properties.NOM_TIPUS_TRANSPORT === 'bus')
      .filter(f => f.properties.NOM_OPERADOR !== 'Transports Metropolitans de Barcelona')
      .map(line => ({
        value: line.properties.NOM_LINIA,
        name: line.properties.NOM_LINIA,
        desc: line.properties.ORIGEN_LINIA + " / " + line.properties.DESTI_LINIA,
        source: 'AMB'
      }));

    allLines.push(...filtered);
  } catch (err) {
    console.error("Error cargando AMB:", err);
  }

  // --- SIS ---
  try {
    const resSIS = await protectedFetch(`/php/api/sis/lines/endpoint.php`);
    const dataSIS = await resSIS.json();

    const linesSIS = dataSIS.map(line => ({
      value: line.lineCode,
      name: line.lineCode,
      desc: line.name,
      source: 'SIS'
    }));

    allLines.push(...linesSIS);
  } catch (err) {
    console.error("Error carregant línies interurbanes de Soler i Sauret:", err);
  }

  // --- MOVENTIS ---
  try {
    const resMOV = await protectedFetch(`/php/api/mov/endpoint.php?op=lines`);
    const dataMOV = await resMOV.json();

    const linesMOV = (dataMOV?.lines || []).map(l => ({
      value: l.code,
      name: l.code,
      desc: l.desc,
      source: 'MOV'
    }));

    allLines.push(...linesMOV);
  } catch (err) {
    console.error("Error carregant línies interurbanes de Moventis:", err);
  }

  // --- Autocorb ---
  try {
    const resCORB = await protectedFetch(`/php/api/corb/lineas/endpoint.php`);
    const dataCORB = await resCORB.json();

    const linesCORB = (dataCORB?.message || []).map(l => ({
      value: l.route_id,                    // ej: "e8", "560", "urbaL1"
      name: l.route_short_name || l.route_id,
      desc: l.route_long_name || "",
      source: "CORB"
    }));

    allLines.push(...linesCORB);
  } catch (err) {
    console.error("Error carregant línies d'Autocorb:", err);
  }

  // --- TGO ---
  try {
    const resTGO = await protectedFetch(`/php/api/tgo/lines/endpoint.php`);
    const dataTGO = await resTGO.json();

    const linesTGO = (dataTGO?.routes || []).map(line => ({
      value: line.routeId,
      name: line.routeShortName || line.routeId,
      desc: line.routeLongName || line.routeId,
      source: 'TGO'
    }));

    allLines.push(...linesTGO);
  } catch (err) {
    console.error("Error carregant línies interurbanes de Direxis TGO:", err);
  }

  // --- Sagalés ---
  try {
    const res = await protectedFetch('/php/api/sag/lines/endpoint.php');
    const dataSAG = await res.json();

    if (!dataSAG.success) {
      throw new Error('Sag lines response invalid');
    }

    const linesSAG = (dataSAG?.lines || []).map(line => ({
      value: line.id,
      name: line.shortName,
      desc: line.longName,
      source: 'SAG'
    }));

    allLines.push(...linesSAG);

  } catch (err) {
    console.error('Error carregant línies Sagalés:', err);
  }

  // --- Monbus ---
  try {
    const resMON = await protectedFetch(`/php/api/mon/lines/endpoint.php`);
    const dataMON = await resMON.json();

    const linesMON = dataMON.map(line => ({
      value: line.code,          // ej: "e5", "373"
      name: line.code,
      desc: line.description,
      source: 'MON'
    }));

    allLines.push(...linesMON);
  } catch (err) {
    console.error("Error carregant línies de Monbus:", err);
  }
  // Una vez cargadas TODAS las líneas...
  buildCategorySelect(); // ← solo aquí
}

function buildLineSelect(allLines, selectedCategory) {
  const lineSelect = document.getElementById("lineSelect");
  lineSelect.innerHTML = "";

  const def = document.createElement("option");
  def.value = "";
  def.textContent = "-- Seleccioneu línia al menú desplegable --";
  def.disabled = true;
  def.selected = true;
  lineSelect.appendChild(def);

  allLines
    .filter(l => getFolderName(l.name) === selectedCategory)
    .sort((a, b) =>
      new Intl.Collator(undefined, { numeric: true }).compare(a.name, b.name)
    )
    .forEach(line => {
      const opt = document.createElement("option");
      opt.value = line.value;
      opt.textContent = `${line.name} > ${line.desc} (${line.source})`;
      opt.dataset.source = line.source;
      lineSelect.appendChild(opt);
    });
}

document.getElementById("categorySelect").addEventListener("change", () => {
  const cat = categorySelect.value;
  buildLineSelect(allLines, cat);

  directionSelect.innerHTML = "";
  stopSelect.innerHTML = "";
});


lineSelect.addEventListener('change', async () => {
  const directionSelect = document.getElementById('directionSelect');
  directionSelect.innerHTML = '';
  const stopSelect = document.getElementById('stopSelect');
  stopSelect.innerHTML = '';

  const defaultDirOption = document.createElement('option');
  defaultDirOption.value = '';
  defaultDirOption.textContent = '-- Seleccioneu sentit al menú desplegable --';
  defaultDirOption.disabled = true;
  defaultDirOption.selected = true;
  directionSelect.appendChild(defaultDirOption);
  const lineId = lineSelect.value;
  const source = lineSelect.selectedOptions[0]?.dataset.source;

  if (source === 'TMB') {
    try {
      // Fetch paradas por línea para obtener sentidos reales
      const res = await protectedFetch(`/php/api/tmb/v1/transit/linies/bus/linia/parades/endpoint.php?lineId=${lineId}`);
      const data = await res.json();
      const features = data.features;

      if (!features?.length) {
        console.warn('No se encontraron paradas para esta línea');
        return;
      }

      // Agrupar sentidos por ID_SENTIT
      const sentidos = {};
      for (const stop of features) {
        const props = stop.properties;
        const idSentit = props.ID_SENTIT;
        if (!sentidos[idSentit]) {
          sentidos[idSentit] = {
            origen: props.ORIGEN_SENTIT,
            desti: props.DESTI_SENTIT,
            id: idSentit
          };
        }
      }

      // Añadir opciones al <select>
      Object.values(sentidos).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.text = `${s.origen} → ${s.desti}`;
        directionSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error cargando sentidos TMB:', err);
    }
  } else if (source === 'AMB') {
    try {
      // Fetch paradas por línea para obtener sentidos reales
      const res = await protectedFetch(`/php/api/tmb/v1/transit/core/linies/amb/linia/recs/elements/endpoint.php?lineId=${lineId}`);
      const data = await res.json();
      const features = data.features;

      if (!features?.length) {
        console.warn('No se encontraron paradas para esta línea');
        return;
      }

      // Agrupar sentidos por ID_SENTIT
      const sentidos = {};
      for (const stop of features) {
        const props = stop.properties;
        const idSentit = props.ID_SENTIT;
        if (!sentidos[idSentit]) {
          sentidos[idSentit] = {
            origen: props.ORIGEN_TRAJECTE,
            desti: props.DESTI_TRAJECTE,
            id: idSentit
          };
        }
      }

      // Añadir opciones al <select>
      Object.values(sentidos).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        //opt.text = `${s.origen} → ${s.desti}`;
        //opt.text = lineId === 'N0' ? s.desti : `${s.origen} → ${s.desti}`;
        const linesOnlyDestination = ['LH1', 'LH2', 'N0', 'CV1', 'CV2', 'CV3', 'CV4', 'CV5']; // añade aquí las que quieras

        opt.text = linesOnlyDestination.includes(lineId) ? s.desti : `${s.origen} → ${s.desti}`;
        directionSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error cargando sentidos AMB:', err);
    }
  } else if (source === 'SIS') {
    try {
      const selectedLineCode = lineId
      if (!selectedLineCode) return;

      let atmData = [];
      const response = await protectedFetch('/php/api/sis/endpoint.php');
      if (!response.ok) throw new Error('No se pudo cargar el JSON de ATM');
      atmData = await response.json();

      const selectedLine = atmData.find(line => line.lineCode === selectedLineCode);
      if (!selectedLine) return;

      // Poblar direcciones
      selectedLine.directions.forEach((dir, index) => {
        const option = document.createElement('option');
        option.value = index; // índice del array directions
        option.textContent = dir.flow;
        directionSelect.appendChild(option);
      });
    } catch (err) {
      console.error('Error carregant sentits de línies Soler i Sauret:', err);
    }
  } else if (source === 'MOV') {
    try {
      if (!lineId) return;

      const res = await protectedFetch(`/php/api/mov/endpoint.php?op=line&code=${lineId}`);
      const line = await res.json();

      // `Trayectos` trae los dos sentidos típicamente (ida/vuelta)
      directionSelect.innerHTML = '';
      const defaultDirOption = document.createElement('option');
      defaultDirOption.value = '';
      defaultDirOption.textContent = '-- Seleccioneu sentit al menú desplegable --';
      defaultDirOption.disabled = true;
      defaultDirOption.selected = true;
      directionSelect.appendChild(defaultDirOption);

      (line.Trayectos || []).forEach((t, idx) => {
        const opt = document.createElement('option');
        opt.value = idx; // índice del Trayecto
        opt.textContent = capitalizar(t.DESC_TRAYECTO) || t.DESC_REDUCIDA || `Sentit ${idx+1}`;
        directionSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Error carregant sentits en línies de MOVENTIS:', err);
    }

  } else if (source === 'CORB') {
    try {
      if (!lineId) return;

      const res = await protectedFetch(`/php/api/corb/trayectos/endpoint.php?linea=${encodeURIComponent(lineId)}`);
      const data = await res.json();
      const trayectos = data?.message || [];

      const lineObj = allLines.find(x => x.source === "CORB" && x.value === lineId);
      const longName = (lineObj?.desc || "").trim();

      // Partimos "Corbera - Barcelona" en ["Corbera","Barcelona"]
      const parts = longName.split("-").map(s => s.trim()).filter(Boolean);
      const A = parts[0] || "Sentit 1";
      const B = parts[1] || "Sentit 2";

      // Asegura default (ya lo pones arriba, pero por si reescribes)
      directionSelect.innerHTML = '';
      const defaultDirOption = document.createElement('option');
      defaultDirOption.value = '';
      defaultDirOption.textContent = '-- Seleccioneu sentit al menú desplegable --';
      defaultDirOption.disabled = true;
      defaultDirOption.selected = true;
      directionSelect.appendChild(defaultDirOption);

      trayectos.forEach(t => {
        const dirId = t.direction_id; // 0 o 1
        //const stops = t.paradas || [];
        //const first = stops[0]?.stop_name || 'Inici';
        //const last  = stops[stops.length - 1]?.stop_name || 'Final';

        const opt = document.createElement('option');
        opt.value = String(dirId);
        opt.textContent = (String(dirId) === "0") ? `${A} → ${B}` : `${B} → ${A}`;
        directionSelect.appendChild(opt);
      });

    } catch (err) {
      console.error("Error carregant sentits d'Autocorb:", err);
    }
  } else if (source === 'TGO') {
    try {
      if (!lineId) return;

      const today = new Date().toISOString().slice(0, 10);
      const res = await protectedFetch(
        `/php/api/tgo/directions/endpoint.php?routeId=${encodeURIComponent(lineId)}&date=${encodeURIComponent(today)}`
      );
      const data = await res.json();

      directionSelect.innerHTML = '';
      const defaultDirOption = document.createElement('option');
      defaultDirOption.value = '';
      defaultDirOption.textContent = '-- Seleccioneu sentit al menú desplegable --';
      defaultDirOption.disabled = true;
      defaultDirOption.selected = true;
      directionSelect.appendChild(defaultDirOption);

      (data.routeDirections || []).forEach(dir => {
        const opt = document.createElement('option');
        opt.value = String(dir.directionId);
        opt.textContent = dir.routeLongName || `${lineId} sentit ${dir.directionId}`;
        directionSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Error carregant sentits de TGO:", err);
    }
  } else if (source === 'SAG') {
    try {
      sagSelectedLineData = null;
      if (!lineId) return;

      const res = await protectedFetch(`/php/api/sag/line/endpoint.php?id=${encodeURIComponent(lineId)}`);
      const data = await res.json();

      if (!data?.success) {
        console.warn('Resposta invàlida de Sagalés');
        return;
      }

      directionSelect.innerHTML = '';
      const defaultDirOption = document.createElement('option');
      defaultDirOption.value = '';
      defaultDirOption.textContent = '-- Seleccioneu sentit al menú desplegable --';
      defaultDirOption.disabled = true;
      defaultDirOption.selected = true;
      directionSelect.appendChild(defaultDirOption);

      const lineMeta = data.line || {};
      const rawLongName = String(lineMeta.longName || '').trim();

      const cleanLongName = rawLongName
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const parts = cleanLongName
        .split(' - ')
        .map(s => s.trim())
        .filter(Boolean);

      const hasAnada = Array.isArray(data.anada?.stops) && data.anada.stops.length > 0;
      const hasTornada = Array.isArray(data.tornada?.stops) && data.tornada.stops.length > 0;
      const buildDirectionLabel = (segments) => segments.join(' → ');

      // Circular: solo existe anada
      if (hasAnada && !hasTornada) {
        const opt = document.createElement('option');
        opt.value = 'anada';
        opt.textContent = cleanLongName || 'Recorregut circular';
        directionSelect.appendChild(opt);
        return;
      }

      if (hasAnada) {
        const opt = document.createElement('option');
        opt.value = 'anada';
        opt.textContent = parts.length
          ? buildDirectionLabel(parts)
          : 'Anada';
        directionSelect.appendChild(opt);
      }

      if (hasTornada) {
        const opt = document.createElement('option');
        opt.value = 'tornada';
        opt.textContent = parts.length
          ? buildDirectionLabel([...parts].reverse())
          : 'Tornada';
        directionSelect.appendChild(opt);
      }

      sagSelectedLineData = data;

      if (!hasAnada && !hasTornada) {
        console.warn('No s’han trobat sentits per aquesta línia Sagalés');
      }

    } catch (err) {
      console.error('Error carregant sentits de Sagalés:', err);
    }
  } else if (source === 'MON') {
    try {
      monSelectedLineData = null; // Resetear estado en memoria anterior
      if (!lineId) return;

      // Petición al endpoint parametrizado con ?line=
      const res = await protectedFetch(`/php/api/mon/line/endpoint.php?line=${encodeURIComponent(lineId)}`);
      const data = await res.json();

      directionSelect.innerHTML = '';
      const defaultDirOption = document.createElement('option');
      defaultDirOption.value = '';
      defaultDirOption.textContent = '-- Seleccioneu sentit al menú desplegable --';
      defaultDirOption.disabled = true;
      defaultDirOption.selected = true;
      directionSelect.appendChild(defaultDirOption);

      // Poblamos las rutas/sentidos disponibles en el JSON de la línea
      if (data && data.routes) {
        data.routes.forEach(route => {
          const opt = document.createElement('option');
          opt.value = route.id; // Guardamos el ID real de la ruta (ej: 7225)
          opt.textContent = route.routeDescription || route.description || route.name;
          directionSelect.appendChild(opt);
        });
      }

      // Almacenamos el objeto completo de la línea en memoria para usarlo en el paso de las paradas
      monSelectedLineData = data;

    } catch (err) {
      console.error("Error carregant sentits de Monbus:", err);
    }
  } else {
    console.warn('Origen de línea desconegut');
  }
});

directionSelect.addEventListener('change', async () => {
  const selectedLineCode = lineSelect.value;
  const selectedDirection = directionSelect.value;

  if (selectedLineCode && selectedDirection) {
    loadStopsByDirection(selectedLineCode, selectedDirection);
  }
});

function getFolderName(code) {
  code = code.toString().trim().toUpperCase();

  // ===========================
  //  EXPRÉS: E o X sin más letras
  // ===========================
  if (/^[EX]\d+(\.\d+)?$/i.test(code)) return "E / X (Exprés)";

  //if (/^(E|X)\d+$/.test(code)) return "E / X (Exprés)";

  // ===========================
  //  B (todas las que empiezan por B)
  // ===========================
  if (/^B\d/.test(code)) return "B";

  // ===========================
  //  C (sin variantes raras)
  // ===========================
  if (/^C\d+(\.\d+)?$/i.test(code)) return "C";

  // ===========================
  //  D / H / V (sin variantes raras)
  //
  //  Validamos:
  //  - Empieza por D/H/V
  //  - Luego 1-2 números
  //  - Una letra final opcional
  //
  //  BLOQUEAMOS:
  //  - DAB12 (dos letras antes del número)
  //  - VB1 (V + letra antes de número)
  // ===========================
  if (/^[DHV]\d{1,2}[A-Z]?$/.test(code)) return "D / H / V (Nova Xarxa de Bus)";

  // ===========================
  //  L (sin variantes raras)
  //
  //  Acepta:
  //  - L12
  //  - L12M
  //
  //  Rechaza:
  //  - LB12 (local)
  //  - L7AB (local)
  // ===========================
  if (/^L\d{1,2}[A-Z]?$/.test(code)) return "L";

  // ===========================
  //  M — todas
  // ===========================
  if (/^M\d+$/.test(code)) return "M";

  // ===========================
  //  N — nocturnes
  // ===========================
  if (code.startsWith("N")) return "N (Nocturnes)";

  // ===========================
  //  ATM tipo A -> 201+ / A
  // ===========================
  if (/^A\d+$/.test(code)) return "A";

  // ===========================
  //  Números puros
  // ===========================
  if (/^\d+$/.test(code)) {
    const n = Number(code);

    if (n >=   1 && n <=  60) return "1 – 60";
    if (n >=  61 && n <= 100) return "61 – 100";
    if (n >= 101 && n <= 120) return "101 – 120";
    if (n >= 121 && n <= 140) return "121 – 140";
    if (n >= 141 && n <= 200) return "141 – 200";
    if (n >= 201)             return "201+";
  }

  // ===========================
  //  Todo lo demás → LOCAL
  // ===========================
  return "Autobusos locals";
}

async function loadStopsByDirection(lineCode, directionId) {
  //console.log('Sentido recibido en la función:', directionId);

  const TMBurl = `/php/api/tmb/v1/transit/linies/bus/linia/parades/endpoint.php?lineId=${lineCode}`;
  const AMBurl = `/php/api/tmb/v1/transit/core/linies/amb/linia/recs/elements/endpoint.php?lineId=${lineCode}`;
  const SISurl = '/php/api/sis/endpoint.php';
  const MOVurl = `/php/api/mov/endpoint.php?op=line&code=${lineCode}`;
  const TGOurl = `/php/api/tgo/directions/endpoint.php?routeId=${encodeURIComponent(lineCode)}`;
  const SAGurl = `/php/api/sag/line/endpoint.php?id=${encodeURIComponent(lineCode)}`;
  const MONurl = `/php/api/mon/line/endpoint.php?line=${lineCode}`;

  const source = lineSelect.selectedOptions[0]?.dataset.source;
  try {
    if (source === 'TMB') {
      try {
        const response = await protectedFetch(TMBurl);
        const data = await response.json();

        const stopSelect = document.getElementById('stopSelect');
        stopSelect.innerHTML = ''; // Limpia opciones anteriores

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        stopSelect.appendChild(defaultStopOption);

        const startStopOption = document.createElement('option');
        startStopOption.value = '';
        startStopOption.textContent = '-- Inici del recorregut --';
        startStopOption.disabled = true;
        startStopOption.selected = false;
        stopSelect.appendChild(startStopOption);

        const filteredStops = data.features
          .filter(f => f.properties.ID_SENTIT === parseInt(directionId))
          .sort((a, b) => a.properties.ORDRE - b.properties.ORDRE);

        if (filteredStops.length === 0) {
          const opt = document.createElement('option');
          opt.textContent = 'No hi ha parades en aquest sentit';
          opt.disabled = true;
          stopSelect.appendChild(opt);
          return;
        }

        filteredStops.forEach(stop => {
          const rawname = stop.properties.NOM_PARADA;
          const name = rawname.replace(/ - Final (de )?trajecte/, "");
          const opt = document.createElement('option');
          opt.value = stop.properties.CODI_PARADA;
          opt.textContent = `${name} (${stop.properties.CODI_PARADA})`;
          stopSelect.appendChild(opt);
        });

        const endStopOption = document.createElement('option');
        endStopOption.value = '';
        endStopOption.textContent = '-- Final del recorregut --';
        endStopOption.disabled = true;
        endStopOption.selected = false;
        stopSelect.appendChild(endStopOption);

        document.getElementById('stopSelect').addEventListener('change', function () {
          stopIdSelectedByUser = this.value;
        });
      } catch (error) {
        console.error("Error al carregar parades de la línia de TMB seleccionada")
      } 
    }
    else if (source === 'AMB') {
      try {
        const response = await protectedFetch(AMBurl);
        const data = await response.json();

        const stopSelect = document.getElementById('stopSelect');
        stopSelect.innerHTML = ''; // Limpia opciones anteriores

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        stopSelect.appendChild(defaultStopOption);

        const startStopOption = document.createElement('option');
        startStopOption.value = '';
        startStopOption.textContent = '-- Inici del recorregut --';
        startStopOption.disabled = true;
        stopSelect.appendChild(startStopOption);

        // Obtener todos los ID_TIPUS_DIA únicos
        const tipusDies = [...new Set(data.features.map(f => f.properties.ID_TIPUS_DIA))];

        // Determinar el ID_TIPUS_DIA más bajo disponible
        const minTipusDia = Math.min(...tipusDies);

        // Filtrar paradas por sentido
        const filteredStops = data.features
          .filter(h => h.properties.CODI_TRAJECTE.includes('-'))
          .filter(g => g.properties.ID_TIPUS_DIA === minTipusDia)
          .filter(f => f.properties.ID_SENTIT === parseInt(directionId))
          .sort((a, b) => a.properties.ORDRE - b.properties.ORDRE);

        if (filteredStops.length === 0) {
          const opt = document.createElement('option');
          opt.textContent = 'No hi ha parades en aquest sentit';
          opt.disabled = true;
          stopSelect.appendChild(opt);
          return;
        }

        filteredStops.forEach(stop => {
          const opt = document.createElement('option');
          opt.value = stop.properties.CODI_ELEMENT;
          opt.textContent = `${stop.properties.NOM_ELEMENT} (${stop.properties.CODI_ELEMENT})`;
          stopSelect.appendChild(opt);
        });

        const endStopOption = document.createElement('option');
        endStopOption.value = '';
        endStopOption.textContent = '-- Final del recorregut --';
        endStopOption.disabled = true;
        stopSelect.appendChild(endStopOption);

        document.getElementById('stopSelect').addEventListener('change', function () {
          stopIdSelectedByUser = this.value;
        });
      } catch (error) {
        console.error("Error al carregar parades de la línia de l'AMB seleccionada")
      }  
    }
    else if (source === 'SIS') {
      try {
        const response = await protectedFetch(SISurl);
        const atmData = await response.json();

        const ATMstopSelect = document.getElementById('stopSelect');
        ATMstopSelect.innerHTML = ''; // Limpia opciones anteriores

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        ATMstopSelect.appendChild(defaultStopOption);

        const startStopOption = document.createElement('option');
        startStopOption.value = '';
        startStopOption.textContent = '-- Inici del recorregut --';
        startStopOption.disabled = true;
        ATMstopSelect.appendChild(startStopOption);

        const selectedLineCode = lineCode;
        const directionIndex = directionId;
        if (!selectedLineCode || directionIndex === '') return;

        const selectedLine = atmData.find(line => line.lineCode === selectedLineCode);
        const direction = selectedLine?.directions?.[directionIndex];
        if (!direction) return;

        direction.stops.forEach(stop => {
          const opt = document.createElement('option');
          opt.value = stop.stopId;
          opt.textContent = stop.name;
          ATMstopSelect.appendChild(opt);
        });

        const endStopOption = document.createElement('option');
        endStopOption.value = '';
        endStopOption.textContent = '-- Final del recorregut --';
        endStopOption.disabled = true;
        ATMstopSelect.appendChild(endStopOption);

        document.getElementById('stopSelect').addEventListener('change', function () {
          const selectedStopId = this.value;

          // Buscar el nombre de la parada seleccionada en la dirección actual
          const selectedStop = direction.stops.find(stop => stop.stopId === selectedStopId);

          if (selectedStop) {
            // Guardas tanto el ID como el nombre
            ATMstopIdSelectedByUser = selectedStop.stopId;
            ATMstopName = selectedStop.name;
          }
        });
      } catch (error) {
        console.error("Error al carregar parades de la línia de l'ATM seleccionada")
      }
    } 
    else if (source === 'MOV') {
      try {
        const res = await protectedFetch(MOVurl);
        const line = await res.json();

        const stopSelect = document.getElementById('stopSelect');
        stopSelect.innerHTML = '';

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        stopSelect.appendChild(defaultStopOption);

        const trayecto = (line.Trayectos || [])[Number(directionId)];
        const det = trayecto?.TrayectosDet || [];

        det
          .slice()
          .sort((a,b) => (a.SECUENCIA ?? 0) - (b.SECUENCIA ?? 0))
          .forEach(item => {
            const p = item.Parada;
            if (!p) return;

            const stopCode = String(p.COD_PARADA);
            const stopName = p.DESC_PARADA || 'Parada';

            const opt = document.createElement('option');
            opt.value = stopCode;
            opt.textContent = `${stopName}`;
            opt.dataset.stopname = stopName;
            stopSelect.appendChild(opt);
          });

        stopSelect.addEventListener('change', function () {
          ATMstopIdSelectedByUser = this.value;
          // guarda nombre (igual que haces con ATM)
          const opt = this.selectedOptions?.[0];
          ATMstopName = opt?.dataset?.stopname || null;
        });

      } catch (err) {
        console.error("Error al carregar parades MOVENTIS:", err);
      }
    }
    else if (source === 'CORB') {
      try {
        const res = await protectedFetch(`/php/api/corb/trayectos/endpoint.php?linea=${encodeURIComponent(lineCode)}`);
        const data = await res.json();
        const trayectos = data?.message || [];

        const t = trayectos.find(x => String(x.direction_id) === String(directionId));
        const stops = (t?.paradas || []).slice().sort((a,b) => (a.stop_sequence ?? 0) - (b.stop_sequence ?? 0));

        const stopSelect = document.getElementById('stopSelect');
        stopSelect.innerHTML = '';

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        stopSelect.appendChild(defaultStopOption);

        const startStopOption = document.createElement('option');
        startStopOption.value = '';
        startStopOption.textContent = '-- Inici del recorregut --';
        startStopOption.disabled = true;
        stopSelect.appendChild(startStopOption);

        if (!stops.length) {
          const opt = document.createElement('option');
          opt.textContent = 'No hi ha parades en aquest sentit';
          opt.disabled = true;
          stopSelect.appendChild(opt);
          return;
        }

        stops.forEach(s => {
          const opt = document.createElement('option');
          opt.value = String(s.stop_id); // OJO: este es el código Autocorb (ej: 941)
          opt.textContent = s.stop_name;   // <- sin código visible
          opt.dataset.stopname = s.stop_name;
          stopSelect.appendChild(opt);
        });

        const endStopOption = document.createElement('option');
        endStopOption.value = '';
        endStopOption.textContent = '-- Final del recorregut --';
        endStopOption.disabled = true;
        stopSelect.appendChild(endStopOption);

        stopSelect.addEventListener('change', function () {
          CORBstopIdSelectedByUser = this.value; // <- aquí guardas el stop_id de Autocorb
          const opt = this.selectedOptions?.[0];
          CORBstopName = opt?.dataset?.stopname || null;
        });

      } catch (err) {
        console.error("Error al carregar parades d'Autocorb:", err);
      }
    } 
    else if (source === 'TGO') {
      try {
        const response = await protectedFetch(TGOurl);
        const data = await response.json();

        const stopSelect = document.getElementById('stopSelect');
        stopSelect.innerHTML = '';

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        stopSelect.appendChild(defaultStopOption);

        const startStopOption = document.createElement('option');
        startStopOption.value = '';
        startStopOption.textContent = '-- Inici del recorregut --';
        startStopOption.disabled = true;
        stopSelect.appendChild(startStopOption);

        const direction = (data.routeDirections || []).find(
          d => String(d.directionId) === String(directionId)
        );

        const stops = direction?.stops || [];

        if (!stops.length) {
          const opt = document.createElement('option');
          opt.textContent = 'No hi ha parades en aquest sentit';
          opt.disabled = true;
          stopSelect.appendChild(opt);
          return;
        }

        stops.forEach(stop => {
          const opt = document.createElement('option');
          opt.value = String(stop.stopId);
          opt.textContent = `${stop.stopName}`;
          opt.dataset.stopname = stop.stopName;
          stopSelect.appendChild(opt);
        });

        const endStopOption = document.createElement('option');
        endStopOption.value = '';
        endStopOption.textContent = '-- Final del recorregut --';
        endStopOption.disabled = true;
        stopSelect.appendChild(endStopOption);

        stopSelect.addEventListener('change', function () {
          TGOstopIdSelectedByUser = this.value;
          const opt = this.selectedOptions?.[0];
          TGOstopName = opt?.dataset?.stopname || null;
          currentTgoDirectionId = String(directionId);
          currentTgoLineId = String(lineCode);
        });

      } catch (err) {
        console.error("Error al carregar parades TGO:", err);
      }
    }
    else if (source === 'SAG') {
      try {
        const response = await protectedFetch(SAGurl);
        const data = await response.json();

        console.log(data)
        const stopSelect = document.getElementById('stopSelect');
        stopSelect.innerHTML = '';

        const defaultStopOption = document.createElement('option');
        defaultStopOption.value = '';
        defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
        defaultStopOption.disabled = true;
        defaultStopOption.selected = true;
        stopSelect.appendChild(defaultStopOption);

        const startStopOption = document.createElement('option');
        startStopOption.value = '';
        startStopOption.textContent = '-- Inici del recorregut --';
        startStopOption.disabled = true;
        stopSelect.appendChild(startStopOption);

        const directionData = data[directionId] || null;
        const stops = directionData?.stops || [];

        stops.forEach(stop => {
          const opt = document.createElement('option');
          opt.value = String(stop.stopCode);
          opt.textContent = `${stop.name}`;
          opt.dataset.stopname = stop.name || '';
          opt.dataset.stopcode = String(stop.stopCode || '');
          stopSelect.appendChild(opt);
        });

        const endStopOption = document.createElement('option');
        endStopOption.value = '';
        endStopOption.textContent = '-- Final del recorregut --';
        endStopOption.disabled = true;
        stopSelect.appendChild(endStopOption);

        stopSelect.addEventListener('change', function () {
          SAGstopIdSelectedByUser = this.value;
          const opt = this.selectedOptions?.[0];
          SAGstopName = opt?.dataset?.stopname || null;
          currentSAGDirectionId = String(directionId);
          currentSAGLineId = String(lineCode);
        });

      } catch (err) {
        console.error("Error al carregar parades SAG:", err);
      }
    } else if (source === 'MON') {
      const stopSelect = document.getElementById('stopSelect');
      stopSelect.innerHTML = ''; // Limpia opciones anteriores

      const defaultStopOption = document.createElement('option');
      defaultStopOption.value = '';
      defaultStopOption.textContent = '-- Seleccioneu parada al menú desplegable --';
      defaultStopOption.disabled = true;
      defaultStopOption.selected = true;
      stopSelect.appendChild(defaultStopOption);

      if (monSelectedLineData && monSelectedLineData.routes) {
        // Buscamos la ruta que coincide con el directionId (routeId) seleccionado
        const selectedRoute = monSelectedLineData.routes.find(r => r.id == directionId);

        if (selectedRoute && selectedRoute.stops) {
          // Ordenamos las paradas por la secuencia del trayecto original
          const sortedStops = [...selectedRoute.stops].sort((a, b) => a.stopSequence - b.stopSequence);

          sortedStops.forEach(stop => {
            const opt = document.createElement('option');
            opt.value = stop.code;
            opt.textContent = stop.name;
            stopSelect.appendChild(opt);
          });
          stopSelect.addEventListener('change', function () {
          MONstopIdSelectedByUser = this.value;
          MONstopName = stopSelect.selectedOptions[0]?.text || null;
        });
        }
      }
    }
  } catch (error) {
    console.error('Error al carregar parades:', error);
  }
}

document.getElementById('loadSelectedStopBtn').addEventListener('click', loadStopSelected);

function loadStopSelected() {
//  stopIdSelectedByUser = document.getElementById('stopIdSelectedByUser').value.trim();
  if (stopIdSelectedByUser) {
    currentStopId = stopIdSelectedByUser;
    stopId = stopIdSelectedByUser;
    loadArrivals(stopId);
  }
  else if (ATMstopIdSelectedByUser) {
    currentAtmStopId = ATMstopIdSelectedByUser;
    handleStopSelection(ATMstopIdSelectedByUser, ATMstopName)
  }
  else if (CORBstopIdSelectedByUser) {
    currentCorbStopId = CORBstopIdSelectedByUser;
    handleCorbStopSelection(CORBstopIdSelectedByUser, CORBstopName);
  }
  else if (TGOstopIdSelectedByUser) {
    currentTgoStopId = TGOstopIdSelectedByUser;
    handleTgoStopSelection(TGOstopIdSelectedByUser, TGOstopName, currentTgoDirectionId);
  }
  else if (SAGstopIdSelectedByUser) {
    currentSagStopId = SAGstopIdSelectedByUser;
    handleSagStopSelection(SAGstopIdSelectedByUser, SAGstopName, currentSagDirectionId);
  }
  else if (MONstopIdSelectedByUser) {
    currentMonStopId = MONstopIdSelectedByUser;
    handleMonStopSelection(MONstopIdSelectedByUser, MONstopName);
  }
  else alert("Seleccioni primer una parada amb els desplegables per poder carregar la seva informació.")
}

// Carrega els temps d'espera de la parada desitjada
async function loadArrivals(stopId) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;
  busItems = [];

  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';
  currentStopId = stopId;

  const isTMB = stopId.length <= 4;
  let stopDescr = null;

  try {
    await loadTmbLineCodes();
    if (isTMB) {
      // Fetch TMB
      const url = `/php/api/tmb/v1/ibus/extended/parada/endpoint.php?stopId=${stopId}`;
      const resTMB = await protectedFetch(url);
      if (!resTMB.ok) throw new Error('Error TMB');
      const dataTMB = await resTMB.json();

      const buses = dataTMB.data.timePredictionByStop.llistaTimePredictions;
      stopDescr = dataTMB.data.timePredictionByStop.stopDescr;

      if (buses?.length) {
        buses
        .filter(bus => bus.arrivalSeconds <= maxSeconds)
        .filter(bus => tmbLineCodes.has(bus.commercialLine))
        .forEach(bus => {
          const lineMapping = {
            'H44': 'X2',
            'V45': 'X3',
          };
          const destMapping = {
            'Ciutat de la Justíci': 'Ciutat de la Justícia',
            'La Marina del Prat V': 'La Marina del Prat Vermell',
            'Districte Gran Via l': 'Districte Gran Via de l\'Hospitalet',
            'Torre Baró-Ciutat Me': 'Torre Baró-Ciutat Meridiana',
            'null': 'Sense servei',
          }
          const displayLine = lineMapping[bus.commercialLine] ?? bus.commercialLine;
          const min = bus.arrivalTime ?? Math.floor(bus.arrivalSeconds / 60);
          //const destinacio = bus.destinacio ?? 'Sense servei';
          const destinacio = destMapping[bus.destinacio] ?? bus.destinacio;
          const plateStr = bus.plate ? `Matrícula: ${bus.plate}` : '';
          const typeText = getVehicleType(bus.parts); // Obtenim el text: "Articulat", etc.
          const typeStr = typeText ? ` | ${typeText}` : ''; // Si existeix, l'afegim
          busItems.push(`
            <li class="BusTMB">
              <div class="barra-izquierda ${getTmbLineClass(displayLine)}"></div>
              <div class="contenido-bus-TMB">
                <strong>Línia ${displayLine} (TMB)</strong> → ${destinacio}<br>
                ⏱ ${min} (${bus.arrivalSeconds}s)<br>
                🚌 Calca: ${bus.busNumber ?? '—'} | Torn: ${bus.turnCode ?? '—'}<br>
                ${plateStr}${typeStr}
                </div>
            </li>
          `);
        });
      }
    }

    // Fetch AMB
    const resAMB = await protectedFetch(`/php/api/amb/v2/bus/stops/parada/realtimes/endpoint.php?stopId=${stopId}`, {
    });
    const ambStopName = await protectedFetch(`php/api/amb/v2/bus/stops/parada/endpoint.php?stopId=${stopId}`, {
    });
    if (!resAMB.ok) throw new Error('Error AMB');

    const dataAMB = await resAMB.json();
    const nameStopAmb = await ambStopName.json();
    const busesAMB = dataAMB.times;
    let onlyAmbStopName;
    if (nameStopAmb && nameStopAmb.document && nameStopAmb.document.name && nameStopAmb.document.name.trim() !== 'undefined') {
      onlyAmbStopName = nameStopAmb.document.name;
    } else {
      onlyAmbStopName = stopDescr;
    }

    if (nameStopAmb.status === 404) {
      results.innerHTML = `<li>⚠️ La parada <strong>${stopId}</strong> no existeix. Comprova el codi i torna-ho a intentar.</li>`;

      const resultsList = document.getElementById('results');
      resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

      currentStopId = stopId;
      currentAtmStopId = null;
      currentCorbStopId = null;
      currentTgoStopId = null;
      currentSagStopId = null;
      currentTusStopId = null;
      currentMonStopId = null;

      isLoadingStopInfo = false;
      return;
    }

    const ambBusesFiltered = dataAMB.times
    .filter(bus =>
      !tmbLineCodes.has(bus.lineCode)
    )
    .filter(bus =>
      !excludedLineCodes.has(bus.lineCode)
    );

    if (busesAMB?.length) {
      ambBusesFiltered
      .filter(bus => bus.arrivalTime <= maxSeconds)
      .sort((a, b) => new Intl.Collator(undefined, { numeric: true }).compare(a.lineCode, b.lineCode))
      .forEach(bus => {
        const min = Math.floor(bus.arrivalTime / 60);
        const timeLabel = min > 0 ? `${min} min` : 'imminent';
        const plateStr = bus.plate ? `Matrícula: ${bus.plate}` : '';
        const typeText = getVehicleType(bus.parts); // Obtenim el text: "Articulat", etc.
        const typeStr = typeText ? ` | ${typeText}` : ''; // Si existeix, l'afegim
        busItems.push(`
          <li class="BusAMB">
            <div class="barra-izquierda ${getAmbLineClass(bus.lineCode)}"></div>
            <div class="contenido-bus-AMB">
              <strong>Línia ${bus.lineCode} (AMB)</strong> → ${bus.destination}<br>
              ⏱ ${timeLabel} (${bus.arrivalTime}s)<br>
              ${bus.latitude && bus.longitude
                ? `<a href="#" class="view-location" data-lat="${bus.latitude}" data-lon="${bus.longitude}" data-line="${bus.lineCode}" data-destination="${bus.destination}">📍 Veure geolocalització</a>`
                : '📍 No hi ha geolocalització disponible'}<br>
              🚌 Nº del vehicle: ${bus.vehicleCode}<br>
              ${plateStr}${typeStr}
            </div>
          </li>
        `);
      });
    }

    let atmCode;
    let corbCode;
    let tgoCode;
    let sagCode;
    let monCode;

    const ambCode = nameStopAmb?.document?.codAMB;
    const matchjson = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?AMBstopId=${ambCode}`);
    const match = await matchjson.json();

    if (match.ATMstopId) {
      atmCode = match.ATMstopId
    }
    if (match.CORBstopId) {
      corbCode = match.CORBstopId
    }
    if (match.TGOstopId) {
      tgoCode = match.TGOstopId
    }
    if (match.SAGstopId) {
      sagCode = match.SAGstopId
    }
    if (match.MONstopId) {
      monCode = match.MONstopId
    }

    if (atmCode) {
      await renderATMbuses(atmCode);
    }
    if (corbCode) {
      await renderCORBbuses(corbCode);
    }
    if (tgoCode) {
      await renderTGObuses(tgoCode);
    }
    if (sagCode) {
      await renderSAGbuses(sagCode);
    }
    if (monCode) {
      await renderMONbuses(monCode);
    }

    results.innerHTML = `<h3>Parada: ${stopDescr} (${stopId})</h3>`;
    results.innerHTML = `<h3>Parada: ${onlyAmbStopName} (${stopId})</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    document.getElementById('reloadBtn').disabled = false;

  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }
  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = stopId;
  currentAtmStopId = null;
  currentCorbStopId = null;
  currentTgoStopId = null;
  currentSagStopId = null;
  currentTusStopId = null;
  currentMonStopId = null;

  isLoadingStopInfo = false;
}

async function renderATMbuses (ATMcode) {
  try {
    const resATM = await protectedFetch(`/php/api/atm/realtimes/endpoint.php?ATMstopId=${ATMcode}`);
    if (resATM.ok) {
      atmBuses = await resATM.json();
      sisAtmBuses = atmBuses.filter(bus => sisAtmLines.has(bus.line))
      movAtmBuses = atmBuses.filter(bus => movAtmLines.has(bus.line))
    }
  } catch (e) {
    console.warn("Error en obtenir dades de l'ATM:", e);
  }
  if (sisAtmBuses?.length) {
    sisAtmBuses
    .filter(bus => bus.seconds <= maxSeconds)
    .sort((a, b) => new Intl.Collator(undefined, { numeric: true }).compare(a.line, b.line))
    .forEach(bus => {
      const seconds = bus.seconds;
      const min = Math.floor(seconds / 60);
      const timeLabel = min > 0 ? `${min} min` : 'imminent';
      busItems.push(`
        <li class="BusATM">
          <div class="barra-izquierda linea-verde-oscuro"></div>
          <div class="contenido-bus-ATM">
            <strong>Línia ${bus.line} (Soler i Sauret ATM)</strong> → ${bus.destination}<br>
            ⏱ ${timeLabel} (${bus.seconds}s)<br>
            ${bus.latitude && bus.longitude
              ? `<a href="#" class="view-location" data-lat="${bus.latitude}" data-lon="${bus.longitude}" data-line="${bus.line}" data-destination="${bus.destination}">📍 Veure geolocalització</a>`
              : '📍 No hi ha geolocalització disponible'}<br>
            🚌 Nº del vehicle: ${bus.vehicleId}
          </div>
        </li>
      `);
    });
  }
  if (movAtmBuses?.length) {
    movAtmBuses
    .filter(bus => bus.seconds <= maxSeconds)
    .sort((a, b) => new Intl.Collator(undefined, { numeric: true }).compare(a.line, b.line))
    .forEach(bus => {
      const seconds = bus.seconds;
      const min = Math.floor(seconds / 60);
      const timeLabel = min > 0 ? `${min} min` : 'imminent';
      busItems.push(`
        <li class="BusATM">
          <div class="barra-izquierda linea-naranja"></div>
          <div class="contenido-bus-MOV">
            <strong>Línia ${bus.line} (Moventis ATM)</strong> → ${bus.destination}<br>
            ⏱ ${timeLabel} (${bus.seconds}s)<br>
            ${bus.latitude && bus.longitude
              ? `<a href="#" class="view-location" data-lat="${bus.latitude}" data-lon="${bus.longitude}" data-line="${bus.line}" data-destination="${bus.destination}">📍 Veure geolocalització</a>`
              : '📍 No hi ha geolocalització disponible'}<br>
            🚌 Nº del vehicle: ${bus.vehicleId}
          </div>
        </li>
      `);
    });
  }
  return;
}

async function renderCORBbuses(corbStopId) {
  // Endpoint propio (proxy PHP) para Autocorb
  const res = await protectedFetch(`/php/api/corb/rtpi/endpoint.php?parada=${encodeURIComponent(corbStopId)}`);
  if (!res.ok) return;

  const data = await res.json();
  // data esperado: { success: true, message: [ ... ] }
  const items = (data && data.success && Array.isArray(data.message)) ? data.message : [];
  if (!items.length) return;

  // --- Enriquecimiento CORB: matrícula + geo con fallback por vehicle_id
  let corbBusesIndex = new Map(); // key: `${route_id}|${direction_id}|${id_vehicle}` -> bus
  let corbGlobalFetchOkByCombo = new Map(); // key: `${route_id}|${direction_id}` -> true/false

  // Helper: carga buses por combo (global o por vehículo)
  async function loadCorbBuses(routeId, directionId, vehicleId = '') {
    const resB = await protectedFetch(
      `/php/api/corb/buses/endpoint.php?route_id=${encodeURIComponent(routeId)}&direction_id=${encodeURIComponent(directionId)}&vehicle_id=${encodeURIComponent(vehicleId)}`
    );
    if (!resB.ok) return null;

    const dataB = await resB.json();
    const buses = (dataB && dataB.success && Array.isArray(dataB.message)) ? dataB.message : null;
    return buses;
  }

  try {
    const combos = new Set(items.map(it => `${it.route_id}|${it.direction_id}`));

    await Promise.all([...combos].map(async key => {
      const [routeId, directionId] = key.split('|');

      const buses = await loadCorbBuses(routeId, directionId, ''); // global
      const ok = Array.isArray(buses) && buses.length > 0; // <- si viene vacío, lo tratamos como fallo

      corbGlobalFetchOkByCombo.set(key, ok);

      if (!ok) return;

      buses.forEach(b => {
        const k = `${routeId}|${directionId}|${String(b.id_vehicle ?? '')}`;
        corbBusesIndex.set(k, b);
      });
    }));
  } catch (e) {
    console.warn("CORB: error global buses:", e);
    
    // IMPORTANTE: si el global revienta, habilitamos fallback para TODOS los combos detectados
    const combos = new Set(items.map(it => `${it.route_id}|${it.direction_id}`));
    combos.forEach(k => corbGlobalFetchOkByCombo.set(k, false));
  }
  const list = items
  .map(it => {
    let secs;
    if ((it.timetabletype || "").toLowerCase() === "real") {
      secs = Math.round(Number(it.tiempo_real) * 60);
    } else if ((it.timetabletype || "").toLowerCase() === "htll") {
      secs = Math.round(Number(it.tiempo_htll) * 60);
    } else {
      secs = Math.round(Number(it.tiempo_aproximado) * 60);
    }
    return { ...it, _seconds: Number.isFinite(secs) ? secs : null };
  })
  .filter(it => it._seconds !== null && it._seconds <= maxSeconds)
  .sort((a, b) => a._seconds - b._seconds);

  // OJO: aquí sí podemos hacer await dentro
  for (const it of list) {
    const routeId = it.route_id;
    const dirId = String(it.direction_id ?? '');
    const vehId = String(it.id_vehicle ?? '');

    const comboKey = `${routeId}|${dirId}`;
    const matchKey = `${routeId}|${dirId}|${vehId}`;

    let veh = corbBusesIndex.get(matchKey);

    // Fallback si global ha fallado o no tenemos ese bus
    if (!corbGlobalFetchOkByCombo.has(comboKey)) corbGlobalFetchOkByCombo.set(comboKey, false);
    const globalOk = corbGlobalFetchOkByCombo.get(comboKey);
    if (!veh && vehId && (globalOk === false || globalOk === true)) {
      try {
        const busesOne = await loadCorbBuses(routeId, dirId, vehId);
        if (Array.isArray(busesOne) && busesOne.length) {
          veh = busesOne[0];
          if (veh?.id_vehicle) corbBusesIndex.set(matchKey, veh);
        }
      } catch (e) {
        console.warn("CORB: fallback vehicle_id error:", e);
      }
    }

    const lat = veh?.latitude_mdeg ? Number(veh.latitude_mdeg) : null;
    const lon = veh?.longitude_mdeg ? Number(veh.longitude_mdeg) : null;
    const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
    const plate = veh?.matricula ? String(veh.matricula) : null;

    const min = Math.floor(it._seconds / 60);
    const timeLabel = min > 0 ? `${min} min` : 'imminent';

    const occ = (typeof it.occupation_percentage === "number")
      ? `🧍 Ocupació: ${it.occupation_percentage}% (nivell ${it.occupation_level})`
      : "";

    busItems.push(`
      <li class="BusCORB">
        <div class="barra-izquierda linea-azul-muy-oscuro"></div>
        <div class="contenido-bus-CORB">
          <strong>Línia ${it.route_id} (Autocorb)</strong> → ${it.stop_headsign || ""}<br>
          ⏱ ${timeLabel} (${it._seconds}s)<br>

          ${hasGeo
            ? `<a href="#" class="view-location" data-lat="${lat}" data-lon="${lon}" data-line="${it.route_id}" data-destination="${it.stop_headsign || ''}">📍 Veure geolocalització</a>`
            : '📍 No hi ha geolocalització disponible'}<br>

          🚌 Nº del vehicle: ${vehId || "?"}${plate ? ` — Matrícula: ${plate}` : ""}<br>
          ${occ ? occ + "<br>" : ""}
        </div>
      </li>
    `);
  }
}

async function renderTGObuses(stopId, directionId) {
  const date = new Date().toISOString().slice(0, 10);
  const url = `/php/api/tgo/arrivals/endpoint.php?stopId=${encodeURIComponent(stopId)}&directionId=${encodeURIComponent(directionId)}&date=${encodeURIComponent(date)}`;

  //console.log(`TGO direction ID: `, directionId);
  if (directionId != 0 && directionId != 1) {
    await renderTGObuses(stopId, 0);
    await renderTGObuses(stopId, 1);
    return;
  }
  const res = await protectedFetch(url);
  if (!res.ok) throw new Error('Error obtenint arribades de TGO');

  const data = await res.json();
  const arrivals = Array.isArray(data) ? data : [];

  arrivals
    .filter(it => typeof it.arrivalTimeMinutes === 'number')
    .filter(it => it.arrivalTimeMinutes * 60 <= maxSeconds)
    .sort((a, b) => (a.arrivalTimeMinutes ?? 9999) - (b.arrivalTimeMinutes ?? 9999))
    .forEach(it => {
      const min = it.arrivalTimeMinutes;
      const timeLabel = min > 0 ? `${min} min` : 'imminent';

      const lat = Number(it.lat);
      const lon = Number(it.lon);
      const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);

      const vehicleId = it.vehicleId || 'Desconegut';
      const lineCode = it.route?.routeShortName || it.route?.routeId || '?';
      const destination = it.tripHeadsign || '';

      busItems.push(`
        <li class="BusTGO">
          <div class="barra-izquierda linea-gris"></div>
          <div class="contenido-bus-TGO">
            <strong>Línia ${lineCode} (TGO)</strong> → ${destination}<br>
            ⏱ ${timeLabel}<br>
            ${
              hasGeo
                ? `<a href="#" class="view-location" data-lat="${lat}" data-lon="${lon}" data-line="${lineCode}" data-destination="${destination}">📍 Veure geolocalització</a>`
                : '📍 No hi ha geolocalització disponible'
            }<br>
            🚌 Nº del vehicle: ${vehicleId}
          </div>
        </li>
      `);
    });
}

async function renderSAGbuses(stopId) {
  const url = `/php/api/sag/realtime/endpoint.php?stop=${stopId}`;

  const res = await protectedFetch(url);
  if (!res.ok) throw new Error('Error obtenint arribades de SAG');

  const data = await res.json();
  const arrivals = data.arrivals || [];

    arrivals
      .filter (bus => Math.floor(bus.arrivalTime - Date.now()/1000) <= maxSeconds)
      .forEach(bus => {

      const seconds = Math.floor(bus.arrivalTime - Date.now()/1000);
      const minutes = Math.round((bus.arrivalTime - Date.now()/1000) / 60);
      const timeLabel = minutes > 0 ? `${minutes} min` : 'imminent';

      const hasRawLat = bus.lat !== null && bus.lat !== undefined && bus.lat !== '';
      const hasRawLon = bus.lon !== null && bus.lon !== undefined && bus.lon !== '';

      const lat = hasRawLat ? Number(bus.lat) : NaN;
      const lon = hasRawLon ? Number(bus.lon) : NaN;

      const vehicleId = bus.vehicleId || 'Desconegut';
      const hasGeo = Number.isFinite(lat) && Number.isFinite(lon);
      const lineCode = bus.routeShortName;
      const destination = bus.headSign;

      busItems.push(`
        <li class="BusSAG">
          <div class="barra-izquierda linea-azul-verdoso"></div>
          <div class="contenido-bus-SAG">
            <strong>Línia ${lineCode} (SAG)</strong> → ${destination}<br>
            ⏱ ${timeLabel} (${seconds}s)<br>
            ${
              hasGeo
                ? `<a href="#" class="view-location" data-lat="${lat}" data-lon="${lon}" data-line="${lineCode}" data-destination="${destination}">📍 Veure geolocalització</a>`
                : '📍 No hi ha geolocalització disponible'
            }<br>
            🚌 Nº del vehicle: ${vehicleId}
          </div>
        </li>
      `);
    });
}

async function renderTUSbuses(stopId) {
  const url = `/php/api/tus/realtime/endpoint.php?stop=${stopId}`;

  const res = await protectedFetch(url);
  if (!res.ok) throw new Error('Error obtenint arribades de TUS');

  const data = await res.json();
  const departures = data.departureTimes || [];

  if (departures.length === 0) {
    results.innerHTML = `<h3>Parada: ${TUSstopName}</h3><li>No hi ha autobusos online propers.</li>`;
    return;
  }

  departures.forEach(bus => {
    // Calculem temps restant (min:seg)
    let timeLabel;
    if (bus.roundedDepartureTime === 'Now') {
      timeLabel = 'imminent';
    } else {
      timeLabel = bus.roundedDepartureTime;
    }
    const seconds = bus.departureTime;
    
    // Calculem retard (positiu és retard, negatiu és avançament)
    const delayStatus = bus.delay >= 0 ? 'Retard' : 'Avançament';
    const delayTime = Math.abs(bus.delay);

    const mins = Math.floor(delayTime / 60);
    const secs = Math.abs(delayTime % 60);
    const delayLabel = `${mins}min ${secs < 10 ? '0' : ''}${secs}s`;

    busItems.push(`
      <li class="BusTUS">
        <div class="barra-izquierda linea-verde-palido"></div>
        <div class="contenido-bus-TUS">
          <strong>Línia ${bus.lineName} (TUS)</strong> → ${bus.routeDest}<br>
          ⏱ ${timeLabel} (${seconds}s) | ⏱️ ${delayStatus}: ${delayLabel} (${delayTime}s)<br>
          🚌 Bus: ${bus.vehicleCode}
        </div>
      </li>
    `);
  });

  results.innerHTML = `<h3>Parada: ${TUSstopName}</h3>` + busItems.join('');
  document.getElementById('reloadBtn').disabled = false;
}

async function renderMONbuses(stopId) {
  const url = `/php/api/mon/realtime/endpoint.php?stop=${stopId}`;

  const res = await protectedFetch(url);
  if (!res.ok) throw new Error('Error obtenint arribades de MON');

  const data = await res.json();
  const rawDepartures = data.departureTimes || [];

  if (rawDepartures.length === 0) {
    results.innerHTML = `<h3>Parada: ${MONstopName}</h3><li>No hi ha autobusos propers.</li>`;
    return;
  }
  const monAtmLines = ['e5', 'e22', 'e23', 'e24', 'e25']
  const departures = rawDepartures.filter(bus => monAtmLines.includes(bus.lineCode))

  departures.forEach(bus => {
    // Calculem temps restant (min:seg)
    let timeLabel;
    if (bus.roundedDepartureTime === 'Now') {
      timeLabel = 'imminent';
    } else {
      timeLabel = bus.roundedDepartureTime;
    }
    const seconds = bus.departureTime;
    
    // Calculem retard (positiu és retard, negatiu és avançament)
    const delayStamon = bus.delay >= 0 ? 'Retard' : 'Avançament';
    const delayTime = Math.abs(bus.delay);

    const mins = Math.floor(delayTime / 60);
    const secs = Math.abs(delayTime % 60);
    const delayLabel = `${mins}min ${secs < 10 ? '0' : ''}${secs}s`;

    busItems.push(`
      <li class="BusMON">
        <div class="barra-izquierda linea-negra"></div>
        <div class="contenido-bus-MON">
          <strong>Línia ${bus.lineCode} (MON)</strong> → ${bus.routeDest}<br>
          ⏱ ${timeLabel} (${seconds}s) | ⏱️ ${delayStamon}: ${delayLabel} (${delayTime}s)<br>
          🚌 Bus: ${bus.vehicleCode}
        </div>
      </li>
    `);
  });

  results.innerHTML = `<h3>Parada: ${MONstopName}</h3>` + busItems.join('');
  document.getElementById('reloadBtn').disabled = false;
}

document.addEventListener('click', function (event) {
  if (event.target.matches('.view-location')) {
    event.preventDefault();

    const lat = parseFloat(event.target.dataset.lat);
    const lon = parseFloat(event.target.dataset.lon);
    const line = event.target.dataset.line;
    const destination = event.target.dataset.destination;

    // Mostrar el contenedor
    const mapDiv = document.getElementById('geoBusMap');
    mapDiv.style.display = 'block';
    //mapDiv.innerHTML = ''; // Resetear mapa anterior

    // Inicializar el mapa

    if (!window.busMap) {
      window.busMap = L.map('geoBusMap').setView([lat, lon], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(window.busMap);
    
      /*window.busTiles = L.tileLayer(
        `https://api.maptiler.com/maps/streets/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 20,
          crossOrigin: true,
          attribution:
            '&copy; OpenStreetMap contributors &copy; MapTiler'
        }
      ).addTo(window.busMap);*/
    } else {
      window.busMap.setView([lat, lon], 15);
    }

    // 🔴 MUY IMPORTANTE: el mapa estaba oculto → recalcular tamaño
    setTimeout(() => {
      window.busMap.invalidateSize();
    }, 100);

    // Quitar marcador anterior
    if (window.busMarker) {
      window.busMap.removeLayer(window.busMarker);
    }

    // Añadir marcador
    window.busMarker = L.marker([lat, lon])
      .addTo(window.busMap)
      .bindPopup(`<strong>Línia ${line}</strong><br>Destinació: ${destination}`)
      .openPopup();
  }
});

function clearMarkers() {
  stopMarkers.forEach(m => map.removeLayer(m));
  stopMarkers = [];
}

loadLines();
document.getElementById('lookupBtn').addEventListener('click', manualLookup);


function manualLookup() {
  stopId = document.getElementById('stopIdInput').value.trim();
  if (stopId) {
    if (!isValidStopId(stopId)) {
      alert("El codi de parada introduit és invàlid.")
      return;
    }
    const button = document.getElementById('lookupBtn');
    const originalText = button.textContent;
    button.textContent = 'Carregant...';
    currentStopId = stopId;
    loadArrivals(stopId);
    button.textContent = originalText;
  }
  else alert("Escrigui un codi de parada per poder carregar la seva informació.")
}

function isValidStopId(stopId) {
  return /^(?:[0-9][0-9]{0,3}|[1-9][0-9]{5})$/.test(stopId);
}

document.getElementById('reloadBtn').addEventListener('click', () => {
  console.log(ATMstopName)
  const line = document.getElementById('lineSelect').value;
  const direction = document.getElementById('directionSelect').value;
  const stop = document.getElementById('stopSelect').value;
  const manualStop = document.getElementById('stopId')?.value?.trim();

  const mapDiv = document.getElementById('geoBusMap');
  mapDiv.style.display = 'none';

  const reloadBtn = document.getElementById('reloadBtn');
  reloadBtn.disabled = true;
  reloadBtn.textContent = '⏳ Carregant...';

  // Caso 1: Selección por código de parada manual
    if (currentMonStopId) {
    loadMonArrivals(currentMonStopId, MONstopName).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  if (currentTusStopId) {
    loadTusArrivals(currentTusStopId, TUSstopName).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  if (currentSagStopId) {
    loadSagArrivals(currentSagStopId, SAGstopName).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  if (currentTgoStopId) {
    loadTgoArrivals(currentTgoStopId, TGOstopName).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  if (currentCorbStopId) {
    loadCorbArrivals(currentCorbStopId, CORBstopName).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  if (currentAtmStopId) {
    handleStopSelection(currentAtmStopId, ATMstopName).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  if (currentStopId) {
    loadArrivals(currentStopId).finally(() => {
      reloadBtn.disabled = false;
      reloadBtn.textContent = 'Recarregar dades';
    });
    return;
  }

  // Caso 2: Selección mediante selectores
  try {
    if (line) {
      document.getElementById('lineSelect').value = line;
      if (direction) {
        document.getElementById('directionSelect').value = direction;
        return loadStopsByDirection(line, direction).then(() => {
          if (stop) {
            document.getElementById('stopSelect').value = stop;
            const source = document.getElementById('lineSelect').selectedOptions[0]?.dataset.source;
            if (source === 'TMB' || source === 'AMB') {
              return loadArrivals(stop);
            } else if (source === 'SIS' || source === 'MOV') {
              return handleStopSelection(stop, ATMstopName);
            } else if (source === 'CORB') {
              return handleCorbStopSelection(stop, CORBstopName);
            } else if (source === 'TGO') {
              return handleTgoStopSelection(stop, TGOstopName);
            } else if (source === 'SAG') {
              return handleSagStopSelection(stop, SAGstopName);
            } else if (source === 'MON') {
              return handleMonStopSelection(stop, MONstopName);
            }
          }
        });
      }
    }
  } catch (err) {
    console.error("Error recargando datos:", err);
  } finally {
    reloadBtn.disabled = false;
    reloadBtn.textContent = 'Recarregar dades';
  };
});

async function fetchAMB(stopId) {
  const url = `/api/v2/bus/stops/parada/realtimes?stopId=${stopId}`;

  const res = await protectedFetch(url, {
    headers: {
    }
  });

  if (!res.ok) {
    throw new Error('Error accedint a l’API d’AMB');
  }

  const data = await res.json();
  return ['AMB', data];
}

function getTmbLineClass(lineCode) {
  if (/^H/.test(lineCode)) return 'linea-azul-oscuro';
  if (/^V/.test(lineCode)) return 'linea-verde';
  if (/^D/.test(lineCode)) return 'linea-lila';
  if (/^X/.test(lineCode)) return 'linea-negra';
  if (/^N/.test(lineCode)) return 'linea-azul-palido';
  return 'linea-roja';
}

function getAmbLineClass(lineCode) {
  if (/^N/.test(lineCode)) return 'linea-azul-palido';
  return 'linea-amarilla';
}

async function handleStopSelection(atmStopId, ATMstopName) {
  try {
    // 1️⃣ Consultamos si existe una parada AMB asociada
    const res = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?ATMstopId=${atmStopId}`);
    const data = await res.json();

    // 2️⃣ Si hay parada AMB asociada, consultamos sus tiempos
    if (data.found && data.AMBstopId) {
      if (data.AMBstopId) {
      data.AMBstopId = data.AMBstopId.replace(/^0+/, '');
      }
      loadArrivals(data.AMBstopId);
    } else {

    // 3️⃣ Si no es el caso, consultamos solo los tiempos de ATM
    loadAtmArrivals(atmStopId, ATMstopName);

    }

  } catch (err) {
    console.error("Error al buscar correspondencia AMB:", err);
  }
}

async function handleCorbStopSelection(corbStopId, corbStopName) {
  try {
    const res = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?CORBstopId=${encodeURIComponent(corbStopId)}`);
    const data = await res.json();

    if (data.found && data.AMBstopId) {
      // normaliza ceros (como ya haces)
      data.AMBstopId = String(data.AMBstopId).replace(/^0+/, '');
      loadArrivals(data.AMBstopId);
    } else {
      loadCorbArrivals(corbStopId, corbStopName);
    }
  } catch (err) {
    console.error('Error al buscar correspondencia AMB para CORB:', err);
    loadCorbArrivals(corbStopId, corbStopName);
  }
}

async function loadAtmArrivals(stopId, ATMstopName) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;

  busItems = [];
  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';
  currentAtmStopId = stopId;

  try {
    const atmCode = stopId;
    await renderATMbuses(atmCode)
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    results.innerHTML = `<h3>Parada: ${ATMstopName}</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }
    document.getElementById('reloadBtn').disabled = false;
    console.log(ATMstopName)

  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }

  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = null;
  currentAtmStopId = stopId;
  currentCorbStopId = null;
  currentTgoStopId = null;
  currentSagStopId = null;
  currentTusStopId = null;
  currentMonStopId = null;

  isLoadingStopInfo = false;
}

async function loadCorbArrivals(stopId, CORBstopName) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;

  // Si el stopId que llega a loadArrivals es de Autocorb:
  //const match = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?CORBstopId=${encodeURIComponent(stopId)}`)
  //  .then(r => (r.ok ? r.json() : null))
  //  .catch(() => null);

  busItems = [];
  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';
  currentCorbStopId = stopId;

  try {
    const corbCode = stopId;
    await renderCORBbuses(corbCode)
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    results.innerHTML = `<h3>Parada: ${CORBstopName}</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }
    document.getElementById('reloadBtn').disabled = false;

  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }

  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = null;
  currentAtmStopId = null;
  currentCorbStopId = stopId;
  currentTgoStopId = null;
  currentSagStopId = null;
  currentTusStopId = null;
  currentMonStopId = null;

  isLoadingStopInfo = false;
}

async function handleTgoStopSelection(tgoStopId, tgoStopName) {
  try {
    const res = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?TGOstopId=${encodeURIComponent(tgoStopId)}`);
    const data = await res.json();

    if (data.found && data.TGOstopId) {
      // normaliza ceros (como ya haces)
      data.AMBstopId = String(data.AMBstopId).replace(/^0+/, '');
      loadArrivals(data.AMBstopId);
    } else {
      loadTgoArrivals(tgoStopId, tgoStopName);
    }
  } catch (err) {
    console.error('Error al buscar correspondencia AMB para TGO:', err);
    loadTgoArrivals(tgoStopId, tgoStopName);
  }
}

async function loadTgoArrivals(stopId, stopName, directionId) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;

  busItems = [];
  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';
  currentTgoStopId = stopId;
  currentTgoDirectionId = String(directionId);

  try {
    if (!directionId) {
      await renderTGObuses(stopId, 0);
      await renderTGObuses(stopId, 1);
    } else {
      await renderTGObuses(stopId, directionId);
    }

    results.innerHTML = `<h3>Parada: ${stopName || stopId}</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    document.getElementById('reloadBtn').disabled = false;
  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }

  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = null;
  currentAtmStopId = null;
  currentCorbStopId = null;
  currentTgoStopId = stopId;
  currentSagStopId = null;
  currentTusStopId = null;
  currentMonStopId = null;

  isLoadingStopInfo = false;
}

async function handleSagStopSelection(sagStopId, sagStopName) {
  try {
    const res = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?SAGstopId=${encodeURIComponent(sagStopId)}`);
    const data = await res.json();

    if (data.found && data.SAGstopId) {
      // normaliza ceros (como ya haces)
      data.AMBstopId = String(data.AMBstopId).replace(/^0+/, '');
      loadArrivals(data.AMBstopId);
    } else {
      loadSagArrivals(sagStopId, sagStopName);
    }
  } catch (err) {
    console.error('Error al buscar correspondencia AMB para SAG:', err);
    loadSagArrivals(sagStopId, sagStopName);
  }
}

async function loadSagArrivals(stopId, stopName) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;

  busItems = [];
  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';
  currentSagStopId = stopId;

  try {
    const sagCode = stopId;
    await renderSAGbuses(sagCode)
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    results.innerHTML = `<h3>Parada: ${SAGstopName}</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }
    document.getElementById('reloadBtn').disabled = false;

  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }

  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = null;
  currentAtmStopId = null;
  currentCorbStopId = null;
  currentTgoStopId = null;
  currentSagStopId = stopId;
  currentTusStopId = null;
  currentMonStopId = null;

  isLoadingStopInfo = false;
}

async function loadTusArrivals(stopId, stopName) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;

  busItems = [];
  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';

  try {
    await renderTUSbuses(stopId)
    results.innerHTML = `<h3>Parada: ${stopName}</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    document.getElementById('reloadBtn').disabled = false;
  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }

  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = null;
  currentAtmStopId = null;
  currentCorbStopId = null;
  currentTgoStopId = null;
  currentSagStopId = null;
  currentTusStopId = stopId;
  currentMonStopId = null;

  isLoadingStopInfo = false;
}

async function handleMonStopSelection(monStopId, monStopName) {
  try {
    const res = await protectedFetch(`/php/api/atm/matchAMB/endpoint.php?MONstopId=${encodeURIComponent(monStopId)}`);
    const data = await res.json();

    if (data.found && data.MONstopId) {
      // normaliza ceros (como ya haces)
      data.AMBstopId = String(data.AMBstopId).replace(/^0+/, '');
      loadArrivals(data.AMBstopId);
    } else {
      loadMonArrivals(monStopId, monStopName);
    }
  } catch (err) {
    console.error('Error al buscar correspondencia AMB para MON:', err);
    loadMonArrivals(monStopId, monStopName);
  }
}

async function loadMonArrivals(stopId, stopName) {
  if (isLoadingStopInfo) return;
  isLoadingStopInfo = true;

  busItems = [];
  const results = document.getElementById('results');
  results.innerHTML = '<li>🔄 Carregant dades...</li>';

  try {
    await renderMONbuses(stopId)
    results.innerHTML = `<h3>Parada: ${stopName}</h3>`;
    if (busItems.length === 0) {
      results.innerHTML += '<li>No hi ha autobusos propers.</li>';
    } else {
      results.innerHTML += busItems.join('');
    }

    document.getElementById('reloadBtn').disabled = false;
  } catch (err) {
    results.innerHTML = `<li style="color:red;">❌ Error carregant dades: ${err.message}</li>`;
    console.error(err);
  }

  const resultsList = document.getElementById('results');
  resultsList.scrollIntoView({ behavior: 'smooth', block: 'start' });

  currentStopId = null;
  currentAtmStopId = null;
  currentCorbStopId = null;
  currentTgoStopId = null;
  currentSagStopId = null;
  currentTusStopId = null;
  currentMonStopId = stopId;

  isLoadingStopInfo = false;
}
