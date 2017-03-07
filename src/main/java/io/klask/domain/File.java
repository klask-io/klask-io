package io.klask.domain;

import io.klask.config.Constants;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.elasticsearch.annotations.*;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.io.Serializable;
import java.util.Objects;

/**
 * @author Jérémie Harel
 */

@Document(indexName = Constants.INDEX_NAME, shards = 8, replicas = 0, type = Constants.TYPE_NAME)
@Setting(settingPath = "elasticsearch/settings.json")
@Mapping(mappingPath = "elasticsearch/mapping.json")
public class File implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Field(type = FieldType.String)
    private String id;

    @NotNull
    @Size(max = 255)
//    @Field(type = FieldType.String,
//        index = FieldIndex.analyzed,
//        searchAnalyzer = "keyword",
//        analyzer = "keyword",
//        store = true)
    private String name;

    @Size(max = 255)
//    @Field(type = FieldType.String,
//        index = FieldIndex.analyzed,
//        searchAnalyzer = "keyword",
//        analyzer = "keyword",
//        store = true)
    private String extension;

    @NotNull
//    @Field(type = FieldType.String,
//        index = FieldIndex.not_analyzed,
//        searchAnalyzer = "keyword",
//        analyzer = "keyword",
//        store = true
//    )
    private String path;

    @NotNull
//    @MultiField(
//        mainField = @Field(type = FieldType.String),
//        otherFields = {
//            @InnerField(index = FieldIndex.not_analyzed, suffix = "raw", type = FieldType.String)
//        }
//    )
    private String project;


    //    @Field(type = FieldType.String,
//        index = FieldIndex.analyzed,
//        searchAnalyzer = "customanalyzer",
//        analyzer = "customanalyzer",
//        store = false)
    private String content;

    //ici le cas de la version est particulier, on souhaite pouvoir réaliser des requêtes du genre version:TRUNK, version:trunk, version:maint.15.*
    // donc case insensitive et wildcard mais on souhaite également faire une requête d'aggrégation qui va compter les
    //occurrences de chaque type de version (faire un nuage de versions) et être case sensitive cette fois
//    @MultiField(
//        mainField = @Field(type = FieldType.String),
//        otherFields = {
//            @InnerField(index = FieldIndex.not_analyzed, suffix = "raw", type = FieldType.String)
//        }
//    )
    private String version;

    @LastModifiedBy
    private String lastAuthor;

    @LastModifiedDate
    private String lastDate;

    //    @Field(type = FieldType.Long)
    private Long size;


    private Float score;


    public File() {

    }

    public File(String id, String name, String extension, String path, String project, String content, String version, Long size) {
        this.id = id;
        this.name = name;
        this.extension = extension;
        this.path = path;
        this.project = project;
        this.content = content;
        this.version = version;
        this.size = size;
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

    public String getProject() {
        return project;
    }

    public void setProject(String project) {
        this.project = project;
    }

    public Float getScore() {
        return score;
    }

    public void setScore(Float score) {
        this.score = score;
    }

    public String getLastAuthor() {
        return lastAuthor;
    }

    public void setLastAuthor(String lastAuthor) {
        this.lastAuthor = lastAuthor;
    }

    public String getLastDate() {
        return lastDate;
    }

    public void setLastDate(String lastDate) {
        this.lastDate = lastDate;
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
        return !(file.id == null || id == null) && Objects.equals(id, file.id);
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
            /*", project='" + project + "'" +*/
            '}';
    }


}
