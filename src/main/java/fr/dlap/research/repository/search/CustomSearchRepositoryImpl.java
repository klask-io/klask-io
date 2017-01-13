package fr.dlap.research.repository.search;

import fr.dlap.research.config.Constants;
import fr.dlap.research.domain.File;
import fr.dlap.research.repository.search.mapper.ResultHighlightMapper;
import fr.dlap.research.repository.search.mapper.ResultTruncatedContentMapper;
import fr.dlap.research.web.rest.util.Queries;
import org.apache.commons.lang3.StringUtils;
import org.elasticsearch.action.search.SearchRequestBuilder;
import org.elasticsearch.action.search.SearchResponse;
import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.SearchHit;
import org.elasticsearch.search.aggregations.Aggregation;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.aggregations.bucket.terms.StringTerms;
import org.elasticsearch.search.aggregations.bucket.terms.Terms;
import org.elasticsearch.search.aggregations.bucket.terms.TermsBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.core.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.query.NativeSearchQuery;
import org.springframework.data.elasticsearch.core.query.NativeSearchQueryBuilder;
import org.springframework.data.elasticsearch.core.query.SearchQuery;

import javax.inject.Inject;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Created by jeremie on 27/06/16.
 */
@Configuration
public class CustomSearchRepositoryImpl implements CustomSearchRepository {

    private final Logger log = LoggerFactory.getLogger(CustomSearchRepositoryImpl.class);

    @Inject
    private ElasticsearchTemplate elasticsearchTemplate;

    @Override
    public Page<File> findWithHighlightedSummary(Pageable pageable, String query, List<String> version, List<String> project) {
        //QueryBuilder searchQuery = Queries.constructQuery(query);
        //return elasticsearchTemplate.queryForPage(new NativeSearchQuery(searchQuery), File.class, new ResultHighlightMapper());

        NativeSearchQueryBuilder nativeQuery = Queries.constructQueryWithHighlight(query, pageable, 3);

        BoolQueryBuilder ensembleVersion = QueryBuilders.boolQuery();
        BoolQueryBuilder ensembleProjet = QueryBuilders.boolQuery();

        if (version != null && !version.isEmpty()) {
            ensembleVersion = ensembleVersion.should(QueryBuilders.termsQuery("version.unique", version));
        }
        if (project != null && !project.isEmpty()) {
            ensembleProjet = ensembleProjet.should(QueryBuilders.termsQuery("project.unique", project));
        }

        nativeQuery = nativeQuery.withFilter(QueryBuilders.boolQuery().must(ensembleVersion).must(ensembleProjet));
        log.debug("query : {}", nativeQuery.toString());
        SearchQuery searchQuery = nativeQuery.build();
        log.debug("query : {}", searchQuery.getQuery());
        log.debug("filter: {}", searchQuery.getFilter());
        return elasticsearchTemplate.queryForPage(searchQuery, File.class, new ResultHighlightMapper());

//        SearchResponse searchResponse = searchRequestBuilder.execute().actionGet();
    }


    /**
     * Return records for query, and highlight the fragment of content with the ResultHighlightMapper
     *
     * @param pageable
     * @param query
     * @param version
     * @param project
     * @return
     */
    @Override
    public Page<File> customSearchWithHighlightedSummary(Pageable pageable, String query, List<String> version, List<String> project, List<String> extension) {
        if (StringUtils.isEmpty(query)) {
            log.error("customSearchWithHighlightedSummary return null in case where query = " + query);
            return null;
        }
        NativeSearchQueryBuilder nativeSearchQueryBuilder = Queries.constructSearchQueryBuilder(query);
        NativeSearchQuery nativeSearchQuery = nativeSearchQueryBuilder.build();

        SearchRequestBuilder searchRequestBuilder = constructRequestBuilder(nativeSearchQuery, pageable, version, project, extension);
        searchRequestBuilder.setFetchSource(null, "content");//dont get the content, we have the highlight !

        SearchResponse response = searchRequestBuilder.execute().actionGet();

        SearchHit[] hits = response.getHits().hits();
        ResultHighlightMapper mapper = new ResultHighlightMapper();
        return mapper.mapResults(response, File.class, nativeSearchQuery.getPageable());

    }


    /**
     * Return all records, and truncate the content with the ResultTruncatedContentMapper
     *
     * @param pageable
     * @param version
     * @param project
     * @return
     */
    @Override
    public Page<File> customfindAll(Pageable pageable, List<String> version, List<String> project, List<String> extension) {
        NativeSearchQueryBuilder nativeSearchQueryBuilder = Queries.constructSearchQueryBuilder("");
        NativeSearchQuery nativeSearchQuery = nativeSearchQueryBuilder.build();

        SearchRequestBuilder searchRequestBuilder = constructRequestBuilder(nativeSearchQuery, pageable, version, project, extension);
        SearchResponse response = searchRequestBuilder.execute().actionGet();

        SearchHit[] hits = response.getHits().hits();
        ResultTruncatedContentMapper mapper = new ResultTruncatedContentMapper();
        return mapper.mapResults(response, File.class, nativeSearchQuery.getPageable());

//        }

    }


