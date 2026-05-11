import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type LocationMapProps = {
  latitude: number
  longitude: number
  zoom?: number
  height?: number | string
}

function Recenter({ latitude, longitude, zoom }: { latitude: number; longitude: number; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], zoom, { animate: true })
  }, [latitude, longitude, zoom, map])
  return null
}

export function LocationMap({ latitude, longitude, zoom = 13, height = 200 }: LocationMapProps) {
  return (
    <div className="location-map" style={{ height, width: '100%', borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={DefaultIcon} />
        <Recenter latitude={latitude} longitude={longitude} zoom={zoom} />
      </MapContainer>
    </div>
  )
}
