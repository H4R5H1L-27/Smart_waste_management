// Auto-detect backend URL: if opened from file:// or external dev server (e.g. port 5500/3000), target backend at port 8000
const API = (window.location.protocol === "file:" || (window.location.port && window.location.port !== "8000"))
  ? "http://127.0.0.1:8000"
  : "";

const fillColor = (pct) => {
  if (pct < 50) return "#16a34a"; // green (safe)
  if (pct <= 80) return "#d97706"; // amber (warning)
  return "#e11d48"; // rose (critical)
};

function renderIcons() {
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

function dismissSkeleton(id) {
  const el = document.getElementById(id);
  if (el && !el.classList.contains("hidden")) {
    el.classList.add("hidden");
    setTimeout(() => {
      if (el) el.style.display = "none";
    }, 320);
  }
}

function showToast(type, title, message, durationMs = 3500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const iconMap = {
    alert: "alert-triangle",
    success: "check-circle",
    info: "info",
  };
  const iconName = iconMap[type] || "bell";

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon-box">
      <i data-lucide="${iconName}"></i>
    </div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button type="button" class="toast-close" aria-label="Close notification">&times;</button>
  `;

  let isDismissing = false;
  const dismiss = () => {
    if (isDismissing) return;
    isDismissing = true;
    toast.classList.add("toast-hiding");
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, 250);
  };

  toast.addEventListener("click", dismiss);
  const closeBtn = toast.querySelector(".toast-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dismiss();
    });
  }

  container.appendChild(toast);
  renderIcons();

  setTimeout(dismiss, durationMs);
}

const counterState = {};

function animateCounter(el, targetVal, formatFn = (v) => String(Math.round(v))) {
  if (!el) return;
  const key = el.id || el;
  const startVal = counterState[key] !== undefined ? counterState[key] : 0;

  if (window.gsap && typeof gsap.to === "function") {
    const obj = { val: startVal };
    gsap.to(obj, {
      val: targetVal,
      duration: 0.32,
      ease: "power1.out",
      onUpdate: () => {
        el.textContent = formatFn(obj.val);
      },
      onComplete: () => {
        counterState[key] = targetVal;
        el.textContent = formatFn(targetVal);
      },
    });
  } else {
    counterState[key] = targetVal;
    el.textContent = formatFn(targetVal);
  }
}

const previousBinFills = {};
let hasInitialFillRecord = false;

function checkFillThresholds(bins) {
  if (!hasInitialFillRecord) {
    bins.forEach((b) => {
      previousBinFills[b.id] = b.fill_percent;
    });
    hasInitialFillRecord = true;
    return;
  }

  bins.forEach((b) => {
    const prev = previousBinFills[b.id];
    if (prev !== undefined && prev < 90 && b.fill_percent >= 90) {
      showToast("alert", "Critical Overflow Warning", `Site ${b.id} (${b.name}) has reached ${b.fill_percent.toFixed(0)}% capacity!`);
    }
    previousBinFills[b.id] = b.fill_percent;
  });
}

// Initialize Leaflet Map for Live Bins (OpenStreetMap Standard Layer - Greater Chennai Corporation)
const map = L.map("map", { scrollWheelZoom: true }).setView([13.0450, 80.2200], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

// Initialize Leaflet Map for Route Optimizer (OpenStreetMap Standard Layer - Greater Chennai Corporation)
const routeMap = L.map("route-map", { scrollWheelZoom: true }).setView([13.0450, 80.2200], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(routeMap);

// Invalidate size once DOM and styles settle
window.addEventListener("resize", () => {
  if (map) map.invalidateSize();
  if (routeMap) routeMap.invalidateSize();
});
setTimeout(() => {
  if (map) map.invalidateSize();
  if (routeMap) routeMap.invalidateSize();
}, 250);

const markersLayer = L.layerGroup().addTo(map);
const reportMarkersLayer = L.layerGroup().addTo(map);
let knownReportIds = new Set();
let isFirstReportFetch = true;
const binMarkers = {};
let depotMarker = null;

const routeMarkersLayer = L.layerGroup().addTo(routeMap);
const routeBinMarkers = {};
let routeDepotMarker = null;

let naiveLine = null;
let optLine = null;
let activeRouteTween = null;
let chart = null;

let allBins = [];
let allPredictions = [];
let appMeta = null;
let activeFilter = "all";
let searchTerm = "";
let selectedFile = null;

let isOscillating = false;
let oscillateTimer = null;
let oscillatePhase = 0;

// Truck animation state
let truckMarker = null;
let truckAnimationId = null;
let truckRoutePoints = [];
let truckCurrentIndex = 0;
let truckSpeed = 2; // Default speed multiplier
let isTruckPlaying = false;

// Webcam stream state
let webcamStream = null;

// // =============================================================
// Interactive Graphic Municipal Street Bin Digital Twin
// =============================================================
let lastGraphicFillPct = null;

function initGraphicBin() {
  const pingBtn = document.getElementById("btn-hero-ping-sonar");
  if (pingBtn && !pingBtn.dataset.bound) {
    pingBtn.dataset.bound = "true";
    pingBtn.addEventListener("click", () => {
      triggerSonarPingEffect();
    });
  }
}

function triggerSonarPingEffect() {
  const waves = document.getElementById("sonar-ping-waves");
  if (waves) {
    waves.classList.remove("ping-active");
    void waves.offsetWidth; // trigger reflow
    waves.classList.add("ping-active");
  }
  const fillVal = document.getElementById("hero-node-fill");
  const distVal = document.getElementById("hero-node-dist");
  const fillText = fillVal ? fillVal.textContent : "—";
  const distText = distVal ? distVal.textContent : "—";
  if (typeof showToast === "function") {
    showToast(
      "Ultrasonic Sonar Pinged",
      `ESP32 sensor pinged target: echo distance ${distText} (${fillText} capacity)`,
      "info"
    );
  }
}

function updateGraphicBinTelemetry(bins) {
  if (!bins || bins.length === 0) return;

  // Find real-1 sensor, or fall back to highest simulated bin
  let targetBin = bins.find((b) => b.is_real);
  const isRealActive = targetBin && targetBin.last_updated;

  if (!targetBin || !isRealActive) {
    const sorted = [...bins].sort((a, b) => b.fill_percent - a.fill_percent);
    targetBin = sorted[0] || { id: "real-1", name: "Pondy Bazaar", fill_percent: 20 };
  }

  const fill = Math.max(0, Math.min(100, targetBin.fill_percent));
  const colorStr = fillColor(fill);

  // 1. Cross-fade between Graphic Bin States
  const imgEmpty = document.getElementById("bin-img-empty");
  const imgMedium = document.getElementById("bin-img-medium");
  const imgOverflow = document.getElementById("bin-img-overflow");
  const binStage = document.getElementById("graphic-bin-stage");
  const sonarWaves = document.getElementById("sonar-ping-waves");

  if (imgEmpty && imgMedium && imgOverflow) {
    if (fill >= 80) {
      imgEmpty.classList.remove("active");
      imgMedium.classList.remove("active");
      imgOverflow.classList.add("active");
      if (binStage) binStage.classList.add("overflow-alert");
    } else if (fill >= 40) {
      imgEmpty.classList.remove("active");
      imgMedium.classList.add("active");
      imgOverflow.classList.remove("active");
      if (binStage) binStage.classList.remove("overflow-alert");
    } else {
      imgEmpty.classList.add("active");
      imgMedium.classList.remove("active");
      imgOverflow.classList.remove("active");
      if (binStage) binStage.classList.remove("overflow-alert");
    }
  }

  // 2. Update Sonar Ping Waves Accent Color
  if (sonarWaves) {
    if (fill >= 80) {
      sonarWaves.className = "sonar-ping-emitter ping-crit";
    } else if (fill >= 50) {
      sonarWaves.className = "sonar-ping-emitter ping-warn";
    } else {
      sonarWaves.className = "sonar-ping-emitter";
    }
  }

  // 3. Update Vertical Telemetry Ruler
  const gaugeFill = document.getElementById("graphic-gauge-fill");
  const gaugeThumb = document.getElementById("graphic-gauge-thumb");
  const gaugeVal = document.getElementById("graphic-gauge-value");

  if (gaugeFill) {
    gaugeFill.style.height = `${fill.toFixed(0)}%`;
    gaugeFill.style.backgroundColor = colorStr;
  }
  if (gaugeThumb) {
    gaugeThumb.style.bottom = `${fill.toFixed(0)}%`;
  }
  if (gaugeVal) {
    gaugeVal.textContent = `${fill.toFixed(0)}%`;
  }

  // 4. Update Hero Callout Labels
  const nodeTitle = document.getElementById("hero-node-name");
  const nodeIdEl = document.getElementById("hero-node-id");
  const nodeFillEl = document.getElementById("hero-node-fill");
  const nodeDistEl = document.getElementById("hero-node-dist");
  const nodeSourceEl = document.getElementById("hero-node-source");
  const nodeEtaEl = document.getElementById("hero-node-eta");
  const statusPill = document.getElementById("hero-twin-status-pill");

  if (nodeTitle) nodeTitle.textContent = targetBin.name;
  if (nodeIdEl) {
    nodeIdEl.textContent = `${targetBin.id} · ${targetBin.is_real ? "ESP32 Sensor" : "Highest Active Bin"}`;
  }
  if (nodeFillEl) {
    nodeFillEl.textContent = `${fill.toFixed(1)}%`;
    nodeFillEl.style.color = colorStr;
  }
  if (nodeDistEl) {
    const dist = Math.max(0, (1 - fill / 100) * 50);
    nodeDistEl.textContent = `${dist.toFixed(1)} cm`;
  }
  if (nodeSourceEl) {
    nodeSourceEl.textContent = targetBin.is_real ? "HC-SR04 WiFi Node" : "Highest Municipal Site";
  }
  if (nodeEtaEl) {
    const pred = allPredictions.find((p) => p.id === targetBin.id);
    if (pred && pred.hours_until_full != null) {
      nodeEtaEl.textContent = `${pred.hours_until_full.toFixed(1)} hrs to full`;
    } else {
      nodeEtaEl.textContent = fill > 70 ? "Pickup Recommended" : "Normal Capacity";
    }
  }

  if (statusPill) {
    if (fill >= 80) {
      statusPill.className = "badge badge-critical";
      statusPill.textContent = "Critical Overflow ($100 Fine)";
    } else if (fill >= 50) {
      statusPill.className = "badge badge-warning";
      statusPill.textContent = "Moderate Fill";
    } else {
      statusPill.className = "badge badge-safe";
      statusPill.textContent = "Safe Capacity";
    }
  }

  lastGraphicFillPct = fill;
}

async function jget(path) {
  try {
    const r = await fetch(`${API}${path}`);
    if (!r.ok) {
      let detail = `${path} failed (${r.status})`;
      try {
        const errJson = await r.json();
        if (errJson && errJson.detail) detail = errJson.detail;
      } catch {}
      throw new Error(detail);
    }
    return await r.json();
  } catch (err) {
    console.error(`[API GET Error] ${path}:`, err.message || err);
    throw err;
  }
}

async function jpost(path, body = {}) {
  try {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      let detail = `${path} failed (${r.status})`;
      try {
        const errJson = await r.json();
        if (errJson && errJson.detail) detail = errJson.detail;
      } catch {}
      throw new Error(detail);
    }
    return await r.json();
  } catch (err) {
    console.error(`[API POST Error] ${path}:`, err.message || err);
    throw err;
  }
}

function updateMarkers(bins) {
  const currentIds = new Set(bins.map((b) => b.id));

  // Remove markers for bins no longer present
  Object.keys(binMarkers).forEach((id) => {
    if (!currentIds.has(id)) {
      markersLayer.removeLayer(binMarkers[id]);
      delete binMarkers[id];
    }
  });

  bins.forEach((bin) => {
    const isUrgent = bin.fill_percent > 70;
    const pulseHtml = isUrgent ? '<div class="marker-pulse-ring"></div>' : '';
    const markerColor = fillColor(bin.fill_percent);
    
    const icon = L.divIcon({
      className: "",
      html: `
        <div class="bin-marker" style="background:${markerColor}; border-color:${bin.is_real ? '#38bdf8' : '#fff'};">
          ${pulseHtml}
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const popupHtml = `
      <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:180px; color:#0f172a;">
        <div style="font-weight:700; color:#0284c7; font-size:0.875rem; margin-bottom:2px;">${bin.id}</div>
        <div style="font-size:0.875rem; color:#0f172a; font-weight:600;">${bin.name}</div>
        <div style="font-size:0.75rem; color:#475569; margin-top:4px;">
          Fill Level: <strong style="color:${markerColor}; font-size:0.875rem;">${bin.fill_percent.toFixed(1)}%</strong>
          ${bin.is_real ? '<br><span style="color:#0284c7; font-family:JetBrains Mono,monospace; font-size:0.75rem;">[ESP32 Ultrasonic Node]</span>' : ''}
        </div>
        <div style="font-size:0.75rem; color:#64748b; margin-top:3px;">
          Updated: ${(bin.last_updated || "").replace("T", " ").slice(0, 19)}Z
        </div>
        <div style="margin-top:8px;">
          <button type="button" class="btn btn-primary btn-sm" onclick="selectBinForReport('${bin.id}')">
            Report Overflow
          </button>
        </div>
      </div>
    `;

    if (binMarkers[bin.id]) {
      const m = binMarkers[bin.id];
      m.setLatLng([bin.lat, bin.lng]);
      m.setIcon(icon);
      m.setPopupContent(popupHtml);
    } else {
      const m = L.marker([bin.lat, bin.lng], { icon });
      m.bindPopup(popupHtml);
      markersLayer.addLayer(m);
      binMarkers[bin.id] = m;
    }
  });
  dismissSkeleton("map-skeleton");
}

