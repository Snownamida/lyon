package com.github.snownamida.lyon_server.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

@Service
public class TransportLineService {

    public record LineData(String geojson, String status) {
    }

    private final Map<String, String> lineUrls = new HashMap<>();
    private final Map<String, LineData> cachedLineData = new HashMap<>();
    private final RestTemplate restTemplate;

    public TransportLineService(
            @Value("${grandlyon.lines.metro}") String metroUrl,
            @Value("${grandlyon.lines.tram}") String tramUrl,
            @Value("${grandlyon.lines.bus}") String busUrl,
            @Value("${grandlyon.lines.rhonexpress}") String rhonexpressUrl,
            @Value("${grandlyon.lines.stops}") String stopsUrl) {
        this.lineUrls.put("metro", metroUrl);
        this.lineUrls.put("tram", tramUrl);
        this.lineUrls.put("bus", busUrl);
        this.lineUrls.put("rhonexpress", rhonexpressUrl);
        this.lineUrls.put("stops", stopsUrl);
        this.restTemplate = new RestTemplate();
    }

    // Removed PostConstruct to avoid OOM on startup for large files

    private synchronized LineData fetchLineData(String type) {
        // Double-check if it was fetched while waiting for lock
        if (cachedLineData.containsKey(type)) {
            return cachedLineData.get(type);
        }

        String url = lineUrls.get(type);
        if (url == null)
            return new LineData("{\"type\":\"FeatureCollection\",\"features\":[]}", "NOT_FOUND");

        try {
            System.out.println("Fetching " + type + " data from Grand Lyon: " + url);
            String data = restTemplate.getForObject(URI.create(url), String.class);
            LineData lineData = new LineData(data, "OK");
            cachedLineData.put(type, lineData);
            System.out.println(type + " data cached successfully.");
            return lineData;
        } catch (org.springframework.web.client.ResourceAccessException e) {
            System.err.println("API Timeout or Connection Refused: " + e.getMessage());
            return new LineData("{\"type\":\"FeatureCollection\",\"features\":[]}", "API_DOWN");
        } catch (Exception e) {
            System.err.println("Failed to fetch " + type + " data: " + e.getMessage());
            return new LineData("{\"type\":\"FeatureCollection\",\"features\":[]}", "ERROR: " + e.getMessage());
        }
    }

    public LineData getCachedLineData(String type) {
        LineData data = cachedLineData.get(type);
        if (data == null) {
            return fetchLineData(type);
        }
        return data;
    }
}
