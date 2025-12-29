package com.github.snownamida.lyon_server.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record SiriResponse(
        @JsonProperty("Siri") Siri siri) {
    public record Siri(
            @JsonProperty("ServiceDelivery") ServiceDelivery serviceDelivery) {
    }

    public record ServiceDelivery(
            @JsonProperty("ResponseTimestamp") String responseTimestamp,
            @JsonProperty("VehicleMonitoringDelivery") List<VehicleMonitoringDelivery> vehicleMonitoringDelivery) {
    }

    public record VehicleMonitoringDelivery(
            @JsonProperty("VehicleActivity") List<VehicleActivity> vehicleActivity) {
    }

    public record VehicleActivity(
            @JsonProperty("MonitoredVehicleJourney") MonitoredVehicleJourney monitoredVehicleJourney,
            @JsonProperty("RecordedAtTime") String recordedAtTime,
            @JsonProperty("ValidUntilTime") String validUntilTime) {
    }

    public record MonitoredVehicleJourney(
            @JsonProperty("LineRef") ValueRef lineRef,
            @JsonProperty("DirectionRef") ValueRef directionRef,
            @JsonProperty("VehicleLocation") VehicleLocation vehicleLocation,
            @JsonProperty("VehicleRef") ValueRef vehicleRef,
            @JsonProperty("DestinationRef") ValueRef destinationRef,
            @JsonProperty("DataSource") String dataSource,
            @JsonProperty("Bearing") Double bearing,
            @JsonProperty("VehicleStatus") String vehicleStatus,
            @JsonProperty("Delay") String delay) {
    }

    public record ValueRef(
            String value) {
    }

    public record VehicleLocation(
            @JsonProperty("Longitude") double longitude,
            @JsonProperty("Latitude") double latitude) {
    }
}
