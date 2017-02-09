package io.klask.web.rest.dto;

import io.klask.domain.File;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;

/**
 * A DTO representing a file with a summary of content and highlight keywords
 */
public class FileDTO {

    @NotNull
    @Size(max = 255)
    private String id;

    @NotNull
    @Size(max = 255)
    private String name;

    @Size(max = 255)
    private String extension;

    private String summaryWithHighlight;

    @NotNull
    @Size(max = 255)
    private String path;

    private String project;

    private String version;

    private Long size;

    public FileDTO(File f) {
        this(f.getId(), f.getName(), f.getExtension(), f.getContent(), f.getPath(), f.getProject(), f.getVersion(), f.getSize());
    }

    public FileDTO(String id, String name, String extension, String summaryWithHighlight, String path, String project, String version, Long size) {
        this.id = id;
        this.name = name;
        this.extension = extension;
        this.summaryWithHighlight = summaryWithHighlight;
        this.path = path;
        this.project = project;
        this.version = version;
        this.size = size;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getExtension() {
        return extension;
    }

    public void setExtension(String extension) {
        this.extension = extension;
    }

    public String getSummaryWithHighlight() {
        return summaryWithHighlight;
    }

    public void setSummaryWithHighlight(String summaryWithHighlight) {
        this.summaryWithHighlight = summaryWithHighlight;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        this.size = size;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    @Override
    public String toString() {
        return "FileDTO{" +
            "id='" + id + '\'' +
            "name='" + name + '\'' +
            ", extension='" + extension + '\'' +
            //", summaryWithHighlight='" + summaryWithHighlight + '\'' +
            //", path='" + path + '\'' +
            ", project='" + project + '\'' +
            ", version='" + version + '\'' +
            ", size=" + size +
            '}';
    }
}
