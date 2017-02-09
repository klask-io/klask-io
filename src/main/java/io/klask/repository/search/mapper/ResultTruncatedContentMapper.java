package io.klask.repository.search.mapper;

import io.klask.config.Constants;
import io.klask.domain.File;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.search.SearchHit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.core.SearchResultMapper;

import java.util.ArrayList;
import java.util.List;

/**
 * Created by jeremie on 30/06/16.
 */
public class ResultTruncatedContentMapper implements SearchResultMapper {

    @Override
    public <T> Page<T> mapResults(SearchResponse response, Class<T> clazz, Pageable pageable) {
        List<File> result = new ArrayList<>();
        long totalHits = response.getHits().getTotalHits();
        for (SearchHit searchHit : response.getHits()) {
            if (response.getHits().getHits().length <= 0) {
                return null;
            }

            String content = (String) searchHit.getSource().get("content");
            File oneFile = new File(
                (String) searchHit.getSource().get("id"),
                (String) searchHit.getSource().get("name"),
                (String) searchHit.getSource().get("extension"),
                (String) searchHit.getSource().get("path"),
                (String) searchHit.getSource().get("project"),
                content == null ? null : content.substring(0, Math.min(Constants.TRUNCATED_CONTENT, content.length())),
                (String) searchHit.getSource().get("version"),
                //conversion en string puis en long, très bizarre, à l'origine, il était préférable de réaliser :
                //(Long) searchHit.getSource().get("size")
                //mais cela jette un classCastException Integer to Long
                Long.valueOf(searchHit.getSource().get("size").toString())
            );
            result.add(oneFile);
        }
        return new PageImpl<>((List<T>) result, pageable, totalHits);
    }
}
