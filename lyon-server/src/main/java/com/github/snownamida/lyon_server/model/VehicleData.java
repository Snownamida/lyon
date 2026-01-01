package com.github.snownamida.lyon_server.model;

import java.time.Instant;
import java.util.List;

public record VehicleData(
                List<VehiclePosition> vehicles,
                Instant apiResponseTimestamp,
                Instant lastFetchTime,
                String apiStatus) {
}
