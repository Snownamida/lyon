package com.github.snownamida.lyon_server.model;

import java.time.Instant;

public class VehiclePosition {
    private String vehicleId;
    private String lineId;
    private String direction;
    private double latitude;
    private double longitude;
    private Instant timestamp;
    private String delay;

    public VehiclePosition(String vehicleId, String lineId, String direction, double latitude, double longitude,
            Instant timestamp, String delay) {
        this.vehicleId = vehicleId;
        this.lineId = lineId;
        this.direction = direction;
        this.latitude = latitude;
        this.longitude = longitude;
        this.timestamp = timestamp;
        this.delay = delay;
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

    public Instant getTimestamp() {
        return timestamp;
    }

    public String getDelay() {
        return delay;
    }
}
