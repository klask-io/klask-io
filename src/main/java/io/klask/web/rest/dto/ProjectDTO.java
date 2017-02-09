package io.klask.web.rest.dto;

import javax.validation.constraints.NotNull;

/**
 * Created by jeremie on 27/06/16.
 */
public class ProjectDTO {

    @NotNull
    private String name;

    @NotNull
    private Long docNumber;

    public ProjectDTO(String name, Long docNumber) {
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
        return "ProjectDTO{" +
            "name='" + name + '\'' +
            ", docNumber='" + docNumber +
            "}";
    }
}