function updateRouteMapMarkers(bins, meta) {
  if (!routeMap) return;
  const currentIds = new Set(bins.map((b) => b.id));

  Object.keys(routeBinMarkers).forEach((id) => {
    if (!currentIds.has(id)) {
      routeMarkersLayer.removeLayer(routeBinMarkers[id]);
      delete routeBinMarkers[id];
    }
  });

  bins.forEach((bin) => {
    const isUrgent = bin.fill_percent > 70;
    const pulseHtml = isUrgent ? '<div class="marker-pulse-ring"></div>' : "";
    const markerColor = fillColor(bin.fill_percent);

    const icon = L.divIcon({
      className: "",
      html: `
        <div class="bin-marker" style="background:${markerColor}; border-color:${bin.is_real ? "#0284c7" : "#fff"};">
          ${pulseHtml}
        </div>
      `,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    const popupHtml = `
      <div style="font-family:'Plus Jakarta Sans',sans-serif; min-width:160px; color:#0f172a;">
        <div style="font-weight:700; color:#0284c7; font-size:0.875rem; margin-bottom:2px;">${bin.id}</div>
        <div style="font-size:0.875rem; color:#0f172a; font-weight:600;">${bin.name}</div>
        <div style="font-size:0.75rem; color:#475569; margin-top:3px;">
          Fill Level: <strong style="color:${markerColor}; font-size:0.875rem;">${bin.fill_percent.toFixed(1)}%</strong>
          ${bin.is_real ? '<br><span style="color:#0284c7; font-family:JetBrains Mono,monospace; font-size:0.75rem;">[ESP32 Node]</span>' : ""}
        </div>
      </div>
    `;

    if (routeBinMarkers[bin.id]) {
      const m = routeBinMarkers[bin.id];
      m.setLatLng([bin.lat, bin.lng]);
      m.setIcon(icon);
      m.setPopupContent(popupHtml);
    } else {
      const m = L.marker([bin.lat, bin.lng], { icon });
      m.bindPopup(popupHtml);
      routeMarkersLayer.addLayer(m);
      routeBinMarkers[bin.id] = m;
    }
  });

  if (!routeDepotMarker && meta && meta.depot) {
    routeDepotMarker = L.marker([meta.depot.lat, meta.depot.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#06b6d4;border:2px solid #fff;border-radius:3px;box-shadow:0 0 12px #06b6d4;" title="Guindy Central Depot"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(routeMap).bindPopup(`<strong>${meta.depot.name || "Central Depot"}</strong><br>Guindy Industrial Estate`);
  }
  dismissSkeleton("route-map-skeleton");
}

window.selectBinForReport = function (binId) {
  if (window.location.hash !== "#/bins") {
    window.location.hash = "#/bins";
  }
  setTimeout(() => {
    const sel = document.getElementById("report-bin");
    if (sel) {
      sel.value = binId;
      const msgInput = document.getElementById("report-msg");
      if (msgInput) msgInput.focus();
      const reportForm = document.getElementById("report-form");
      if (reportForm) reportForm.scrollIntoView({ behavior: "smooth" });
    }
  }, 120);
};

window.focusBinOnMap = function (binId) {
  if (window.location.hash !== "#/bins") {
    window.location.hash = "#/bins";
  }
  setTimeout(() => {
    const bin = allBins.find((b) => b.id === binId);
    const m = binMarkers[binId];
    if (bin && m) {
      map.setView([bin.lat, bin.lng], 14, { animate: true });
      m.openPopup();
    }
  }, 120);
};

function renderTable() {
  const eta = Object.fromEntries(allPredictions.map((p) => [p.id, p.hours_until_full]));
  const body = document.getElementById("bin-rows");
  
  let filtered = allBins.filter((b) => {
    if (activeFilter === "urgent" && b.fill_percent <= 70) return false;
    if (activeFilter === "physical" && !b.is_real) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!b.id.toLowerCase().includes(q) && !b.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Pin live physical ESP32 node to the VERY TOP of the table
  filtered.sort((a, b) => {
    if (a.is_real && !b.is_real) return -1;
    if (!a.is_real && b.is_real) return 1;
    return b.fill_percent - a.fill_percent;
  });

  if (filtered.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="hint" style="text-align:center;padding:1.2rem;">No matching bins found.</td></tr>`;
    return;
  }

  body.innerHTML = filtered
    .map((b) => {
      const hours = eta[b.id];
      let etaBadge = `<span class="eta-pill">—</span>`;
      if (hours != null) {
        if (hours <= 2.0) {
          etaBadge = `<span class="eta-pill eta-urgent">${hours.toFixed(1)} h</span>`;
        } else if (hours <= 6.0) {
          etaBadge = `<span class="eta-pill eta-warn">${hours.toFixed(1)} h</span>`;
        } else {
          etaBadge = `<span class="eta-pill eta-good">${hours.toFixed(1)} h</span>`;
        }
      }
      const markerColor = fillColor(b.fill_percent);
      const isHardware = Boolean(b.is_real);
      const hardwareBadge = isHardware
        ? '<span class="badge badge-info" style="font-weight:700;margin-left:4px;background:#0284c722;color:#0284c7;border:1px solid #0284c744;"><i data-lucide="radio" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:2px;"></i> LIVE ESP32 HARDWARE</span>'
        : '<span class="badge" style="background:#f1f5f9;color:#64748b;font-size:0.7rem;margin-left:4px;">SIMULATED</span>';
      const connBadge = isHardware
        ? '<span class="badge" style="background:#ecfdf5;color:#059669;font-size:0.7rem;margin-left:4px;border:1px solid #10b98144;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;margin-right:4px;"></span>ULTRASONIC ONLINE</span>'
        : '';
      const rowStyle = isHardware
        ? 'style="background:rgba(2, 132, 199, 0.08); border-left: 3px solid #0284c7;"'
        : '';
      return `<tr class="table-row-item" ${rowStyle} onclick="focusBinOnMap('${b.id}')" title="${isHardware ? 'Live Physical Hardware Node (PINNED TOP)' : 'Locate on map'}">
        <td><span class="bin-id-tag" ${isHardware ? 'style="background:#0284c7;color:#fff;font-weight:700;"' : ''}>${b.id}</span></td>
        <td>
          <strong>${b.name}</strong>
          ${hardwareBadge}
          ${connBadge}
          ${b.is_real && b.camera_label ? `<span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:0.7rem;margin-left:4px;">CAM: ${b.camera_label.toUpperCase()} (${(b.camera_confidence * 100).toFixed(0)}%)</span>` : ''}
        </td>
        <td>
          <div class="fill-progress-wrap">
            <div class="fill-track-modern">
              <div class="fill-bar-modern" style="width:${b.fill_percent}%; background:${markerColor};"></div>
            </div>
            <span style="color:${markerColor}; font-weight:700;">${b.fill_percent.toFixed(1)}%</span>
          </div>
        </td>
        <td>${etaBadge}</td>
        <td><span class="hint">${(b.last_updated || "").replace("T", " ").slice(11, 19)}</span></td>
        <td>
          <button type="button" class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); selectBinForReport('${b.id}')">Report</button>
        </td>
      </tr>`;
    })
    .join("");
  renderIcons();
}

function renderStats() {
  const full = allBins.filter((b) => b.fill_percent > 70).length;
  const mean = allBins.reduce((s, b) => s + b.fill_percent, 0) / Math.max(allBins.length, 1);
  const realBin = allBins.find((b) => b.is_real);

  const statFullEl = document.getElementById("stat-full");
  const statMeanEl = document.getElementById("stat-mean");
  const statRealEl = document.getElementById("stat-real");

  if (statFullEl) animateCounter(statFullEl, full, (v) => String(Math.round(v)));
  if (statMeanEl) animateCounter(statMeanEl, Math.round(mean), (v) => `${Math.round(v)}%`);
  if (statRealEl && realBin) animateCounter(statRealEl, Math.round(realBin.fill_percent), (v) => `${Math.round(v)}%`);

  // Update physical bin controller card
  if (realBin) {
    const valSpan = document.getElementById("real-bin-fill-val");
    const statusSpan = document.getElementById("real-bin-status");
    const distSpan = document.getElementById("sonar-distance-val");
    const slider = document.getElementById("real-bin-slider");
    
    valSpan.textContent = `${realBin.fill_percent.toFixed(1)}%`;
    const distanceCm = Math.max(0.0, (1.0 - realBin.fill_percent / 100.0) * 50.0);
    distSpan.textContent = `${distanceCm.toFixed(1)} cm`;

    if (realBin.fill_percent >= 90) {
      statusSpan.textContent = "ALARM (BUZZER ON)";
      statusSpan.className = "sonar-reading reading-alert";
    } else if (realBin.fill_percent >= 70) {
      statusSpan.textContent = "WARNING (NEED PICKUP)";
      statusSpan.className = "sonar-reading reading-warn";
    } else {
      statusSpan.textContent = "ONLINE (ULTRASONIC READY)";
      statusSpan.className = "sonar-reading reading-normal";
    }

    if (!document.activeElement || document.activeElement !== slider) {
      slider.value = realBin.fill_percent;
    }
  }
}

function renderOverview() {
  const fullBins = allBins.filter((b) => b.fill_percent > 70);
  const mean = allBins.reduce((s, b) => s + b.fill_percent, 0) / Math.max(allBins.length, 1);
  const realBin = allBins.find((b) => b.is_real);
  const etaMap = Object.fromEntries(allPredictions.map((p) => [p.id, p.hours_until_full]));

  const totalEl = document.getElementById("overview-total-bins");
  const urgentEl = document.getElementById("overview-urgent-count");
  const avgEl = document.getElementById("overview-avg-fill");
  const realEl = document.getElementById("overview-real-fill");
  const realDistEl = document.getElementById("overview-real-dist");

  if (totalEl) animateCounter(totalEl, allBins.length || 11, (v) => String(Math.round(v)));
  if (urgentEl) animateCounter(urgentEl, fullBins.length, (v) => String(Math.round(v)));
  if (avgEl) animateCounter(avgEl, Math.round(mean), (v) => `${Math.round(v)}%`);
  if (realEl && realBin) animateCounter(realEl, Math.round(realBin.fill_percent), (v) => `${Math.round(v)}%`);
  if (realDistEl && realBin) {
    const dist = Math.max(0, (1 - realBin.fill_percent / 100) * 50);
    realDistEl.textContent = `gymd (VIT Node) · ${dist.toFixed(1)} cm distance`;
  }

  const urgentTbody = document.getElementById("overview-urgent-rows");
  if (!urgentTbody) return;

  if (fullBins.length === 0) {
    urgentTbody.innerHTML = `<tr><td colspan="5" class="hint" style="text-align:center;padding:1.4rem;color:#16a34a;">✓ All municipal sites within safe operating capacity (&le;70% fill). Zero critical overflow backlog.</td></tr>`;
    return;
  }

  // Pin live physical hardware node to the top if present in urgent backlog
  const sortedFullBins = [...fullBins].sort((a, b) => {
    if (a.is_real && !b.is_real) return -1;
    if (!a.is_real && b.is_real) return 1;
    return b.fill_percent - a.fill_percent;
  });

  urgentTbody.innerHTML = sortedFullBins
    .map((b) => {
      const hours = etaMap[b.id];
      let etaBadge = `<span class="eta-pill">—</span>`;
      if (hours != null) {
        if (hours <= 2.0) {
          etaBadge = `<span class="eta-pill eta-urgent">${hours.toFixed(1)} h</span>`;
        } else if (hours <= 6.0) {
          etaBadge = `<span class="eta-pill eta-warn">${hours.toFixed(1)} h</span>`;
        } else {
          etaBadge = `<span class="eta-pill eta-good">${hours.toFixed(1)} h</span>`;
        }
      }
      const markerColor = fillColor(b.fill_percent);
      const isHardware = Boolean(b.is_real);
      const rowStyle = isHardware ? 'style="background:rgba(2, 132, 199, 0.08); border-left: 3px solid #0284c7;"' : '';
      const hardwareBadge = isHardware
        ? '<span class="badge badge-info" style="font-weight:700;margin-left:4px;background:#0284c722;color:#0284c7;border:1px solid #0284c744;"><i data-lucide="radio" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:2px;"></i> LIVE ESP32 HARDWARE</span>'
        : '<span class="badge" style="background:#f1f5f9;color:#64748b;font-size:0.7rem;margin-left:4px;">SIMULATED</span>';
      return `<tr class="table-row-item" ${rowStyle} onclick="focusBinOnMap('${b.id}')" title="${isHardware ? 'Live Physical Hardware Node (PINNED TOP)' : 'Locate on map'}">
        <td><span class="bin-id-tag" ${isHardware ? 'style="background:#0284c7;color:#fff;font-weight:700;"' : ''}>${b.id}</span></td>
        <td>
          <strong>${b.name}</strong>
          ${hardwareBadge}
        </td>
        <td>
          <div class="fill-progress-wrap">
            <div class="fill-track-modern">
              <div class="fill-bar-modern" style="width:${b.fill_percent}%; background:${markerColor};"></div>
            </div>
            <span style="color:${markerColor}; font-weight:700;">${b.fill_percent.toFixed(1)}%</span>
          </div>
        </td>
        <td>${etaBadge}</td>
        <td>
          <button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation(); focusBinOnMap('${b.id}')">Locate</button>
        </td>
      </tr>`;
    })
    .join("");

  initGraphicBin();
  updateGraphicBinTelemetry(allBins);

  renderIcons();
}

function renderAnalyticsPredictions(predictions) {
  const tbody = document.getElementById("analytics-predictions-tbody");
  if (!tbody) return;
  if (!predictions || predictions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="hint" style="text-align:center;padding:1.2rem;">No forecasting data available.</td></tr>`;
    return;
  }

  // Pin live physical hardware node to the VERY TOP of analytics table
  const sortedPredictions = [...predictions].sort((a, b) => {
    const aIsReal = allBins.some((x) => x.id === a.id && x.is_real);
    const bIsReal = allBins.some((x) => x.id === b.id && x.is_real);
    if (aIsReal && !bIsReal) return -1;
    if (!aIsReal && bIsReal) return 1;
    return (a.hours_until_full ?? 999) - (b.hours_until_full ?? 999);
  });

  tbody.innerHTML = sortedPredictions
    .map((p) => {
      let etaBadge = `<span class="eta-pill">—</span>`;
      if (p.hours_until_full != null) {
        if (p.hours_until_full <= 2.0) {
          etaBadge = `<span class="eta-pill eta-urgent">${p.hours_until_full.toFixed(1)} h</span>`;
        } else if (p.hours_until_full <= 6.0) {
          etaBadge = `<span class="eta-pill eta-warn">${p.hours_until_full.toFixed(1)} h</span>`;
        } else {
          etaBadge = `<span class="eta-pill eta-good">${p.hours_until_full.toFixed(1)} h</span>`;
        }
      }
      const color = fillColor(p.current_fill);
      const isHardware = allBins.some((x) => x.id === p.id && x.is_real);
      const rowStyle = isHardware ? 'style="background:rgba(2, 132, 199, 0.08); border-left: 3px solid #0284c7;"' : '';
      const hardwareBadge = isHardware
        ? ' <span class="badge badge-info" style="font-weight:700;margin-left:4px;background:#0284c722;color:#0284c7;border:1px solid #0284c744;"><i data-lucide="radio" style="width:12px;height:12px;display:inline-block;vertical-align:-1px;margin-right:2px;"></i> LIVE ESP32</span>'
        : '';
      return `<tr ${rowStyle}>
        <td><strong>${p.name || p.id}</strong> <span class="hint">(${p.id})</span>${hardwareBadge}</td>
        <td>
          <div class="fill-progress-wrap">
            <div class="fill-track-modern">
              <div class="fill-bar-modern" style="width:${p.current_fill}%; background:${color};"></div>
            </div>
            <span style="color:${color}; font-weight:700;">${p.current_fill.toFixed(1)}%</span>
          </div>
        </td>
        <td>${etaBadge}</td>
        <td><span class="hint">${p.sample_count || 10} readings</span></td>
      </tr>`;
    })
    .join("");
}

function fillReportSelect() {
  const sel = document.getElementById("report-bin");
  if (!sel) return;
  const current = sel.value;
  const optionsHtml = allBins.map((b) => `<option value="${b.id}">${b.id} — ${b.name}</option>`).join("");
  if (sel.innerHTML !== optionsHtml) {
    sel.innerHTML = optionsHtml;
    if (current && allBins.some((b) => b.id === current)) {
      sel.value = current;
    }
  }
}

async function refreshChart() {
  try {
    const rows = await jget("/analytics/categories");
    const labels = rows.map((r) => r.category);
    const data = rows.map((r) => r.count);

    // Update Overview classification KPI
    const totalCount = data.reduce((s, c) => s + c, 0);
    const ovClassified = document.getElementById("overview-classified-count");
    if (ovClassified) animateCounter(ovClassified, totalCount, (v) => String(Math.round(v)));

    const ctx = document.getElementById("cat-chart");
    if (!ctx) return;
    
    if (chart) {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update();
      dismissSkeleton("chart-skeleton");
      return;
    }
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Detections",
          data,
          backgroundColor: "rgba(2, 132, 199, 0.85)",
          borderColor: "#0284c7",
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { font: { family: "JetBrains Mono", size: 11 }, color: "#64748b" },
            grid: { color: "#e2e8f0" },
          },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#64748b" },
            grid: { color: "#e2e8f0" },
          },
        },
      },
    });
    dismissSkeleton("chart-skeleton");
  } catch (err) {
    console.warn("Classification chart refresh paused:", err.message);
  }
}

