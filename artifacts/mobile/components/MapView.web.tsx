import { useListMarkers, type Marker } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  filter: Marker["type"] | "all";
  selected: Marker | null;
  onSelect: (m: Marker) => void;
  cityFilter?: string | null;
};

const TYPE_COLOR: Record<string, string> = {
  person: "#A78BFA",
  business: "#D4AF7A",
  project: "#F97316",
};

const TYPE_ICON_SVG: Record<string, string> = {
  person: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  business: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
  project: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
};

function makeIconHtml(type: string, isSelected: boolean): string {
  const color = TYPE_COLOR[type] ?? "#888";
  const icon = TYPE_ICON_SVG[type] ?? "";
  const bg = isSelected ? color : "#ffffff";
  const fg = isSelected ? "#ffffff" : color;
  const scale = isSelected ? 1.25 : 1;
  const shadow = isSelected
    ? `0 0 0 5px ${color}44, 0 6px 20px rgba(0,0,0,0.4)`
    : `0 2px 10px rgba(0,0,0,0.22)`;

  return `<div style="
    width:34px;height:34px;border-radius:50%;
    background:${bg};
    border:2.5px solid ${color};
    display:flex;align-items:center;justify-content:center;
    box-shadow:${shadow};
    cursor:pointer;
    transform:scale(${scale});
    transition:transform 0.18s ease, box-shadow 0.18s ease;
    color:${fg};
  ">${icon}</div>`;
}

function injectCSS() {
  if (typeof document === "undefined") return;
  if (document.getElementById("leaflet-css")) return;

  const link = document.createElement("link");
  link.id = "leaflet-css";
  link.rel = "stylesheet";
  link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
  document.head.appendChild(link);

  const style = document.createElement("style");
  style.textContent = `
    .leaflet-container { font-family: Inter, sans-serif; }
    .leaflet-control-attribution { font-size: 10px !important; }
    .leaflet-tooltip {
      background: rgba(15,15,15,0.9) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 12px !important;
      color: #fff !important;
      padding: 8px 13px !important;
      font-size: 12px !important;
      box-shadow: 0 6px 24px rgba(0,0,0,0.45) !important;
      backdrop-filter: blur(10px) !important;
    }
    .leaflet-tooltip-top:before { display: none !important; }
    .leaflet-div-icon { background: transparent !important; border: none !important; }
    .leaflet-control-zoom a {
      border-radius: 8px !important;
    }
  `;
  document.head.appendChild(style);
}

type LeafletInstance = { map: any; L: any };

export function AtlasMap({ filter, selected, onSelect, cityFilter }: Props) {
  const colors = useColors();
  const mapEl = useRef<any>(null);
  const instanceRef = useRef<LeafletInstance | null>(null);
  const leafletMarkersRef = useRef<Map<string, any>>(new Map());
  const { data: markers } = useListMarkers();

  // ── Init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mapEl.current) return;
    if (instanceRef.current) return;

    injectCSS();

    import("leaflet").then((mod) => {
      const L = mod.default ?? (mod as any);

      const map = L.map(mapEl.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 20,
        },
      ).addTo(map);

      instanceRef.current = { map, L };
    });

    return () => {
      if (instanceRef.current?.map) {
        instanceRef.current.map.remove();
        instanceRef.current = null;
        leafletMarkersRef.current.clear();
      }
    };
  }, []);

  // ── Fly-to selected marker ─────────────────────────────────────────────────
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !selected) return;
    if (selected.lat == null || selected.lng == null) return;
    instance.map.flyTo([selected.lat, selected.lng], 8, {
      animate: true,
      duration: 1.2,
    });
  }, [selected]);

  // ── Fly-to city filter ─────────────────────────────────────────────────────
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !cityFilter || !markers) return;
    const target = markers.find(
      (m) => m.city?.toLowerCase() === cityFilter.toLowerCase() &&
        m.lat != null && m.lng != null,
    );
    if (target && target.lat != null && target.lng != null) {
      instance.map.flyTo([target.lat, target.lng], 6, {
        animate: true,
        duration: 1.4,
      });
    }
  }, [cityFilter, markers]);

  // ── Render / update markers ────────────────────────────────────────────────
  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance || !markers) return;
    const { map, L } = instance;

    leafletMarkersRef.current.forEach((m) => m.remove());
    leafletMarkersRef.current.clear();

    const visible = markers.filter(
      (m) => filter === "all" || m.type === filter,
    );

    visible.forEach((markerData) => {
      if (markerData.lat == null || markerData.lng == null) return;

      const isSelected = selected?.id === markerData.id;

      const icon = L.divIcon({
        html: makeIconHtml(markerData.type, isSelected),
        className: "",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -22],
      });

      const lm = L.marker([markerData.lat, markerData.lng], { icon })
        .addTo(map)
        .bindTooltip(
          `<strong style="font-size:13px">${markerData.label}</strong>
           <div style="opacity:0.7;margin-top:3px;font-size:11px">
             ${markerData.city}&nbsp;·&nbsp;${markerData.meta}
           </div>
           <div style="opacity:0.55;margin-top:2px;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">
             ${markerData.type}
           </div>`,
          {
            permanent: false,
            direction: "top",
            offset: [0, -22],
            opacity: 1,
          },
        )
        .on("click", () => onSelect(markerData));

      leafletMarkersRef.current.set(markerData.id, lm);
    });
  }, [markers, filter, selected, onSelect]);

  return (
    <View
      style={[styles.wrap, { borderColor: colors.border }]}
    >
      {/* @ts-ignore — web-only div */}
      <div ref={mapEl} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    height: 420,
  },
});
