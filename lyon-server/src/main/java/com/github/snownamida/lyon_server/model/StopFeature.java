package com.github.snownamida.lyon_server.model;

public record StopFeature(String type, String id, Geometry geometry, StopProperties properties) {
    public record Geometry(String type, double[] coordinates) {
    }

    public record StopProperties(
            int id,
            String nom,
            String desserte,
            boolean pmr,
            boolean ascenseur,
            boolean escalator,
            int gid,
            String last_update,
            String adresse,
            String commune) {
    }
}
