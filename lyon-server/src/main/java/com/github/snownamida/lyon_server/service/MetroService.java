package com.github.snownamida.lyon_server.service;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class MetroService {

    private final String metroUrl;
    private final RestTemplate restTemplate;
    private String cachedMetroData;

    public MetroService(@Value("${grandlyon.metro.url}") String metroUrl) {
        this.metroUrl = metroUrl;
        this.restTemplate = new RestTemplate();
    }

    @PostConstruct
    public void init() {
        fetchMetroData();
    }

    private void fetchMetroData() {
        try {
            System.out.println("Fetching metro data from Grand Lyon: " + metroUrl);
            this.cachedMetroData = restTemplate.getForObject(java.net.URI.create(metroUrl), String.class);
            System.out.println("Metro data cached successfully.");
        } catch (Exception e) {
            System.err.println("Failed to fetch metro data: " + e.getMessage());
            this.cachedMetroData = "{\"type\":\"FeatureCollection\",\"features\":[]}";
        }
    }

    public String getCachedMetroData() {
        return cachedMetroData;
    }
}
