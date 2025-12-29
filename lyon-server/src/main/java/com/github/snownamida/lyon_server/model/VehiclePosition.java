package com.github.snownamida.lyon_server.model;

import java.time.Instant;

public record VehiclePosition(
        String vehicleId,
        String lineId,
        String direction,
        double latitude,
        double longitude,
        String delay,
        Instant recordedAtTime,
        Instant validUntilTime,
        String destinationName,
        String dataSource,
        Double bearing,
        String vehicleStatus) {
}
