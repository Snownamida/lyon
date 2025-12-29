package com.github.snownamida.lyon_server.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class SiriResponse {
    @JsonProperty("Siri")
    private Siri siri;

    public Siri getSiri() {
        return siri;
    }

    public static class Siri {
        @JsonProperty("ServiceDelivery")
        private ServiceDelivery serviceDelivery;

        public ServiceDelivery getServiceDelivery() {
            return serviceDelivery;
        }
    }

    public static class ServiceDelivery {
        @JsonProperty("VehicleMonitoringDelivery")
        private List<VehicleMonitoringDelivery> vehicleMonitoringDelivery;

        public List<VehicleMonitoringDelivery> getVehicleMonitoringDelivery() {
            return vehicleMonitoringDelivery;
        }
    }

    public static class VehicleMonitoringDelivery {
        @JsonProperty("VehicleActivity")
        private List<VehicleActivity> vehicleActivity;

        public List<VehicleActivity> getVehicleActivity() {
            return vehicleActivity;
        }
    }

    public static class VehicleActivity {
        @JsonProperty("MonitoredVehicleJourney")
        private MonitoredVehicleJourney monitoredVehicleJourney;

        @JsonProperty("RecordedAtTime")
        private String recordedAtTime;

        @JsonProperty("ValidUntilTime")
        private String validUntilTime;

        public MonitoredVehicleJourney getMonitoredVehicleJourney() {
            return monitoredVehicleJourney;
        }

        public String getRecordedAtTime() {
            return recordedAtTime;
        }

        public String getValidUntilTime() {
            return validUntilTime;
        }
    }

    public static class MonitoredVehicleJourney {
        @JsonProperty("LineRef")
        private ValueRef lineRef;

        @JsonProperty("DirectionRef")
        private ValueRef directionRef;

        @JsonProperty("VehicleLocation")
        private VehicleLocation vehicleLocation;

        @JsonProperty("VehicleRef")
        private ValueRef vehicleRef;

        @JsonProperty("DestinationRef")
        private ValueRef destinationRef;

        @JsonProperty("DataSource")
        private String dataSource;

        @JsonProperty("Bearing")
        private Double bearing;

        @JsonProperty("VehicleStatus")
        private String vehicleStatus;

        @JsonProperty("Delay")
        private String delay;

        public ValueRef getLineRef() {
            return lineRef;
        }

        public ValueRef getDirectionRef() {
            return directionRef;
        }

        public VehicleLocation getVehicleLocation() {
            return vehicleLocation;
        }

        public ValueRef getVehicleRef() {
            return vehicleRef;
        }

        public ValueRef getDestinationRef() {
            return destinationRef;
        }

        public String getDataSource() {
            return dataSource;
        }

        public Double getBearing() {
            return bearing;
        }

        public String getVehicleStatus() {
            return vehicleStatus;
        }

        public String getDelay() {
            return delay;
        }
    }

    public static class ValueRef {
        private String value;

        public String getValue() {
            return value;
        }
    }

    public static class VehicleLocation {
        @JsonProperty("Longitude")
        private double longitude;

        @JsonProperty("Latitude")
        private double latitude;

        public double getLongitude() {
            return longitude;
        }

        public double getLatitude() {
            return latitude;
        }
    }
}
