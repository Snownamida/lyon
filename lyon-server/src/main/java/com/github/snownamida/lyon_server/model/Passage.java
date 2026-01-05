package com.github.snownamida.lyon_server.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record Passage(
        String id,
        String ligne,
        String direction,
        @JsonProperty("delaipassage") String delaiPassage,
        String type,
        @JsonProperty("heurepassage") String heurePassage,
        @JsonProperty("idtarretdestination") int idArretDestination,
        @JsonProperty("coursetheorique") String courseTheorique,
        int gid,
        @JsonProperty("last_update_fme") String lastUpdateFme) {
}
