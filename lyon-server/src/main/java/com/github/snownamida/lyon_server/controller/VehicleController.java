package com.github.snownamida.lyon_server.controller;

import com.github.snownamida.lyon_server.model.VehiclePosition;
import com.github.snownamida.lyon_server.service.GrandLyonService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/vehicles")
public class VehicleController {

    private final GrandLyonService grandLyonService;

    public VehicleController(GrandLyonService grandLyonService) {
        this.grandLyonService = grandLyonService;
    }

    @GetMapping
    public List<VehiclePosition> getVehicles() {
        return grandLyonService.getVehiclePositions();
    }
}
