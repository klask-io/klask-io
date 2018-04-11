package io.klask.web.rest.util;

import io.klask.config.Constants;
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
        /*return QueryBuilders.queryStringQuery(query)
            .defaultOperator(QueryStringQueryBuilder.Operator.AND);*/
        return new NativeSearchQueryBuilder()

            .withQuery(
                queryBuilder(query)
            )
            .build().getQuery();
    }

    public static NativeSearchQueryBuilder constructSearchQueryBuilder(String query) {
        /*return QueryBuilders.queryStringQuery(query)
            .defaultOperator(QueryStringQueryBuilder.Operator.AND);*/
        return new NativeSearchQueryBuilder()
            .withQuery(
                queryBuilder(query)
            )

            //exclu le content de la recherche pour alléger les requêtes
//            .withSourceFilter(
//                new FetchSourceFilterBuilder()
//                    .withExcludes("content")
//                    .build()
//            )
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
            //.withQuery(termQuery("content", query))
            .withQuery(queryBuilder(query))
            //.withFields("content", "name")
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


        //return QueryBuilders.queryStringQuery(query).defaultOperator(QueryStringQueryBuilder.Operator.AND);

        if (StringUtils.isEmpty(query)) {
            return QueryBuilders.matchAllQuery();
        }

//        return QueryBuilders.multiMatchQuery(query)
//            .operator(MatchQueryBuilder.Operator.AND)
//            .field("name^3")
//            .field("content").field("path").field("version").field("project")
//            ;

        return QueryBuilders.queryStringQuery(query)
            .allowLeadingWildcard(true)
            .defaultOperator(QueryStringQueryBuilder.Operator.AND)
            .field("name^3")
            .field("content").field("path").field("version").field("project").field("extension")

            ;

        //QueryBuilders.queryStringQuery(query)
        //.defaultOperator(QueryStringQueryBuilder.Operator.AND)
        //TODO : attention, si on souhaite que la recherche s'effectue bien sur l'ensemble des champs
        //il faut veuillez à ce qu'il soit tous présent ici
        //en cas d'ajout, penser à les ajouter ici
        //.field("content")



      /*  return QueryBuilders.boolQuery()
            .should(QueryBuilders.termQuery("content", query))
            .should(
                QueryBuilders.queryStringQuery(query)
                    .defaultOperator(QueryStringQueryBuilder.Operator.AND)
            );*/
    }
}
