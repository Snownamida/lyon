package com.github.snownamida.lyon_server.service;

import com.github.snownamida.lyon_server.model.SiriResponse;
import com.github.snownamida.lyon_server.model.VehiclePosition;
import com.github.snownamida.lyon_server.model.VehicleData;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GrandLyonService {

    private final RestTemplate restTemplate;
    private final String apiUrl;

    public GrandLyonService(@Value("${grandlyon.api.url}") String apiUrl,
            @Value("${grandlyon.api.username}") String username,
            @Value("${grandlyon.api.password}") String password,
            RestTemplateBuilder builder) {
        this.apiUrl = apiUrl;
        this.restTemplate = builder
                .basicAuthentication(username, password)
                .build();
    }

    private final java.util.concurrent.atomic.AtomicLong lastRequestTime = new java.util.concurrent.atomic.AtomicLong(
            0);
    private volatile List<VehiclePosition> cachedPositions = Collections.emptyList();
    private volatile long lastFetchTime = 0;
    private volatile Instant lastApiTimestamp = null;

    // Cache valid for 3 seconds as requested
    private static final long CACHE_DURATION_MS = 3000;

    public VehicleData getVehiclePositions() {
        long now = System.currentTimeMillis();
        lastRequestTime.set(now); // Mark user activity

        synchronized (this) {
            // If cache is fresh (fetched less than 3s ago), return it
            if (now - lastFetchTime < CACHE_DURATION_MS) {
                return new VehicleData(cachedPositions, lastApiTimestamp, Instant.ofEpochMilli(lastFetchTime));
            }

            // Otherwise, fetch new data
            fetchDataFromApi();
            return new VehicleData(cachedPositions, lastApiTimestamp, Instant.ofEpochMilli(lastFetchTime));
        }
    }

    private void fetchDataFromApi() {
        try {
            SiriResponse response = restTemplate.getForObject(apiUrl, SiriResponse.class);

            if (response == null || response.siri() == null ||
                    response.siri().serviceDelivery() == null ||
                    response.siri().serviceDelivery().vehicleMonitoringDelivery() == null) {
                this.cachedPositions = Collections.emptyList();
                return;
            }

            // Extract API timestamp
            try {
                this.lastApiTimestamp = Instant.parse(response.siri().serviceDelivery().responseTimestamp());
            } catch (Exception ignored) {
            }

            List<VehiclePosition> allPositions = response.siri().serviceDelivery().vehicleMonitoringDelivery()
                    .stream()
                    .flatMap(delivery -> delivery.vehicleActivity().stream())
                    .map(this::mapToVehiclePosition)
                    .collect(Collectors.toList());

            // Robust deduplication logic for any number of duplicates
            java.util.Map<String, List<VehiclePosition>> grouped = allPositions.stream()
                    .filter(p -> p.vehicleId() != null)
                    .collect(Collectors.groupingBy(VehiclePosition::vehicleId));

            List<VehiclePosition> result = new java.util.ArrayList<>();

            for (List<VehiclePosition> positions : grouped.values()) {
                if (positions.isEmpty())
                    continue;
                if (positions.size() == 1) {
                    result.add(positions.get(0));
                } else {
                    // Pick the best candidate
                    // Priority 1: Has a valid delay (not null)
                    // Priority 2: Smallest absolute delay (real-time vs scheduled phantom)
                    VehiclePosition best = positions.stream()
                            .min(java.util.Comparator
                                    .comparingInt((VehiclePosition p) -> p.delay() != null ? 0 : 1) // Null delays
                                                                                                    // last
                                    .thenComparingLong(p -> {
                                        if (p.delay() == null)
                                            return Long.MAX_VALUE;
                                        try {
                                            return Math.abs(java.time.Duration.parse(p.delay()).getSeconds());
                                        } catch (Exception e) {
                                            return Long.MAX_VALUE;
                                        }
                                    }))
                            .orElse(positions.get(0));
                    result.add(best);
                }
            }

            this.cachedPositions = result;
            this.lastFetchTime = System.currentTimeMillis();

        } catch (Exception e) {
            e.printStackTrace();
            // Keep old cache on error or empty? Let's return empty to be safe
            this.cachedPositions = Collections.emptyList();
        }
    }

    private VehiclePosition mapToVehiclePosition(SiriResponse.VehicleActivity activity) {
        if (activity == null || activity.monitoredVehicleJourney() == null)
            return null;

        SiriResponse.MonitoredVehicleJourney journey = activity.monitoredVehicleJourney();

        String vehicleId = journey.vehicleRef() != null ? journey.vehicleRef().value() : null;
        String lineId = journey.lineRef() != null ? journey.lineRef().value() : null;
        String direction = journey.directionRef() != null ? journey.directionRef().value() : null;
        double lat = journey.vehicleLocation() != null ? journey.vehicleLocation().latitude() : 0.0;
        double lon = journey.vehicleLocation() != null ? journey.vehicleLocation().longitude() : 0.0;
        String delay = journey.delay();

        // New fields extraction
        // activity level
        Instant recordedAt = null;
        if (activity.recordedAtTime() != null) {
            try {
                recordedAt = Instant.parse(activity.recordedAtTime());
            } catch (Exception ignored) {
            }
        }

        Instant validUntil = null;
        if (activity.validUntilTime() != null) {
            try {
                validUntil = Instant.parse(activity.validUntilTime());
            } catch (Exception ignored) {
            }
        }

        // journey level
        String destination = journey.destinationRef() != null ? journey.destinationRef().value() : null;
        String dataSource = journey.dataSource();
        Double bearing = journey.bearing();
        String status = journey.vehicleStatus();

        return new VehiclePosition(vehicleId, lineId, direction, lat, lon, delay, recordedAt, validUntil, destination,
                dataSource, bearing, status);
    }
}
