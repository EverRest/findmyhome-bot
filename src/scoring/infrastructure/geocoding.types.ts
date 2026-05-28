export interface GeocodeResult {
  lat: number;
  lng: number;
}

export type GeocodeSource = 'nominatim' | 'photon';

export interface GeocodeHit extends GeocodeResult {
  source: GeocodeSource;
}

export interface GeocodeOptions {
  baseUrl?: string;
  minIntervalMs?: number;
  fallbackProvider?: 'photon';
  photonBaseUrl?: string;
}
