package com.github.snownamida.lyon_server.controller;

import com.github.snownamida.lyon_server.service.TransportLineService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/lines")
public class TransportLineController {

    private final TransportLineService transportLineService;

    public TransportLineController(TransportLineService transportLineService) {
        this.transportLineService = transportLineService;
    }

    @GetMapping(value = "/{type}", produces = MediaType.APPLICATION_JSON_VALUE)
    public TransportLineService.LineData getLines(@PathVariable String type) {
        return transportLineService.getCachedLineData(type);
    }
}
