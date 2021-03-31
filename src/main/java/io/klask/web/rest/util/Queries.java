package io.klask.web.rest.util;

import org.elasticsearch.action.search.SearchAction;
import org.elasticsearch.action.search.SearchRequestBuilder;
import org.elasticsearch.client.Client;
import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.search.highlight.HighlightBuilder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.core.query.FetchSourceFilterBuilder;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;
import org.springframework.util.StringUtils;

/**
 * Created by jeremie on 27/06/16.
 */
public class Queries {

    public static QueryBuilder constructQuery(String query) {
        return new NativeSearchQueryBuilder()
            .withQuery(
                queryBuilder(query)
            )
            .build().getQuery();
    }

    public static NativeSearchQueryBuilder constructSearchQueryBuilder(String query) {
        return new NativeSearchQueryBuilder()
            .withQuery(
                queryBuilder(query)
            )

            ;
    }


    public static SearchRequestBuilder constructSearchRequestBuilder(String query, Pageable p, int numberOfFragments, Client client) {

        return new SearchRequestBuilder(client, SearchAction.INSTANCE)
            .setHighlighterEncoder("html")
            .setHighlighterFragmentSize(150)
            .setHighlighterPreTags("<mark>")
            .setHighlighterPostTags("</mark>")
            .addHighlightedField("content")
            .setQuery(queryBuilder(query))
            .setFetchSource(null, "content");
    }

    /**
     * construct a searchQuery with a number of fragments to highlight per results.
     *
     * @param query
     * @param p
     * @param numberOfFragments
     * @return
     */
    public static NativeSearchQueryBuilder constructQueryWithHighlight(String query, Pageable p, int numberOfFragments) {
        return new NativeSearchQueryBuilder()
            .withQuery(queryBuilder(query))
            .withPageable(p)
            //exclu le content de la recherche pour alléger les requêtes
            .withSourceFilter(
                new FetchSourceFilterBuilder()
                    .withExcludes("content")
                    .build()
            )

            .withHighlightFields(
                new HighlightBuilder.Field("content")
                    .preTags("<mark>")
                    .postTags("</mark>")

                    .numOfFragments(numberOfFragments)
                    .fragmentSize(150)
            );
    }

    /**
     * construct the only query used by all
     *
     * @param query
     * @return
     */
    private static QueryBuilder queryBuilder(String query) {

        if (StringUtils.isEmpty(query)) {
            return QueryBuilders.matchAllQuery();
        }


        return QueryBuilders.queryStringQuery(query)
            .allowLeadingWildcard(true)
            .defaultOperator(QueryStringQueryBuilder.Operator.AND)
            .field("name^3")
            .field("content").field("path").field("version").field("project").field("extension");
    }
}
