package io.klask.web.rest.dto;

import io.klask.domain.File;
import io.klask.web.rest.mapper.FileMapper;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;

/**
 * A DTO representing a full content file with contentType for syntax highlight
 */
public class FileDetailDTO implements Serializable {

    @NotNull
    @Size(max = 255)
    private String id;

    @NotNull
    @Size(max = 255)
    private String name;

    @Size(max = 255)
    private String extension;

    @Size(max = 255)
    private String contentType;

    private String content;

    @NotNull
    @Size(max = 255)
    private String path;

    private String project;

    private String version;

    private Long size;

    public FileDetailDTO(File f) {
        this(f.getId(), f.getName(), f.getExtension(), f.getContent(), f.getPath(), f.getProject(), f.getVersion(), f.getSize());
    }

    public FileDetailDTO(String id, String name, String extension, String content, String path, String project, String version, Long size) {
        this.id = id;
        this.name = name;
        this.extension = extension;
        this.content = content;
        this.contentType = FileMapper.getMappingContentType(extension);
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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
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
            //", content='" + content + '\'' +
            //", path='" + path + '\'' +
            ", project='" + project + '\'' +
            ", version='" + version + '\'' +
            ", size=" + size +
            '}';
    }
}
