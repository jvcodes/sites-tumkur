"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon path issues
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }: { position: L.LatLng | null; setPosition: (p: L.LatLng) => void }) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom(), { animate: true, duration: 1.0 });
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker 
      position={position} 
      draggable={true} 
      eventHandlers={{
        dragend: (e) => {
          setPosition(e.target.getLatLng());
        }
      }}
    />
  );
}

export default function MapPicker({
  latitude,
  longitude,
  onLocationChange,
}: {
  latitude: string;
  longitude: string;
  onLocationChange: (lat: string, lng: string) => void;
}) {
  const defaultCenter = new L.LatLng(13.33, 77.10); // Default to Tumkur
  const [position, setPosition] = useState<L.LatLng | null>(null);

  useEffect(() => {
    if (latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude))) {
      setPosition(new L.LatLng(parseFloat(latitude), parseFloat(longitude)));
    }
  }, [latitude, longitude]);

  const handlePositionChange = (newPos: L.LatLng) => {
    setPosition(newPos);
    onLocationChange(newPos.lat.toFixed(6), newPos.lng.toFixed(6));
  };

  return (
    <div className="h-[300px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0">
      <MapContainer
        center={position || defaultCenter}
        zoom={12}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker position={position} setPosition={handlePositionChange} />
      </MapContainer>
    </div>
  );
}