async function refreshReports() {
  try {
    const rows = await jget("/reports");

    // Detect new incoming reports from smartphones and trigger toasts
    if (!isFirstReportFetch && rows && rows.length > 0) {
      rows.forEach((r) => {
        if (!knownReportIds.has(r.id)) {
          const bin = allBins.find((b) => b.id === r.bin_id);
          const binName = bin ? bin.name : r.bin_id;
          const actionText = r.recommended_action ? ` · Action: ${r.recommended_action}` : "";
          showToast(
            r.severity === "high" ? "alert" : "info",
            `📱 New Phone Report: ${binName}`,
            `${(r.category || "waste").toUpperCase()} (${(r.severity || "medium").toUpperCase()})${actionText}`,
            7000
          );
        }
      });
    }

    knownReportIds = new Set(rows.map((r) => r.id));
    isFirstReportFetch = false;

    // Update KPI counter
    const ovReports = document.getElementById("overview-reports-count");
    if (ovReports) animateCounter(ovReports, rows ? rows.length : 0, (v) => String(Math.round(v)));
    const badgeRepCount = document.getElementById("badge-reports-count");
    if (badgeRepCount) badgeRepCount.textContent = `📱 ${rows ? rows.length : 0} Citizen Reports Active`;

    // 1. Update Map Markers for Reports
    reportMarkersLayer.clearLayers();
    const maxReportId = rows && rows.length > 0 ? Math.max(...rows.map((x) => x.id)) : null;

    rows.forEach((r) => {
      const bin = allBins.find((b) => b.id === r.bin_id);
      const lat = r.lat != null ? r.lat : (bin ? bin.lat : null);
      const lng = r.lng != null ? r.lng : (bin ? bin.lng : null);
      if (lat == null || lng == null) return;

      const isLatest = r.id === maxReportId;
      if (isLatest) {
        window.latestReportData = { id: r.id, lat, lng, name: bin ? bin.name : r.bin_id };
      }

      const binName = bin ? bin.name : r.bin_id;
      const sevColor = r.severity === "high" ? "#f43f5e" : (r.severity === "medium" ? "#f59e0b" : "#10b981");

      const icon = L.divIcon({
        className: "custom-report-pin",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;transform:translateY(-10px);">
            <div style="background:${sevColor};color:#fff;font-size:10px;font-weight:800;padding:2px 7px;border-radius:12px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.5);border:1.5px solid #fff;margin-bottom:2px;display:flex;align-items:center;gap:3px;">
              <span>📱 #CL-${r.id}</span>
              ${isLatest ? '<span style="background:#fff;color:' + sevColor + ';font-size:8px;padding:0 3px;border-radius:4px;font-weight:900;">NEW</span>' : ''}
            </div>
            <div style="position:relative;display:flex;align-items:center;justify-content:center;width:30px;height:30px;">
              <span style="position:absolute;width:30px;height:30px;border-radius:50%;background:${sevColor};opacity:0.45;animation:pulse 1.8s infinite;"></span>
              <span style="width:18px;height:18px;border-radius:50%;background:${sevColor};border:2px solid #fff;box-shadow:0 0 10px ${sevColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:900;">!</span>
            </div>
          </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 50],
      });

      const photoHtml = r.image_url ? `<img src="${r.image_url}" alt="Report photo" style="width:100%;max-height:130px;object-fit:cover;border-radius:8px;margin-bottom:8px;border:1px solid #cbd5e1;" />` : "";
      const popup = `
        <div style="min-width:220px;font-family:'Plus Jakarta Sans',sans-serif;padding:2px;">
          ${photoHtml}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <strong style="color:#0f172a;font-size:0.92rem;">${binName}</strong>
            <span style="font-size:0.7rem;font-weight:700;padding:2px 6px;border-radius:12px;background:${sevColor}22;color:${sevColor};">${(r.severity || "MEDIUM").toUpperCase()}</span>
          </div>
          <div style="font-size:0.78rem;color:#64748b;margin-bottom:6px;">Citizen Report: <strong>#CL-${r.id} (${(r.category || "waste").toUpperCase()})</strong></div>
          <div style="background:#f0f9ff;border-left:3px solid #0284c7;padding:6px 8px;border-radius:4px;font-size:0.78rem;color:#0369a1;margin-bottom:8px;">
            <strong>Facilities Action:</strong><br>${r.recommended_action || r.description || r.message}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:0.7rem;color:#94a3b8;">${(r.timestamp || "").slice(11, 19)}</span>
            <button class="btn btn-secondary btn-sm" onclick="window.resolveReport(${r.id})" style="padding:2px 8px;font-size:0.74rem;">Resolve</button>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon })
        .bindPopup(popup)
        .addTo(reportMarkersLayer);
      marker.reportId = r.id;
    });

    // 2. Update Live Bins tab side list
    const list = document.getElementById("report-list");
    if (list) {
      if (rows.length === 0) {
        list.innerHTML = "<li class='hint' style='padding:0.6rem 0;'>No active citizen flags.</li>";
      } else {
        list.innerHTML = rows
          .map(
            (r) => `
          <li class="report-item-card">
            <div>
              <strong style="color:var(--color-primary);">#CL-${r.id} (${r.bin_id})</strong>: ${r.message}
              <div class="hint">${(r.timestamp || "").replace("T", " ").slice(0, 19)}Z</div>
            </div>
            <div style="display:flex;gap:4px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.focusReportOnMap(${r.id}, ${r.lat}, ${r.lng})" style="padding:2px 6px;font-size:0.72rem;">Map</button>
              <button type="button" class="btn-resolve-badge" onclick="resolveReport(${r.id})">Resolve</button>
            </div>
          </li>
        `
          )
          .join("");
      }
    }

    // 3. Update Overview Live Citizen Reports Table
    const overviewTable = document.getElementById("overview-reports-rows");
    if (overviewTable) {
      if (rows.length === 0) {
        overviewTable.innerHTML = `<tr><td colspan="6" class="hint" style="text-align:center;padding:1.4rem;color:#16a34a;">✓ No active citizen reports on campus. Open <strong>/civiclens</strong> or <strong>/report</strong> to submit reports.</td></tr>`;
      } else {
        overviewTable.innerHTML = rows.map((r) => {
          const bin = allBins.find((b) => b.id === r.bin_id);
          const bName = bin ? bin.name : r.bin_id;
          const lat = r.lat != null ? r.lat : (bin ? bin.lat : null);
          const lng = r.lng != null ? r.lng : (bin ? bin.lng : null);
          const isLatest = r.id === maxReportId;

          const sev = (r.severity || "medium").toLowerCase();
          const sevBadge = sev === "high"
            ? '<span class="badge badge-warn">CRITICAL / HIGH</span>'
            : (sev === "low" ? '<span class="badge badge-safe">LOW</span>' : '<span class="badge badge-alert">MEDIUM</span>');
          const thumb = r.image_url
            ? `<a href="${r.image_url}" target="_blank"><img src="${r.image_url}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;" title="Click to view photo"/></a>`
            : `<span class="hint">—</span>`;

          const st = (r.status || "submitted").toLowerCase();
          let statusBadge = '<span class="badge badge-alert">PENDING REVIEW</span>';
          let actionButtons = `
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.focusReportOnMap(${r.id}, ${lat}, ${lng})" title="View pin on live map" style="display:inline-flex;align-items:center;gap:3px;background:#0284c718;color:#38bdf8;border:1px solid #0284c740;">
              🗺️ Map
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.verifyReport(${r.id})" title="Verify report and generate route task">Verify</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.rejectReport(${r.id})" title="Reject report without dispatch">Reject</button>
          `;

          if (st === "verified") {
            statusBadge = '<span class="badge badge-info" style="background:#2563eb22;color:#2563eb;font-weight:700;">VERIFIED / IN ROUTE</span>';
            actionButtons = `
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.focusReportOnMap(${r.id}, ${lat}, ${lng})" title="View pin on live map" style="display:inline-flex;align-items:center;gap:3px;background:#0284c718;color:#38bdf8;border:1px solid #0284c740;">🗺️ Map</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="window.resolveReport(${r.id})">Mark Resolved</button>
            `;
          } else if (st === "rejected") {
            statusBadge = '<span class="badge badge-warn" style="background:#f43f5e22;color:#f43f5e;font-weight:700;">REJECTED</span>';
            actionButtons = `<button type="button" class="btn btn-secondary btn-sm" onclick="window.focusReportOnMap(${r.id}, ${lat}, ${lng})" style="padding:2px 6px;">🗺️ Map</button><span class="hint" title="${r.verification_notes || 'Excluded from route'}">Excluded</span>`;
          } else if (st === "resolved") {
            statusBadge = '<span class="badge badge-safe" style="font-weight:700;">RESOLVED</span>';
            actionButtons = '<span class="hint" style="color:#16a34a;">✓ Cleaned</span>';
          }

          return `<tr style="${isLatest ? 'background:rgba(14,165,233,0.06);border-left:3px solid #0ea5e9;' : ''}">
            <td>
              <span class="hint">${(r.timestamp || "").replace("T", " ").slice(11, 19)}</span>
              ${isLatest ? '<span class="badge badge-info" style="margin-left:4px;font-size:0.65rem;padding:1px 4px;">LATEST</span>' : ''}
            </td>
            <td><strong>${bName}</strong> <span class="hint">(#CL-${r.id})</span></td>
            <td><span class="badge badge-info">${(r.category || "mixed").toUpperCase()}</span></td>
            <td>${sevBadge}</td>
            <td>
              <div style="max-width:320px;">
                <div style="margin-bottom:4px;">${statusBadge}</div>
                <strong style="color:var(--color-primary);">${r.recommended_action || "Include in routine sweep."}</strong>
                <div class="hint" style="margin-top:2px;">${r.description || r.message}</div>
                ${r.verification_notes ? `<div style="font-size:0.75rem;color:#64748b;margin-top:2px;font-style:italic;">Notes: ${r.verification_notes}</div>` : ''}
              </div>
            </td>
            <td>
              <div style="display:flex;align-items:center;gap:6px;">
                ${thumb}
                ${actionButtons}
              </div>
            </td>
          </tr>`;
        }).join("");
      }
    }

    renderIcons();
  } catch (err) {
    console.warn("Reports refresh paused:", err.message);
  }
}

window.focusReportOnMap = function (reportId, lat, lng) {
  switchView("bins");
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      if (lat != null && lng != null) {
        map.setView([lat, lng], 16, { animate: true, duration: 0.8 });
      }
      if (reportMarkersLayer) {
        reportMarkersLayer.eachLayer((layer) => {
          if (layer.reportId === reportId) {
            layer.openPopup();
          }
        });
      }
    }
    if (typeof showToast === "function") {
      showToast("info", `Citizen Report #CL-${reportId}`, "Centered on Chennai Live Map");
    }
  }, 220);
};

