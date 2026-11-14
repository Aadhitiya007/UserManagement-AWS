import { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, Search, Loader2 } from "lucide-react";

function loadLeafletAssets() {
  return new Promise((resolve) => {
    if (window.L) {
      resolve(window.L);
      return;
    }

    // 1. Inject Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // 2. Inject Leaflet JS
    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve(window.L);
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.L) {
          clearInterval(checkInterval);
          resolve(window.L);
        }
      }, 50);
    }
  });
}

function MapLocationPicker({ initialLocation, onAddressResolved }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [resolvedSummary, setResolvedSummary] = useState("");
  const [currentCoords, setCurrentCoords] = useState(
    initialLocation || { lat: 12.9716, lng: 77.5946 } // Default to Bengaluru / India
  );

  // Initialize Map
  useEffect(() => {
    let isMounted = true;

    loadLeafletAssets().then((L) => {
      if (!isMounted || !L || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const startLat = currentCoords.lat;
        const startLng = currentCoords.lng;

        const map = L.map(mapContainerRef.current, {
          center: [startLat, startLng],
          zoom: 15,
          zoomControl: true
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(map);

        // Custom Red Delivery Pin Icon
        const deliveryIcon = L.icon({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        const marker = L.marker([startLat, startLng], {
          draggable: true,
          icon: deliveryIcon
        }).addTo(map);

        marker.bindPopup("<b>Delivery Destination</b><br>Drag pin to fine-tune doorstep.").openPopup();

        marker.on("dragend", async () => {
          const pos = marker.getLatLng();
          setCurrentCoords({ lat: pos.lat, lng: pos.lng });
          await reverseGeocode(pos.lat, pos.lng);
        });

        map.on("click", async (e) => {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          setCurrentCoords({ lat, lng });
          await reverseGeocode(lat, lng);
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
      }

      setLoadingMap(false);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Reverse Geocode: GPS -> Street, City, State, PIN
  async function reverseGeocode(lat, lng) {
    try {
      setGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (!res.ok) throw new Error("Could not reverse geocode location");
      const data = await res.json();
      const addr = data.address || {};

      const street = [
        addr.house_number,
        addr.road || addr.street || addr.pedestrian,
        addr.suburb || addr.neighbourhood || addr.quarter
      ]
        .filter(Boolean)
        .join(", ");

      const city = addr.city || addr.town || addr.village || addr.county || "";
      const state = addr.state || "";
      const pinCode = addr.postcode || "";

      const summary = data.display_name ? data.display_name.split(",").slice(0, 3).join(",") : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      setResolvedSummary(summary);

      if (onAddressResolved) {
        onAddressResolved({
          street: street || summary,
          city,
          state,
          pinCode,
          location: { lat, lng },
          displayName: summary
        });
      }
    } catch (err) {
      console.warn("Reverse geocode notice:", err.message);
    } finally {
      setGeocoding(false);
    }
  }

  // Detect GPS Live Location
  function handleDetectCurrentLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
          markerRef.current.setLatLng([lat, lng]);
          markerRef.current.bindPopup("<b>📍 Current Live Location</b>").openPopup();
        }

        await reverseGeocode(lat, lng);
        setDetectingLocation(false);
      },
      (err) => {
        setDetectingLocation(false);
        alert(`Location access notice: ${err.message || "Please allow location permission in your browser."}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Search Address / Landmark
  async function handleSearchLocation(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const item = results[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        setCurrentCoords({ lat, lng });

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
          markerRef.current.setLatLng([lat, lng]);
        }
        await reverseGeocode(lat, lng);
      } else {
        alert("Location not found. Please try another area or pin directly on the map.");
      }
    } catch (err) {
      alert("Search failed: " + err.message);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        overflow: "hidden",
        backgroundColor: "var(--color-surface)",
        marginBottom: "16px"
      }}
    >
      {/* Top Controls Bar */}
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          backgroundColor: "var(--color-surface-subtle)",
          borderBottom: "1px solid var(--color-border)",
          flexWrap: "wrap"
        }}
      >
        <button
          type="button"
          onClick={handleDetectCurrentLocation}
          disabled={detectingLocation}
          className="btn btn-primary btn-sm"
          style={{
            fontSize: "0.8rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            height: "32px",
            whiteSpace: "nowrap"
          }}
        >
          {detectingLocation ? (
            <Loader2 size={13} className="spin" />
          ) : (
            <Navigation size={13} fill="currentColor" />
          )}
          <span>{detectingLocation ? "Detecting GPS..." : "Use Current Location"}</span>
        </button>

        <form
          onSubmit={handleSearchLocation}
          style={{ flex: 1, display: "flex", gap: "6px", minWidth: "180px" }}
        >
          <input
            type="text"
            className="form-control"
            placeholder="Search landmark, area, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: "0.8rem", height: "32px", padding: "4px 8px" }}
          />
          <button
            type="submit"
            className="btn btn-secondary btn-sm"
            disabled={searching || !searchQuery.trim()}
            style={{ height: "32px", padding: "0 10px" }}
          >
            {searching ? <Loader2 size={12} className="spin" /> : <Search size={13} />}
          </button>
        </form>
      </div>

      {/* Interactive Map Canvas */}
      <div style={{ position: "relative", width: "100%", height: "240px" }}>
        {loadingMap && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.06)",
              zIndex: 10,
              fontSize: "0.85rem",
              color: "var(--color-text-secondary)"
            }}
          >
            <Loader2 size={18} className="spin" style={{ marginRight: "8px" }} /> Loading Interactive Map...
          </div>
        )}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%", zIndex: 1 }} />
      </div>

      {/* Live Geocoded Status Footer */}
      <div
        style={{
          padding: "8px 12px",
          backgroundColor: "var(--color-surface-subtle)",
          borderTop: "1px solid var(--color-border)",
          fontSize: "0.78rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          color: "var(--color-text-secondary)"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <MapPin size={13} color="var(--color-coral)" />
          {geocoding ? (
            <em>Pinning address from coordinates...</em>
          ) : resolvedSummary ? (
            <strong style={{ color: "var(--color-text-primary)" }}>{resolvedSummary}</strong>
          ) : (
            <span>Tap map or drag the pin to set your exact doorstep</span>
          )}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--color-text-muted)", flexShrink: 0, marginLeft: "8px" }}>
          {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}

export default MapLocationPicker;

