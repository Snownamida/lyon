package com.github.snownamida.lyon_server.controller;

import com.github.snownamida.lyon_server.service.MetroService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/metro-lines")
public class MetroController {

    private final MetroService metroService;

    public MetroController(MetroService metroService) {
        this.metroService = metroService;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public String getMetroLines() {
        return metroService.getCachedMetroData();
    }
}
