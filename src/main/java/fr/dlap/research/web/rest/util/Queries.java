package fr.dlap.research.web.rest.util;

import org.elasticsearch.index.query.QueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.index.query.QueryStringQueryBuilder;
import org.elasticsearch.search.highlight.HighlightBuilder;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.core.query.FetchSourceFilterBuilder;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;

/**
 * Created by jeremie on 27/06/16.
 */
public class Queries {

    public static QueryBuilder constructQuery(String query) {
        /*return QueryBuilders.queryStringQuery(query)
            .defaultOperator(QueryStringQueryBuilder.Operator.AND);*/
        return new NativeSearchQueryBuilder()
            .withQuery(
                //QueryBuilders.queryStringQuery(query)
                //.defaultOperator(QueryStringQueryBuilder.Operator.AND)

                //QueryBuilders.termQuery("content", query)

                QueryBuilders.boolQuery()
                    .should(QueryBuilders.termQuery("content", query))
                    .should(
                        QueryBuilders.queryStringQuery(query)
                            .defaultOperator(QueryStringQueryBuilder.Operator.AND)
                    )

            )

            .withHighlightFields(
                new HighlightBuilder.Field("content")
                    .preTags("<mark>")
                    .postTags("</mark>")
                    .numOfFragments(1)
            )
            .build().getQuery();
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
            .withQuery(
                QueryBuilders.boolQuery()
                    .should(QueryBuilders.termQuery("content", query))
                    .should(
                        QueryBuilders.queryStringQuery(query)
                            .defaultOperator(QueryStringQueryBuilder.Operator.AND)
                    )

                //QueryBuilders.queryStringQuery(query)
                //.defaultOperator(QueryStringQueryBuilder.Operator.AND)
                    //TODO : attention, si on souhaite que la recherche s'effectue bien sur l'ensemble des champs
                    //il faut veuillez à ce qu'il soit tous présent ici
                    //en cas d'ajout, penser à les ajouter ici
                //.field("content")


            )
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

}
