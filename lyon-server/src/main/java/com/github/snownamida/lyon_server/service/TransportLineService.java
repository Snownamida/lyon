package com.github.snownamida.lyon_server.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

@Service
public class TransportLineService {

    private final Map<String, String> lineUrls = new HashMap<>();
    private final Map<String, String> cachedLineData = new HashMap<>();
    private final RestTemplate restTemplate;

    public TransportLineService(
            @Value("${grandlyon.lines.metro}") String metroUrl,
            @Value("${grandlyon.lines.tram}") String tramUrl,
            @Value("${grandlyon.lines.bus}") String busUrl,
            @Value("${grandlyon.lines.rhonexpress}") String rhonexpressUrl) {
        this.lineUrls.put("metro", metroUrl);
        this.lineUrls.put("tram", tramUrl);
        this.lineUrls.put("bus", busUrl);
        this.lineUrls.put("rhonexpress", rhonexpressUrl);
        this.restTemplate = new RestTemplate();
    }

    // Removed PostConstruct to avoid OOM on startup for large files

    private synchronized String fetchLineData(String type) {
        // Double-check if it was fetched while waiting for lock
        if (cachedLineData.containsKey(type)) {
            return cachedLineData.get(type);
        }

        String url = lineUrls.get(type);
        if (url == null)
            return "{\"type\":\"FeatureCollection\",\"features\":[]}";

        try {
            System.out.println("Fetching " + type + " data from Grand Lyon: " + url);
            String data = restTemplate.getForObject(URI.create(url), String.class);
            cachedLineData.put(type, data);
            System.out.println(type + " data cached successfully.");
            return data;
        } catch (Exception e) {
            System.err.println("Failed to fetch " + type + " data: " + e.getMessage());
            return "{\"type\":\"FeatureCollection\",\"features\":[]}";
        }
    }

    public String getCachedLineData(String type) {
        String data = cachedLineData.get(type);
        if (data == null) {
            return fetchLineData(type);
        }
        return data;
    }
}
