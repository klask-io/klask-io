package fr.dlap.research.domain;

import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldIndex;
import org.springframework.data.elasticsearch.annotations.FieldType;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.util.Objects;

/**
 * @author Jérémie Harel
 */

@Document(indexName = "file", shards = 5, replicas = 1, type = "file")
public class File extends AbstractAuditingEntity implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Field(type = FieldType.String)
    private String id;

    @NotNull
    @Size(max = 255)
    @Field(type = FieldType.String,
        index = FieldIndex.analyzed,
        searchAnalyzer = "keyword",
        indexAnalyzer = "keyword",
        store = true)
    private String name;

    @Size(max = 255)
    @Field(type = FieldType.String,
        index = FieldIndex.analyzed,
        searchAnalyzer = "keyword",
        indexAnalyzer = "keyword",
        store = true)
    private String extension;

    @NotNull
    @Field(type = FieldType.String,
        index = FieldIndex.analyzed,
        searchAnalyzer = "keyword",
        indexAnalyzer = "keyword",

        store = true
    )
    private String path;


    @Field(type = FieldType.String,
        index = FieldIndex.analyzed,
        searchAnalyzer = "whitespace",
        indexAnalyzer = "whitespace",
        store = false)
    private String content;

    private String version;

    private Long size;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getExtension() {
        return this.extension;
    }

    public void setExtension(String extension) {
        this.extension = extension;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        File file = (File) o;
        if (file.id == null || id == null) {
            return false;
        }
        return Objects.equals(id, file.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "File{" +
            "id=" + id +
            /*", name='" + name + "'" +
            ", extension='" + extension + "'" +*/
            ", path='" + path + "'" +
            /*", content='" + content.substring(0,25) + "'" +*/
            ", version='" + version + "'" +
            '}';
    }
}
