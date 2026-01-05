export interface VehiclePosition {
  vehicleId: string;
  lineId: string;
  direction: string;
  latitude: number;
  longitude: number;
  delay: string;
  recordedAtTime: string;
  validUntilTime: string;
  destinationName: string;
  dataSource: string;
  bearing: number;
  vehicleStatus: string;
}

export interface Passage {
  id: string;
  ligne: string;
  direction: string;
  delaipassage: string;
  type: string;
  heurepassage: string;
  idtarretdestination: number;
  coursetheorique: string;
  gid: number;
  last_update_fme: string;
}

export interface StopInfo {
  id: number;
  name: string;
  latlng: [number, number];
}

export interface VehicleData {
  vehicles: VehiclePosition[];
  apiResponseTimestamp: string;
  lastFetchTime: string;
  apiStatus?: string;
}