    @Override
    public Map<String, Long> aggregateByFieldUnique(String field, String filtre) {

        TermsBuilder aggregation = AggregationBuilders.terms("top_" + field)
            .field(field + ".unique")
            .size(0)// le résultat n'est pas complet si on ne précise pas la taille, 0 : infini
            // (voir : https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-terms-aggregation.html#_size)
            .order(Terms.Order.aggregation("_count", false));

        SearchResponse response = createResponse(filtre, aggregation);

        Map<String, Aggregation> results = response.getAggregations().asMap();
        StringTerms topField = (StringTerms) results.get("top_" + field);

        //sur l'ensemble des buckets, triés par ordre décroissant sur le nombre de documents
        // on retourne une Map (LinkedHashMap) pour conserver l'ordre avec la clé, le nom du champ (exemple version), et la valeur, le nombre de docs
        //exemple :
        // "trunk" -> 34012
        // "branche_1" -> 35800
        return topField.getBuckets()
            .stream()
            .sorted(Comparator.comparing(Terms.Bucket::getDocCount).reversed())
            .collect(
                Collectors.toMap(bucket -> bucket.getKeyAsString(), bucket -> bucket.getDocCount(), (v1, v2) -> v1, LinkedHashMap::new
                ));

    }


    /**
     * construct a SearchRequestBuilder from scratch
     *
     * @param pageable
     * @param nativeSearchQuery
     * @param version
     * @param project
     * @return
     */
    private SearchRequestBuilder constructRequestBuilder(NativeSearchQuery nativeSearchQuery, Pageable pageable, List<String> version, List<String> project, List<String> extension) {
        //SearchRequestBuilder searchRequestBuilder = Queries.constructSearchRequestBuilder(query, pageable, 3, elasticsearchTemplate.getClient());

        //par défaut, renvoi la première page, si rien n'est spécifié
        if (pageable == null || pageable.getSort() == null) {
            pageable = new PageRequest(0, Constants.PAGE_SIZE, new Sort("_score"));
        }

        BoolQueryBuilder ensembleVersion = QueryBuilders.boolQuery();
        BoolQueryBuilder ensembleProjet = QueryBuilders.boolQuery();
        BoolQueryBuilder ensembleExtension = QueryBuilders.boolQuery();
        BoolQueryBuilder filter = QueryBuilders.boolQuery();

        if (version != null && !version.isEmpty()) {
            ensembleVersion = ensembleVersion.should(QueryBuilders.termsQuery("version.unique", version));
            filter = filter.must(ensembleVersion);
        }
        if (project != null && !project.isEmpty()) {
            ensembleProjet = ensembleProjet.should(QueryBuilders.termsQuery("project.unique", project));
            filter = filter.must(ensembleProjet);
        }
        if (extension != null && !extension.isEmpty()) {
            ensembleExtension = ensembleExtension.should(QueryBuilders.termsQuery("extension.unique", extension));
            filter = filter.must(ensembleExtension);
        }


//        if (StringUtils.isNotEmpty(query)) {
        SearchRequestBuilder searchRequestBuilder = elasticsearchTemplate.getClient().prepareSearch(Constants.INDEX_NAME)
            .setTypes(Constants.TYPE_NAME)
            .setQuery(nativeSearchQuery.getQuery())
            .setHighlighterEncoder("html")//permet d'échapper tous les caractères html pour une sortie correcte sur le frontend
            .setHighlighterFragmentSize(100)
            .setHighlighterNumOfFragments(3)
            .setHighlighterPreTags("<mark>")
            .setHighlighterPostTags("</mark>")
            .addHighlightedField("content")
            .addHighlightedField("path")
            .setHighlighterBoundaryChars(new char[]{'\n'})
            .setHighlighterBoundaryMaxScan(200)
            .setHighlighterType("fvh")
            .setTrackScores(true)
            .setFrom(pageable.getOffset())
            .setSize(pageable.getPageSize())
            .setPostFilter(filter);

        pageable.getSort().forEach(
            order -> searchRequestBuilder.addSort(order.getProperty(),
                SortOrder.valueOf(order.getDirection().name()))
        );
        return searchRequestBuilder;
    }


    /**
     * create a SearchResponse with the main search query (from the FileResource /api/_search/files)
     *
     * @param query
     * @param aggregation
     * @return
     */
    private SearchResponse createResponse(String query, TermsBuilder aggregation) {
        SearchResponse response;
        if (StringUtils.isNotEmpty(query)) {
            response = elasticsearchTemplate.getClient().prepareSearch(Constants.INDEX_NAME)
                .setTypes(Constants.TYPE_NAME)
                //ici nous utilisons la même querybuilder que dans la recherche principale pour obtenir justement
                //le même filtrage sur les versions courantes
                .setQuery(Queries.constructQuery(query))
                .addAggregation(aggregation)
                .execute().actionGet();
        } else {
            response = elasticsearchTemplate.getClient().prepareSearch(Constants.INDEX_NAME)
                .setTypes(Constants.TYPE_NAME)
                .addAggregation(aggregation)
                .execute().actionGet();
        }
        return response;
    }
}
