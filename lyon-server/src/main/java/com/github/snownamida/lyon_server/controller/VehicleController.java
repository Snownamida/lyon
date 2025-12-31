package com.github.snownamida.lyon_server.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.github.snownamida.lyon_server.model.VehicleData;
import com.github.snownamida.lyon_server.service.GrandLyonService;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

    private final GrandLyonService grandLyonService;

    public VehicleController(GrandLyonService grandLyonService) {
        this.grandLyonService = grandLyonService;
    }

    @GetMapping
    public VehicleData getVehicles() {
        return grandLyonService.getVehiclePositions();
    }
}