window.focusLatestReport = function () {
  if (window.latestReportData && window.latestReportData.lat != null) {
    window.focusReportOnMap(window.latestReportData.id, window.latestReportData.lat, window.latestReportData.lng);
  } else {
    if (typeof showToast === "function") {
      showToast("info", "No Citizen Reports", "No live citizen reports available to focus.");
    }
  }
};

window.fitAllMapPoints = function () {
  if (!map) return;
  const allLatLngs = [];
  if (allBins && allBins.length > 0) {
    allBins.forEach((b) => {
      if (b.lat != null && b.lng != null) allLatLngs.push([b.lat, b.lng]);
    });
  }
  if (reportMarkersLayer) {
    reportMarkersLayer.eachLayer((l) => {
      if (l.getLatLng) allLatLngs.push(l.getLatLng());
    });
  }
  if (allLatLngs.length > 0) {
    const bounds = L.latLngBounds(allLatLngs);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
};

window.resolveReport = async function (reportId) {
  try {
    const res = await fetch(`${API}/reports/${reportId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "resolved",
        verification_notes: "Resolved by operations staff."
      })
    });
    if (res.ok) {
      showToast("success", "Report Resolved", `Report #${reportId} marked resolved.`);
      await refresh();
    } else {
      alert("Failed to resolve report: HTTP " + res.status);
    }
  } catch (err) {
    console.error("Failed to update report", err);
    alert("Could not contact server to resolve report.");
  }
};

window.verifyReport = async function (reportId) {
  try {
    const res = await fetch(`${API}/reports/${reportId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "verified",
        verification_notes: "Verified by campus facilities supervisor. Priority collection task created."
      })
    });
    if (res.ok) {
      showToast("success", "Report Verified", `Report #${reportId} verified and added to collection route tasks!`);
      await refresh();
      if (document.getElementById("btn-optimize")) {
        document.getElementById("btn-optimize").click();
      }
    }
  } catch (err) {
    console.error("Failed to verify report", err);
    alert("Could not contact server to verify report.");
  }
};

window.rejectReport = async function (reportId) {
  const notes = prompt("Enter rejection reason (optional):", "Normal seasonal leaf clutter, scheduled for manual grounds sweep.");
  if (notes === null) return;
  try {
    const res = await fetch(`${API}/reports/${reportId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "rejected",
        verification_notes: notes || "Rejected by operator; does not require truck collection."
      })
    });
    if (res.ok) {
      showToast("info", "Report Rejected", `Report #${reportId} rejected. Excluded from collection route.`);
      await refresh();
      if (document.getElementById("btn-optimize")) {
        document.getElementById("btn-optimize").click();
      }
    }
  } catch (err) {
    console.error("Failed to reject report", err);
    alert("Could not contact server to reject report.");
  }
};

window.completeTaskStop = async function (stopId) {
  try {
    const res = await fetch(`${API}/tasks/${stopId}/complete`, { method: "POST" });
    if (res.ok) {
      showToast("success", "Stop Collected", `Stop ${stopId} marked complete! Linked waste cleared.`);
      await refresh();
      if (document.getElementById("btn-optimize")) {
        document.getElementById("btn-optimize").click();
      }
    }
  } catch (err) {
    console.error("Complete stop error", err);
  }
};

window.resetDemoScenario = async function () {
  try {
    const res = await fetch(`${API}/demo/reset`, { method: "POST" });
    if (res.ok) {
      showToast("success", "Demo State Reset", "Restored repeatable Chennai baseline (1 Live Bin, 2 High-Fill Bins, 3 Demo Reports).");
      await refresh();
      if (document.getElementById("btn-optimize")) {
        document.getElementById("btn-optimize").click();
      }
    }
  } catch (err) {
    console.error("Reset demo failed", err);
    alert("Could not reset demo scenario.");
  }
};

window.acceptAISuggestion = function () {
  showToast("success", "AI Advisory Accepted", "Operator approved dynamic route sequence. Dispatch instructions committed to crew!");
  const btn = document.getElementById("btn-accept-ai-suggestion");
  if (btn) {
    btn.innerHTML = "<i data-lucide='check-check'></i> Approved & Committed";
    btn.classList.remove("btn-primary");
    btn.classList.add("btn-secondary");
    btn.disabled = true;
  }
  renderIcons();
};

async function refresh() {
  try {
    const [bins, meta, predictions] = await Promise.all([
      jget("/bins"),
      jget("/meta"),
      jget("/analytics/predictions"),
    ]);
    allBins = bins;
    allPredictions = predictions;
    appMeta = meta;

    checkFillThresholds(bins);

    updateMarkers(bins);
    updateRouteMapMarkers(bins, meta);
    
    if (!depotMarker && meta && meta.depot) {
      depotMarker = L.marker([meta.depot.lat, meta.depot.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;background:#06b6d4;border:2px solid #fff;border-radius:3px;box-shadow:0 0 12px #06b6d4;" title="Guindy Central Depot"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
      }).addTo(map).bindPopup(`<strong>${meta.depot.name || "Central Depot"}</strong><br>Guindy Industrial Estate`);
    }
    
    renderTable();
    renderStats();
    renderOverview();
    renderAnalyticsPredictions(predictions);
    fillReportSelect();
  } catch (err) {
    console.warn("Telemetry refresh paused (network/server):", err.message);
    const body = document.getElementById("bin-rows");
    if (body && allBins.length === 0) {
      body.innerHTML = `<tr><td colspan="6" class="hint" style="text-align:center;padding:1.2rem;color:#f43f5e;">Unable to connect to telemetry server (${err.message}). Retrying...</td></tr>`;
    }
  }
}

// -------------------------------------------------------------
// Real Road Routing (OSRM) & Truck Animation (Route Optimizer View)
// -------------------------------------------------------------
document.getElementById("btn-optimize").addEventListener("click", async () => {
  const summary = document.getElementById("route-summary");
  const itineraryBox = document.getElementById("route-itinerary");
  const animToolbar = document.getElementById("truck-anim-toolbar");
  const impactBanner = document.getElementById("route-impact-banner");
  const thresholdVal = parseFloat(document.getElementById("route-threshold").value) || 70.0;
  
  summary.textContent = `Querying OSRM street network & solving VRP on real Chennai roads…`;
  
  try {
    const data = await jpost("/optimize-route", { threshold: thresholdVal });
    
    if (naiveLine) { routeMap.removeLayer(naiveLine); naiveLine = null; }
    if (optLine) { routeMap.removeLayer(optLine); optLine = null; }
    stopTruckAnimation();
    if (truckMarker) {
      routeMap.removeLayer(truckMarker);
      truckMarker = null;
    }
    
    if (!data.full_count) {
      summary.textContent = `All bins clear! No sites above ${thresholdVal}% fill threshold.`;
      itineraryBox.style.display = "none";
      animToolbar.style.display = "none";
      impactBanner.style.display = "none";
      return;
    }

    // Draw Naive Route on Route Optimizer map (red dashed line)
    const naivePoints = data.naive.geometry || [];
    naiveLine = L.polyline(naivePoints, {
      color: "#f43f5e",
      weight: 3,
      dashArray: "6 6",
      opacity: 0.7,
    }).addTo(routeMap);

    // Draw Real-Road Optimized Route on Route Optimizer map (progressive draw)
    const optPoints = data.optimized.geometry || [];
    if (activeRouteTween) {
      activeRouteTween.kill();
      activeRouteTween = null;
    }
    optLine = L.polyline(optPoints.length > 0 ? [optPoints[0]] : [], {
      color: "#0284c7",
      weight: 5,
      opacity: 0.95,
      lineCap: "round",
    }).addTo(routeMap);

    if (window.gsap && optPoints.length > 1) {
      const tracker = { count: 1 };
      activeRouteTween = gsap.to(tracker, {
        count: optPoints.length,
        duration: 0.35,
        ease: "power1.out",
        onUpdate: () => {
          const idx = Math.min(optPoints.length, Math.floor(tracker.count));
          if (optLine) optLine.setLatLngs(optPoints.slice(0, idx));
        },
        onComplete: () => {
          if (optLine) optLine.setLatLngs(optPoints);
          activeRouteTween = null;
        },
      });
    } else if (optPoints.length > 0) {
      optLine.setLatLngs(optPoints);
    }

    // Zoom Route Optimizer camera to encompass entire urban route
    if (optPoints.length > 0) {
      routeMap.fitBounds(L.latLngBounds(optPoints), { padding: [35, 35] });
    }

    // Set impact counters
    const naiveKm = data.naive.distance_km;
    const optKm = data.optimized.distance_km;
    const kmSaved = data.km_saved || 0.0;
    const pctSaved = naiveKm > 0 ? (kmSaved / naiveKm) * 100 : 0;

    document.getElementById("impact-distance").textContent = `${kmSaved.toFixed(1)} km (${pctSaved.toFixed(1)}%)`;
    document.getElementById("impact-time").textContent = `${data.time_saved_min.toFixed(1)} min`;
    document.getElementById("impact-fuel").textContent = `${data.fuel_saved_l.toFixed(2)} L`;
    document.getElementById("impact-stops").textContent = `${data.full_count} bins`;
    
    const co2Val = `${data.co2_saved_kg.toFixed(1)} kg`;
    const statCo2El = document.getElementById("stat-co2");
    const overviewCo2El = document.getElementById("overview-co2");
    if (statCo2El) statCo2El.textContent = co2Val;
    if (overviewCo2El) overviewCo2El.textContent = co2Val;

    impactBanner.style.display = "grid";
    if (data.full_count === 1) {
      const stopName = (data.optimized.stops && data.optimized.stops[0]) ? data.optimized.stops[0].name : "Bin";
      summary.innerHTML = `Single site urgent pickup for <strong>${stopName}</strong>: <strong>${optKm.toFixed(1)} km</strong> (${data.optimized.duration_min} min drive round-trip). Direct dispatch from Guindy Central Depot.`;
    } else {
      summary.innerHTML = `Route solved: <strong>${optKm.toFixed(1)} km</strong> (${data.optimized.duration_min} min drive). Saved <strong>${kmSaved.toFixed(1)} km</strong> and <strong>${data.fuel_saved_l} L</strong> diesel.`;
    }

    showToast(
      "success",
      "Route Solved & Dispatched",
      `Saved ${kmSaved.toFixed(1)} km & ${data.fuel_saved_l} L diesel across ${data.full_count} sites.`
    );

    // Render Itinerary Lists
    document.getElementById("itinerary-opt-km").textContent = optKm.toFixed(1);
    document.getElementById("itinerary-opt-time").textContent = data.optimized.duration_min;
    document.getElementById("itinerary-naive-km").textContent = naiveKm.toFixed(1);
    document.getElementById("itinerary-naive-time").textContent = data.naive.duration_min;

    const optList = document.getElementById("opt-stops-list");
    const naiveList = document.getElementById("naive-stops-list");

    optList.innerHTML = (data.optimized.stops || [])
      .map((s, idx) => {
        const isRep = s.source_type === "report";
        const badge = isRep
          ? '<span class="badge badge-info" style="font-size:0.7rem;padding:2px 6px;">CITIZEN REPORT</span>'
          : '<span class="badge badge-warn" style="font-size:0.7rem;padding:2px 6px;">HIGH-FILL BIN</span>';
        const reasonHtml = s.reason
          ? `<div style="font-size:0.78rem;color:#64748b;margin-top:3px;line-height:1.35;">${s.reason}</div>`
          : "";
        const completeBtn = `<button type="button" class="btn btn-ghost btn-sm" style="font-size:0.72rem;padding:2px 8px;margin-top:6px;" onclick="window.completeTaskStop('${s.id}')">✓ Mark Stop Collected</button>`;
        return `<li style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <strong>#${idx + 1}: ${s.name}</strong>
            ${badge}
          </div>
          ${reasonHtml}
          ${completeBtn}
        </li>`;
      })
      .join("") + `<li><strong>⚑ Return</strong>: Guindy Central Depot</li>`;

    naiveList.innerHTML = (data.naive.stops || [])
      .map((s, idx) => `<li><strong>#${idx + 1}</strong>: ${s.name} <span class="hint">(${s.fill_percent.toFixed(0)}% fill)</span></li>`)
      .join("") + `<li><strong>⚑ Return</strong>: Guindy Central Depot</li>`;

    // Render AI Route Suggestion Card
    const aiBox = document.getElementById("ai-route-suggestion-box");
    if (aiBox && data.ai_suggestion) {
      const titleEl = document.getElementById("ai-suggestion-title");
      const ratEl = document.getElementById("ai-suggestion-rationale");
      if (titleEl) titleEl.textContent = data.ai_suggestion.title || "AI Route Advisor";
      if (ratEl) ratEl.textContent = data.ai_suggestion.rationale || "";
      const btn = document.getElementById("btn-accept-ai-suggestion");
      if (btn) {
        btn.innerHTML = "<i data-lucide='check'></i> Accept AI Suggestion";
        btn.classList.add("btn-primary");
        btn.classList.remove("btn-secondary");
        btn.disabled = false;
      }
      aiBox.style.display = "block";
    }

    itineraryBox.style.display = "block";
    renderIcons();

    // Setup Truck Simulator on Route Optimizer map
    truckRoutePoints = optPoints;
    truckCurrentIndex = 0;
    if (truckRoutePoints.length > 0) {
      if (!truckMarker) {
        truckMarker = L.marker(truckRoutePoints[0], {
          icon: L.divIcon({
            html: `<div class="truck-map-marker">🚚</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(routeMap);
      } else {
        truckMarker.setLatLng(truckRoutePoints[0]);
      }
      animToolbar.style.display = "flex";
      document.getElementById("truck-status-text").textContent = `Ready at Depot (0 / ${truckRoutePoints.length} waypoints)`;
    }
  } catch (err) {
    if (activeRouteTween) {
      activeRouteTween.kill();
      activeRouteTween = null;
    }
    if (naiveLine) { routeMap.removeLayer(naiveLine); naiveLine = null; }
    if (optLine) { routeMap.removeLayer(optLine); optLine = null; }
    stopTruckAnimation();
    if (truckMarker) {
      routeMap.removeLayer(truckMarker);
      truckMarker = null;
    }
    summary.textContent = `Route optimization error: ${err.message}`;
    itineraryBox.style.display = "none";
    animToolbar.style.display = "none";
    impactBanner.style.display = "none";
  }
});

document.getElementById("btn-clear-route").addEventListener("click", () => {
  if (activeRouteTween) {
    activeRouteTween.kill();
    activeRouteTween = null;
  }
  if (naiveLine) routeMap.removeLayer(naiveLine);
  if (optLine) routeMap.removeLayer(optLine);
  naiveLine = null;
  optLine = null;
  stopTruckAnimation();
  if (truckMarker) {
    routeMap.removeLayer(truckMarker);
    truckMarker = null;
  }
  document.getElementById("route-summary").textContent = "Route cleared.";
  document.getElementById("route-itinerary").style.display = "none";
  document.getElementById("truck-anim-toolbar").style.display = "none";
  document.getElementById("route-impact-banner").style.display = "none";
});

// -------------------------------------------------------------
// Animated Truck Traversal Engine
// -------------------------------------------------------------
function stepTruckAnimation() {
  if (!isTruckPlaying || !truckMarker || truckRoutePoints.length === 0) return;

  truckCurrentIndex += truckSpeed;
  if (truckCurrentIndex >= truckRoutePoints.length) {
    truckCurrentIndex = truckRoutePoints.length - 1;
    truckMarker.setLatLng(truckRoutePoints[truckCurrentIndex]);
    document.getElementById("truck-status-text").textContent = "✓ Collection Run Finished — Returned to Depot";
    stopTruckAnimation();
    return;
  }

  const curPos = truckRoutePoints[truckCurrentIndex];
  truckMarker.setLatLng(curPos);

  const pct = Math.round((truckCurrentIndex / truckRoutePoints.length) * 100);
  document.getElementById("truck-status-text").textContent = `Cruising along Chennai streets (${pct}%) · Speed: ${truckSpeed * 25} km/h`;

  truckAnimationId = requestAnimationFrame(stepTruckAnimation);
}

function startTruckAnimation() {
  isTruckPlaying = true;
  document.getElementById("btn-truck-play").style.display = "none";
  document.getElementById("btn-truck-pause").style.display = "inline-flex";
  truckAnimationId = requestAnimationFrame(stepTruckAnimation);
}

function stopTruckAnimation() {
  isTruckPlaying = false;
  if (truckAnimationId) {
    cancelAnimationFrame(truckAnimationId);
    truckAnimationId = null;
  }
  document.getElementById("btn-truck-play").style.display = "inline-flex";
  document.getElementById("btn-truck-pause").style.display = "none";
}

document.getElementById("btn-truck-play").addEventListener("click", startTruckAnimation);
document.getElementById("btn-truck-pause").addEventListener("click", stopTruckAnimation);
document.getElementById("btn-truck-reset").addEventListener("click", () => {
  stopTruckAnimation();
  truckCurrentIndex = 0;
  if (truckMarker && truckRoutePoints.length > 0) {
    truckMarker.setLatLng(truckRoutePoints[0]);
    document.getElementById("truck-status-text").textContent = "Reset to Guindy Depot";
  }
});
document.getElementById("truck-speed").addEventListener("input", (e) => {
  truckSpeed = parseInt(e.target.value) || 2;
});

// -------------------------------------------------------------
// Interactive Ultrasonic Sonar / Radar Canvas
// -------------------------------------------------------------
const sonarCanvas = document.getElementById("sonar-canvas");
const sonarCtx = sonarCanvas.getContext("2d");
let sonarWaveOffset = 0;

function drawSonar() {
  const w = sonarCanvas.width;
  const h = sonarCanvas.height;
  sonarCtx.clearRect(0, 0, w, h);

  // Background Grid
  sonarCtx.strokeStyle = "rgba(2, 132, 199, 0.08)";
  sonarCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 25) {
    sonarCtx.beginPath();
    sonarCtx.moveTo(x, 0);
    sonarCtx.lineTo(x, h);
    sonarCtx.stroke();
  }

  // Ultrasonic Sensor Emitter (Left)
  sonarCtx.fillStyle = "#0284c7";
  sonarCtx.fillRect(10, h / 2 - 20, 16, 40);
  sonarCtx.fillStyle = "#0369a1";
  sonarCtx.beginPath();
  sonarCtx.arc(26, h / 2 - 10, 8, 0, Math.PI * 2);
  sonarCtx.arc(26, h / 2 + 10, 8, 0, Math.PI * 2);
  sonarCtx.fill();

  // Target Barrier (obstacle representing fill surface in the bin)
  const realBin = allBins.find((b) => b.is_real || b.id === "gymd");
  const fillPct = (typeof liveHardwareFill === "number") ? liveHardwareFill : (realBin ? realBin.fill_percent : 18.0);
  // Bin height = 50cm. Distance = (1 - fill%) * 50cm
  // Mapping distance (0cm to 50cm) to Canvas X (60px to 300px)
  const distFraction = Math.max(0.05, 1.0 - fillPct / 100.0);
  const barrierX = 50 + distFraction * 260;

  // Draw Waste Obstacle Barrier
  const barrierColor = fillColor(fillPct);
  sonarCtx.fillStyle = barrierColor;
  sonarCtx.fillRect(barrierX, 20, 14, h - 40);

  // Radiating Ultrasonic Sound Waves
  sonarWaveOffset = (sonarWaveOffset + 1.2) % 35;
  for (let r = sonarWaveOffset; r < barrierX - 30; r += 35) {
    const alpha = Math.max(0, 1.0 - r / (barrierX - 25));
    sonarCtx.strokeStyle = `rgba(2, 132, 199, ${alpha * 0.75})`;
    sonarCtx.lineWidth = 2.5;
    sonarCtx.beginPath();
    sonarCtx.arc(26, h / 2, r, -Math.PI / 4, Math.PI / 4);
    sonarCtx.stroke();
  }

  // Reflected Echo Waves (returning from barrier)
  for (let r = 15; r < 70; r += 25) {
    const echoR = (r + sonarWaveOffset * 0.8) % 80;
    sonarCtx.strokeStyle = `rgba(225, 29, 72, ${Math.max(0, 0.6 - echoR / 80)})`;
    sonarCtx.lineWidth = 2;
    sonarCtx.beginPath();
    sonarCtx.arc(barrierX, h / 2, echoR, (3 * Math.PI) / 4, (5 * Math.PI) / 4);
    sonarCtx.stroke();
  }

  // Distance Measurement Line
  sonarCtx.strokeStyle = "rgba(15, 23, 42, 0.25)";
  sonarCtx.setLineDash([4, 4]);
  sonarCtx.beginPath();
  sonarCtx.moveTo(26, h - 18);
  sonarCtx.lineTo(barrierX, h - 18);
  sonarCtx.stroke();
  sonarCtx.setLineDash([]);

  requestAnimationFrame(drawSonar);
}
requestAnimationFrame(drawSonar);

// -------------------------------------------------------------
// Physical Sensor Controls (Reactive Digital Twin & Presets)
// -------------------------------------------------------------
let liveHardwareFill = 18.0;
let hardwareSyncTimeout = null;
let buzzerAudioCtx = null;
let lastBuzzerPlayTime = 0;

function playBuzzerAudio() {
  const now = Date.now();
  if (now - lastBuzzerPlayTime < 900) return;
  lastBuzzerPlayTime = now;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!buzzerAudioCtx) buzzerAudioCtx = new AudioCtx();
    if (buzzerAudioCtx.state === "suspended") buzzerAudioCtx.resume();
    const osc = buzzerAudioCtx.createOscillator();
    const gain = buzzerAudioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(880, buzzerAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.12, buzzerAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, buzzerAudioCtx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(buzzerAudioCtx.destination);
    osc.start();
    osc.stop(buzzerAudioCtx.currentTime + 0.22);
  } catch (e) {}
}

function syncHardwareTelemetryState(fill, triggerNetwork = true) {
  liveHardwareFill = Math.max(0.0, Math.min(100.0, parseFloat(fill) || 0.0));

  // 1. Instantly update in-memory bin for immediate UI reactivity
  const realBin = allBins.find((b) => b.is_real || b.id === "gymd");
  if (realBin) {
    realBin.fill_percent = liveHardwareFill;
  }

  // 2. Immediate card telemetry numbers & alarm status
  const valSpan = document.getElementById("real-bin-fill-val");
  const distSpan = document.getElementById("sonar-distance-val");
  const statusSpan = document.getElementById("real-bin-status");
  const slider = document.getElementById("real-bin-slider");

  if (valSpan) valSpan.textContent = `${liveHardwareFill.toFixed(1)}%`;
  const distanceCm = Math.max(0.0, (1.0 - liveHardwareFill / 100.0) * 50.0);
  if (distSpan) distSpan.textContent = `${distanceCm.toFixed(1)} cm`;

  if (statusSpan) {
    if (liveHardwareFill >= 90) {
      statusSpan.textContent = "ALARM (BUZZER ON)";
      statusSpan.className = "sonar-reading reading-alert";
      playBuzzerAudio();
    } else if (liveHardwareFill >= 70) {
      statusSpan.textContent = "WARNING (NEED PICKUP)";
      statusSpan.className = "sonar-reading reading-warn";
    } else {
      statusSpan.textContent = "ONLINE (ULTRASONIC READY)";
      statusSpan.className = "sonar-reading reading-normal";
    }
  }

  if (slider && document.activeElement !== slider) {
    slider.value = liveHardwareFill;
  }

  // 3. Highlight matching preset pill
  document.querySelectorAll(".preset-pill-row .btn-pill").forEach((btn) => {
    if (btn.id === "btn-oscillate") return;
    const btnVal = parseFloat(btn.getAttribute("data-val"));
    if (Math.abs(btnVal - liveHardwareFill) < 1.0) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // 4. Update the pinned table row at the top of the table in real time
  renderTable();

  // 5. Update hero metrics & markers
  renderStats();
  if (typeof updateMarkers === "function") {
    updateMarkers(allBins);
  }

  // 6. Network sync with backend (debounced)
  if (triggerNetwork) {
    clearTimeout(hardwareSyncTimeout);
    hardwareSyncTimeout = setTimeout(async () => {
      try {
        await jpost("/bins/gymd/update", { fill_percent: liveHardwareFill });
        checkFillThresholds(allBins);
      } catch (err) {
        console.warn("Hardware telemetry sync failed:", err.message);
      }
    }, 100);
  }
}

const realSlider = document.getElementById("real-bin-slider");
if (realSlider) {
  realSlider.addEventListener("input", (e) => {
    syncHardwareTelemetryState(e.target.value, false);
  });
  realSlider.addEventListener("change", (e) => {
    syncHardwareTelemetryState(e.target.value, true);
  });
}

document.querySelectorAll(".preset-pill-row .btn-pill").forEach((btn) => {
  if (btn.id === "btn-oscillate") return;
  btn.addEventListener("click", () => {
    const val = parseFloat(btn.getAttribute("data-val"));
    if (realSlider) realSlider.value = val;
    syncHardwareTelemetryState(val, true);
  });
});

const oscillateBtn = document.getElementById("btn-oscillate");
if (oscillateBtn) {
  oscillateBtn.addEventListener("click", () => {
    isOscillating = !isOscillating;
    if (isOscillating) {
      oscillateBtn.textContent = "∿ Wave Oscillation: ON";
      oscillateBtn.classList.add("active");
      oscillateTimer = setInterval(() => {
        oscillatePhase += 0.35;
        const fill = 55 + 38 * Math.sin(oscillatePhase);
        syncHardwareTelemetryState(fill.toFixed(1), true);
      }, 3000);
    } else {
      oscillateBtn.textContent = "∿ Wave Oscillation: OFF";
      oscillateBtn.classList.remove("active");
      clearInterval(oscillateTimer);
    }
  });
}

// -------------------------------------------------------------
// Simulation Buttons (Mast)
// -------------------------------------------------------------
document.getElementById("btn-drift-step").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await jpost("/simulate/step");
    await refresh();
  } catch (err) {
    console.error("Simulation drift failed:", err);
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("btn-collect-bins").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const threshold = parseFloat(document.getElementById("route-threshold").value) || 70.0;
    const res = await jpost(`/simulate/collect?threshold=${threshold}`);
    await refresh();
    alert(`Dispatched Collection: Emptied ${res.count} overflowing bins across Chennai.`);
  } catch (err) {
    alert(`Collection dispatch failed: ${err.message}`);
  } finally {
    btn.disabled = false;
  }
});

// -------------------------------------------------------------
// Table Filters
// -------------------------------------------------------------
document.querySelectorAll(".btn-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".btn-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.getAttribute("data-filter");
    renderTable();
  });
});

document.getElementById("bin-search").addEventListener("input", (e) => {
  searchTerm = e.target.value.trim();
  renderTable();
});

// -------------------------------------------------------------
// Vision Classifier: Samples, Upload, and Live Webcam
// -------------------------------------------------------------
const tabSamples = document.getElementById("tab-samples");
const tabUpload = document.getElementById("tab-upload");
const tabWebcam = document.getElementById("tab-webcam");
const viewSamples = document.getElementById("view-samples");
const viewUpload = document.getElementById("view-upload");
const viewWebcam = document.getElementById("view-webcam");

function switchVisionTab(activeBtn, activeView) {
  [tabSamples, tabUpload, tabWebcam].forEach((b) => b.classList.remove("active"));
  [viewSamples, viewUpload, viewWebcam].forEach((v) => (v.style.display = "none"));
  activeBtn.classList.add("active");
  activeView.style.display = "block";
}

tabSamples.addEventListener("click", () => {
  stopWebcam();
  switchVisionTab(tabSamples, viewSamples);
});
tabUpload.addEventListener("click", () => {
  stopWebcam();
  switchVisionTab(tabUpload, viewUpload);
});
tabWebcam.addEventListener("click", () => {
  switchVisionTab(tabWebcam, viewWebcam);
  startWebcam();
});

async function loadSamples() {
  try {
    const samples = await jget("/samples");
    const container = document.getElementById("sample-buttons");
    if (!container) return;

    const emojiMap = { plastic: "🧴", paper: "📄", glass: "🍾", organic: "🍌", metal: "🍳" };
    container.innerHTML = samples
      .map(
        (s) => `
      <button type="button" class="btn-chip" data-url="${s.url}" data-name="${s.name}" data-cat="${s.category}">
        ${emojiMap[s.category] || "📦"} ${s.category.toUpperCase()}
      </button>
    `
      )
      .join("");

    container.querySelectorAll(".btn-chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        const url = chip.getAttribute("data-url");
        const name = chip.getAttribute("data-name");
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          selectedFile = new File([blob], `${name}.jpg`, { type: "image/jpeg" });
          displayImagePreview(URL.createObjectURL(blob));
          runClassification(selectedFile);
        } catch (err) {
          const resultBox = document.getElementById("classify-result-box");
          resultBox.style.display = "block";
          document.getElementById("result-category").textContent = "Sample Load Error";
          document.getElementById("result-conf").textContent = "Error";
          document.getElementById("conf-bar").style.width = "0%";
          document.getElementById("result-disposal-tip").textContent = `Could not fetch demo sample: ${err.message}`;
        }
      });
    });
  } catch (err) {
    console.error("Samples load failed", err);
  }
}

function displayImagePreview(src) {
  const previewImg = document.getElementById("preview-img");
  previewImg.src = src;
  document.getElementById("preview-wrapper").style.display = "flex";
}

function resetImagePreview() {
  selectedFile = null;
  document.getElementById("image-input").value = "";
  document.getElementById("preview-wrapper").style.display = "none";
  document.getElementById("classify-result-box").style.display = "none";
}

document.getElementById("btn-clear-preview").addEventListener("click", resetImagePreview);

// Drag & Drop
const dropZone = document.getElementById("drop-zone");
["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});
dropZone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);
    if (!isImage || file.type.includes("svg") || /\.svg$/i.test(file.name)) {
      const resultBox = document.getElementById("classify-result-box");
      resultBox.style.display = "block";
      document.getElementById("result-category").textContent = "Unsupported File";
      document.getElementById("result-conf").textContent = "Invalid Format";
      document.getElementById("conf-bar").style.width = "0%";
      document.getElementById("result-disposal-tip").textContent = "Please drop a valid raster image file (JPEG, PNG, WEBP). Vector images (SVG) and non-images are not supported.";
      return;
    }
    selectedFile = file;
    displayImagePreview(URL.createObjectURL(file));
    runClassification(file);
  }
});

document.getElementById("image-input").addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    selectedFile = file;
    displayImagePreview(URL.createObjectURL(file));
  }
});

document.getElementById("btn-classify").addEventListener("click", () => {
  if (selectedFile) runClassification(selectedFile);
});

// Live Webcam
async function startWebcam() {
  const video = document.getElementById("webcam-video");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Camera access is not supported in this browser environment (requires localhost or HTTPS).");
    return;
  }
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "environment" },
    });
    video.srcObject = webcamStream;
  } catch (err) {
    alert("Camera permission denied or camera not available: " + err.message);
  }
}

function stopWebcam() {
  if (webcamStream) {
    webcamStream.getTracks().forEach((t) => t.stop());
    webcamStream = null;
  }
}

document.getElementById("btn-stop-webcam").addEventListener("click", () => {
  stopWebcam();
  switchVisionTab(tabSamples, viewSamples);
});

document.getElementById("btn-capture-webcam").addEventListener("click", () => {
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("webcam-canvas");
  if (!video.videoWidth) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    selectedFile = new File([blob], "webcam-snapshot.jpg", { type: "image/jpeg" });
    displayImagePreview(URL.createObjectURL(blob));
    runClassification(selectedFile);
  }, "image/jpeg", 0.9);
});

// Inference Runner
async function runClassification(file) {
  const resultBox = document.getElementById("classify-result-box");
  const catEl = document.getElementById("result-category");
  const confEl = document.getElementById("result-conf");
  const confBar = document.getElementById("conf-bar");
  const tipEl = document.getElementById("result-disposal-tip");

  if (!file) return;

  // Client-side file format check
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);
  if (!isImage || file.type.includes("svg") || /\.svg$/i.test(file.name)) {
    resultBox.style.display = "block";
    catEl.textContent = "Unsupported File";
    confEl.textContent = "Invalid Format";
    confBar.style.width = "0%";
    tipEl.textContent = "Please provide a standard photo (JPEG, PNG, WEBP). Vector images (SVG) and non-images are not supported.";
    return;
  }

  // Client-side file size check (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    resultBox.style.display = "block";
    catEl.textContent = "File Too Large";
    confEl.textContent = "413 Limit";
    confBar.style.width = "0%";
    tipEl.textContent = `Selected file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed upload size is 10 MB.`;
    return;
  }

  resultBox.style.display = "block";
  catEl.textContent = "Inferencing…";
  confEl.textContent = "—";
  confBar.style.width = "0%";
  tipEl.textContent = "";

  const fd = new FormData();
  fd.append("file", file);

  try {
    const r = await fetch(`${API}/classify`, { method: "POST", body: fd });
    if (!r.ok) {
      let errorMsg = `Server error (${r.status})`;
      try {
        const errJson = await r.json();
        if (errJson && errJson.detail) errorMsg = errJson.detail;
      } catch {
        const text = await r.text();
        if (text) errorMsg = text.slice(0, 150);
      }
      catEl.textContent = "Classification Error";
      confEl.textContent = `HTTP ${r.status}`;
      confBar.style.width = "0%";
      tipEl.textContent = errorMsg;
      return;
    }
    const data = await r.json();
    const pct = Math.round(data.confidence * 100);
    catEl.textContent = data.category.toUpperCase();
    confEl.textContent = `${pct}% confidence`;
    confBar.style.width = `${pct}%`;

    const tips = {
      plastic: "Recyclable (Blue Bin) — Rinse containers and remove caps.",
      paper: "Recyclable (Green Bin) — Keep dry and flatten before disposal.",
      glass: "Recyclable (Cyan Bin) — Dispose unbroken; rinse thoroughly.",
      metal: "Recyclable (Yellow Bin) — Crush aluminum cans; magnetic sorting.",
      organic: "Compostable (Brown Bin) — Food scraps & wet organic waste.",
      cardboard: "Recyclable (Green Bin) — Flatten boxes to conserve bin volume.",
      trash: "Non-Recyclable Landfill (Red Bin) — Municipal incineration/sanitary landfill.",
    };
    tipEl.textContent = tips[data.category] || "Route to appropriate segregation stream.";

    showToast("success", "Item Classified", `Detected: ${data.category.toUpperCase()} (${pct}% confidence)`);

    await refreshChart();
  } catch (err) {
    catEl.textContent = "Network Error";
    confEl.textContent = "Failed";
    confBar.style.width = "0%";
    tipEl.textContent = `Could not contact classification server: ${err.message}`;
  }
}

// -------------------------------------------------------------
// -------------------------------------------------------------
// Academic Viva Defense (Modal + Embedded Analytics Section)
// -------------------------------------------------------------
const vivaModal = document.getElementById("viva-modal");
let cachedVivaMetrics = null;

async function loadVivaMetrics() {
  try {
    if (!cachedVivaMetrics) {
      cachedVivaMetrics = await jget("/analytics/viva-metrics");
    }
    const metrics = cachedVivaMetrics;

    // Update KPI Badges in Modal and Embedded Analytics View
    const vivaBackbone = document.getElementById("viva-backbone");
    if (vivaBackbone) vivaBackbone.textContent = metrics.model.name;
    const vivaAcc = document.getElementById("viva-accuracy");
    if (vivaAcc) vivaAcc.textContent = `${(metrics.model.overall_accuracy * 100).toFixed(1)}%`;
    const vivaF1 = document.getElementById("viva-f1");
    if (vivaF1) vivaF1.textContent = metrics.model.macro_f1.toFixed(3);
    const vivaLat = document.getElementById("viva-latency");
    if (vivaLat) vivaLat.textContent = `${metrics.model.latency_ms} ms`;

    // Render 7x7 Confusion Matrix for both embedded table and modal table
    const matrixTables = [
      document.getElementById("confusion-matrix-table"),
      document.getElementById("analytics-confusion-table"),
    ].filter(Boolean);

    const classes = metrics.classes;
    const matrix = metrics.confusion_matrix;

    const headerHtml = `<tr><th>Ground \\ Pred</th>${classes.map((c) => `<th>${c.slice(0, 4)}</th>`).join("")}</tr>`;
    const rowsHtml = matrix
      .map((row, rIdx) => `<tr>
        <th>${classes[rIdx]}</th>
        ${row.map((val, cIdx) => `<td class="${rIdx === cIdx ? "matrix-cell-diag" : ""}">${val}</td>`).join("")}
      </tr>`)
      .join("");

    matrixTables.forEach((t) => (t.innerHTML = headerHtml + rowsHtml));

    // Render Per-Class Report for both embedded and modal tables
    const repTables = [
      document.getElementById("viva-metrics-tbody"),
      document.getElementById("analytics-metrics-tbody"),
    ].filter(Boolean);

    const repRowsHtml = classes
      .map((c) => {
        const row = metrics.classification_report[c];
        return `<tr>
          <td><strong style="color:var(--color-primary);">${c.toUpperCase()}</strong></td>
          <td>${(row.precision * 100).toFixed(1)}%</td>
          <td>${(row.recall * 100).toFixed(1)}%</td>
          <td><strong style="color:var(--color-safe);">${row.f1.toFixed(2)}</strong></td>
          <td>${row.support}</td>
        </tr>`;
      })
      .join("");

    repTables.forEach((t) => (t.innerHTML = repRowsHtml));
    renderIcons();
  } catch (err) {
    console.error("Failed to load viva metrics", err);
  }
}

document.getElementById("btn-viva-modal").addEventListener("click", async () => {
  vivaModal.style.display = "flex";
  await loadVivaMetrics();
});

document.getElementById("btn-close-modal").addEventListener("click", () => {
  vivaModal.style.display = "none";
});
vivaModal.addEventListener("click", (e) => {
  if (e.target === vivaModal) vivaModal.style.display = "none";
});

// -------------------------------------------------------------
// Citizen Reporting Form
// -------------------------------------------------------------
const reportFormEl = document.getElementById("report-form");
if (reportFormEl) {
  reportFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    const binId = document.getElementById("report-bin")?.value;
    const msg = document.getElementById("report-msg")?.value?.trim();
    if (!binId || !msg) return;

    const submitBtn = e.target.querySelector("button[type=submit]");
    const originalText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Filing Report...";
    }

    try {
      await jpost("/reports", { bin_id: binId, message: msg });
      const msgInput = document.getElementById("report-msg");
      if (msgInput) msgInput.value = "";
      await refreshReports();
    } catch (err) {
      alert(`Failed to file community report: ${err.message}`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

// -------------------------------------------------------------
// Single-Page Application (SPA) Hash Router
// -------------------------------------------------------------
const VALID_ROUTES = ["overview", "bins", "classifier", "optimizer", "analytics"];

function switchView(route) {
  VALID_ROUTES.forEach((r) => {
    const viewEl = document.getElementById(`view-${r}`);
    const navEl = document.getElementById(`nav-${r}`);
    const isActive = (r === route);
    if (viewEl) {
      if (isActive) {
        viewEl.style.display = "block";
        viewEl.classList.add("active");
      } else {
        viewEl.style.display = "none";
        viewEl.classList.remove("active");
      }
    }
    if (navEl) {
      navEl.classList.toggle("active", isActive);
    }
  });

  // Camera cleanup if leaving classifier
  if (route !== "classifier" && webcamStream) {
    stopWebcam();
  }

  // Route animation cleanup if leaving optimizer
  if (route !== "optimizer" && activeRouteTween) {
    activeRouteTween.kill();
    activeRouteTween = null;
  }

  // View-specific activation
  if (route === "overview") {
    renderOverview();
  } else {
    if (route === "bins") {
      setTimeout(() => {
        if (map) map.invalidateSize();
      }, 60);
    } else if (route === "optimizer") {
      setTimeout(() => {
        if (routeMap) routeMap.invalidateSize();
      }, 60);
    } else if (route === "analytics") {
      setTimeout(() => {
        if (chart) chart.resize();
      }, 60);
      renderAnalyticsPredictions(allPredictions);
      loadVivaMetrics();
    }
  }

  renderIcons();
}

function handleRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "").toLowerCase();
  const route = VALID_ROUTES.includes(raw) ? raw : "overview";
  if (!window.location.hash || window.location.hash === "#" || window.location.hash === "#/") {
    history.replaceState(null, "", "#/overview");
  }
  switchView(route);
}

window.addEventListener("hashchange", handleRoute);

// -------------------------------------------------------------
// Initialization & Polling
// -------------------------------------------------------------
refresh();
refreshChart();
refreshReports();
loadSamples();
loadVivaMetrics();
handleRoute();
setInterval(refresh, 8000);
setInterval(refreshReports, 4000);



