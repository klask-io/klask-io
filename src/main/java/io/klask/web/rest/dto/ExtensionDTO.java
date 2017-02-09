package io.klask.web.rest.dto;

import javax.validation.constraints.NotNull;

/**
 * Created by jeremie on 27/06/16.
 */
public class ExtensionDTO {

    @NotNull
    private String name;

    @NotNull
    private Long docNumber;

    public ExtensionDTO(String name, Long docNumber) {
        this.name = name;
        this.docNumber = docNumber;
    }

    public Long getDocNumber() {
        return docNumber;
    }

    public String getName() {
        return name;
    }

    @Override
    public String toString() {
        return "ExtensionDTO{" +
            "name='" + name + '\'' +
            ", docNumber='" + docNumber +
            "}";
    }
}
