package com.github.snownamida.lyon_server.service;

import jakarta.annotation.PostConstruct;
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
            @Value("${grandlyon.lines.tram}") String tramUrl) {
        this.lineUrls.put("metro", metroUrl);
        this.lineUrls.put("tram", tramUrl);
        this.restTemplate = new RestTemplate();
    }

    @PostConstruct
    public void init() {
        fetchAllLines();
    }

    private void fetchAllLines() {
        for (Map.Entry<String, String> entry : lineUrls.entrySet()) {
            String type = entry.getKey();
            String url = entry.getValue();
            try {
                System.out.println("Fetching " + type + " data from Grand Lyon: " + url);
                String data = restTemplate.getForObject(URI.create(url), String.class);
                cachedLineData.put(type, data);
                System.out.println(type + " data cached successfully.");
            } catch (Exception e) {
                System.err.println("Failed to fetch " + type + " data: " + e.getMessage());
                cachedLineData.put(type, "{\"type\":\"FeatureCollection\",\"features\":[]}");
            }
        }
    }

    public String getCachedLineData(String type) {
        return cachedLineData.getOrDefault(type, "{\"type\":\"FeatureCollection\",\"features\":[]}");
    }
}
