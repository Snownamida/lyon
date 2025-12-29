package com.github.snownamida.lyon_server.service;

import com.github.snownamida.lyon_server.model.SiriResponse;
import com.github.snownamida.lyon_server.model.VehiclePosition;
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

    // Cache valid for 3 seconds as requested
    private static final long CACHE_DURATION_MS = 3000;

    public List<VehiclePosition> getVehiclePositions() {
        long now = System.currentTimeMillis();
        lastRequestTime.set(now); // Mark user activity

        synchronized (this) {
            // If cache is fresh (fetched less than 3s ago), return it
            if (now - lastFetchTime < CACHE_DURATION_MS) {
                return cachedPositions;
            }

            // Otherwise, fetch new data
            fetchDataFromApi();
            return cachedPositions;
        }
    }

    private void fetchDataFromApi() {
        try {
            SiriResponse response = restTemplate.getForObject(apiUrl, SiriResponse.class);

            if (response == null || response.getSiri() == null ||
                    response.getSiri().getServiceDelivery() == null ||
                    response.getSiri().getServiceDelivery().getVehicleMonitoringDelivery() == null) {
                this.cachedPositions = Collections.emptyList();
                return;
            }

            List<VehiclePosition> allPositions = response.getSiri().getServiceDelivery().getVehicleMonitoringDelivery()
                    .stream()
                    .flatMap(delivery -> delivery.getVehicleActivity().stream())
                    .map(this::mapToVehiclePosition)
                    .collect(Collectors.toList());

            // Robust deduplication logic for any number of duplicates
            java.util.Map<String, List<VehiclePosition>> grouped = allPositions.stream()
                    .filter(p -> p.getVehicleId() != null)
                    .collect(Collectors.groupingBy(VehiclePosition::getVehicleId));

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
                                    .comparingInt((VehiclePosition p) -> p.getDelay() != null ? 0 : 1) // Null delays
                                                                                                       // last
                                    .thenComparingLong(p -> {
                                        if (p.getDelay() == null)
                                            return Long.MAX_VALUE;
                                        try {
                                            return Math.abs(java.time.Duration.parse(p.getDelay()).getSeconds());
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
        if (activity == null || activity.getMonitoredVehicleJourney() == null)
            return null;

        SiriResponse.MonitoredVehicleJourney journey = activity.getMonitoredVehicleJourney();

        String vehicleId = journey.getVehicleRef() != null ? journey.getVehicleRef().getValue() : null;
        String lineId = journey.getLineRef() != null ? journey.getLineRef().getValue() : null;
        String direction = journey.getDirectionRef() != null ? journey.getDirectionRef().getValue() : null;
        double lat = journey.getVehicleLocation() != null ? journey.getVehicleLocation().getLatitude() : 0.0;
        double lon = journey.getVehicleLocation() != null ? journey.getVehicleLocation().getLongitude() : 0.0;
        String delay = journey.getDelay();

        // New fields extraction
        // activity level
        Instant recordedAt = null;
        if (activity.getRecordedAtTime() != null) {
            try {
                recordedAt = Instant.parse(activity.getRecordedAtTime());
            } catch (Exception ignored) {
            }
        }

        Instant validUntil = null;
        if (activity.getValidUntilTime() != null) {
            try {
                validUntil = Instant.parse(activity.getValidUntilTime());
            } catch (Exception ignored) {
            }
        }

        // journey level
        String destination = journey.getDestinationRef() != null ? journey.getDestinationRef().getValue() : null;
        String dataSource = journey.getDataSource();
        Double bearing = journey.getBearing();
        String status = journey.getVehicleStatus();

        return new VehiclePosition(vehicleId, lineId, direction, lat, lon, delay, recordedAt, validUntil, destination,
                dataSource, bearing, status);
    }
}
