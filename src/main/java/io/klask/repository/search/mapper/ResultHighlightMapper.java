package io.klask.repository.search.mapper;

import io.klask.domain.File;
import io.klask.web.rest.util.EncodingUtil;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.highlight.HighlightField;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.core.SearchResultMapper;
import org.springframework.data.elasticsearch.core.aggregation.AggregatedPage;
import org.springframework.data.elasticsearch.core.aggregation.impl.AggregatedPageImpl;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Created by jeremie on 30/06/16.
 */
public class ResultHighlightMapper implements SearchResultMapper {

    @Override
    public <T> AggregatedPage<T> mapResults(SearchResponse response, Class<T> clazz, Pageable pageable) {
        List<File> result = new ArrayList<>();
        long totalHits = response.getHits().getTotalHits();
        for (SearchHit searchHit : response.getHits()) {
            if (response.getHits().getHits().length <= 0) {
                return null;
            }

            //System.out.println(response.toString());

            String summaryWithHighlight = null;
            String pathWithHighlight = null;
            HighlightField highlightFieldContent = searchHit.getHighlightFields().get("content");
            HighlightField highlightFieldPath = searchHit.getHighlightFields().get("path");
            if (highlightFieldContent != null) {
                summaryWithHighlight = Arrays.stream(highlightFieldContent.fragments())
                    .map(text -> EncodingUtil.convertToUTF8(text.toString()))
                    .collect(Collectors.joining("\n[...]\n"));
            }
            if (highlightFieldPath != null && highlightFieldPath.fragments() != null) {
                pathWithHighlight = EncodingUtil.unEscapeString(highlightFieldPath.fragments()[0].toString());
            }
            File oneFile = new File(
                (String) searchHit.getSource().get("id"),
                (String) searchHit.getSource().get("name"),
                (String) searchHit.getSource().get("extension"),
                pathWithHighlight != null ? pathWithHighlight : (String) searchHit.getSource().get("path"),
                (String) searchHit.getSource().get("project"),
                summaryWithHighlight,
                (String) searchHit.getSource().get("version"),
                //conversion en string puis en long, très bizarre, à l'origine, il était préférable de réaliser :
                //(Long) searchHit.getSource().get("size")
                //mais cela jette un classCastException Integer to Long
                Long.valueOf(searchHit.getSource().get("size").toString())
            );
            oneFile.setScore(searchHit.getScore());
            oneFile.setLastAuthor((String) searchHit.getSource().get("lastAuthor"));
            oneFile.setLastDate((String) searchHit.getSource().get("lastDate"));
            result.add(oneFile);
        }
        return new AggregatedPageImpl<>((List<T>) result, pageable, totalHits, response.getAggregations());
    }
}
