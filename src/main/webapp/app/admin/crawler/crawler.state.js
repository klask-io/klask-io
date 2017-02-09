(function() {
    'use strict';

    angular
        .module('klaskApp')
        .config(stateConfig);

    stateConfig.$inject = ['$stateProvider'];

    function stateConfig($stateProvider) {
        $stateProvider
        /*.state('crawler-configuration', {
            parent: 'admin',
            url: '/crawler',
            data: {
                authorities: ['ROLE_ADMIN'],
                pageTitle: 'crawler.title'
            },
            views: {
                'content@': {
                    templateUrl: 'app/admin/crawler/crawler.html',
                    controller: 'CrawlerController',
                    controllerAs: 'vm'
                }
            },
            resolve: {
                translatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate, $translatePartialLoader) {
                    $translatePartialLoader.addPart('crawler');
                    return $translate.refresh();
                }]
            }
        })
        */
        .state('crawler-configuration', {
                        parent: 'admin',
                        url: '/crawler',
                        data: {
                            authorities: ['ROLE_ADMIN'],
                            pageTitle: 'crawler.title'
                        },
                        views: {
                                        'content@': {
                                            templateUrl: 'app/admin/crawler/crawler.html',
                                            controller: 'CrawlerController',
                                            controllerAs: 'vm'
                                        }
                        },
                        resolve: {
                                        translatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate, $translatePartialLoader) {
                                            $translatePartialLoader.addPart('crawler');
                                            return $translate.refresh();
                                        }]
                                    }
                    });

    }
})();
