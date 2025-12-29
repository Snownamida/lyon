package com.github.snownamida.lyon_server.model;

import java.time.Instant;

public class VehiclePosition {
    private String vehicleId;
    private String lineId;
    private String direction;
    private double latitude;
    private double longitude;
    private String delay;

    // New fields
    private Instant recordedAtTime;
    private Instant validUntilTime;
    private String destinationName; // simplified from DestinationRef value
    private String dataSource;
    private Double bearing;
    private String vehicleStatus;

    public VehiclePosition(String vehicleId, String lineId, String direction, double latitude, double longitude,
            String delay, Instant recordedAtTime, Instant validUntilTime, String destinationName,
            String dataSource, Double bearing, String vehicleStatus) {
        this.vehicleId = vehicleId;
        this.lineId = lineId;
        this.direction = direction;
        this.latitude = latitude;
        this.longitude = longitude;
        this.delay = delay;
        this.recordedAtTime = recordedAtTime;
        this.validUntilTime = validUntilTime;
        this.destinationName = destinationName;
        this.dataSource = dataSource;
        this.bearing = bearing;
        this.vehicleStatus = vehicleStatus;
    }

    public String getVehicleId() {
        return vehicleId;
    }

    public String getLineId() {
        return lineId;
    }

    public String getDirection() {
        return direction;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public String getDelay() {
        return delay;
    }

    public Instant getRecordedAtTime() {
        return recordedAtTime;
    }

    public Instant getValidUntilTime() {
        return validUntilTime;
    }

    public String getDestinationName() {
        return destinationName;
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
}
