package io.klask.domain;

import java.io.Serializable;
import java.util.Objects;

import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.Table;
import javax.validation.constraints.NotNull;

import io.klask.service.util.CipherUtil;
import org.springframework.data.elasticsearch.annotations.Document;

import io.klask.domain.enumeration.RepositoryType;

/**
 * A Repository.
 */
@Entity
@Table(name = "repository")
@Document(indexName = "repository", replicas = 0, shards = 1)
public class Repository implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    @NotNull
    @Column(name = "path", nullable = false)
    private String path;

    @Column(name = "username")
    private String username;

    @Column(name = "password")
    private String password;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private RepositoryType type;

    @NotNull
    @Column(name = "name", nullable = false, unique = true)
    private String name;

    @Column(name = "revision")
    private Long revision = 0L;

    @Column(name = "schedule")
    private String schedule;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return CipherUtil.decipherTextIfAESActivated(password);
    }

    public void setPassword(String password) {

        this.password = CipherUtil.cipherTextIfAESActivated(password);
    }

    public RepositoryType getType() {
        return type;
    }

    public void setType(RepositoryType type) {
        this.type = type;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getRevision() {
        return revision;
    }

    public void setRevision(Long revision) {
        this.revision = revision;
    }

    public String getSchedule() {
        return schedule;
    }

    public void setSchedule(String schedule) {
        this.schedule = schedule;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Repository repository = (Repository) o;
        if (repository.id == null || id == null) {
            return false;
        }
        return Objects.equals(id, repository.id);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(id);
    }

    @Override
    public String toString() {
        return "Repository{" +
            "id=" + id +
            ", path='" + path + "'" +
            ", username='" + username + "'" +
            ", password='" + password + "'" +
            ", type='" + type + "'" +
            ", name='" + name + "'" +
            ", revision='" + revision + "'" +
            ", schedule='" + schedule + "'" +
            '}';
    }
}
