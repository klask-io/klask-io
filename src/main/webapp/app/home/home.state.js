(function() {
    'use strict';

    angular
        .module('klaskApp')
        .config(stateConfig);

    stateConfig.$inject = ['$stateProvider'];

    function stateConfig($stateProvider) {
        $stateProvider.state('home', {
            parent: 'app',
            url: '/?page&sort&version&project&extension&search',
            data: {
                authorities: ['ROLE_USER'],
                pageTitle: 'klaskApp.file.home.title'
            },
            views: {
                'content@': {
                    templateUrl: 'app/home/home.html',
                    controller: 'HomeController',
                    controllerAs: 'vm'
                }
            },
            params: {
                page: {
                    value: '1',
                    squash: true
                },
                sort: {
                    value: 'id,asc',
                    squash: true
                },
                version: {
                    value: '',
                    squash: true
                },
                project: {
                    value: '',
                    squash: true
                },
                extension: {
                    value: '',
                    squash: true
                },
                search: null
            },
            resolve: {
                pagingParams: ['$stateParams', 'PaginationUtil', function ($stateParams, PaginationUtil) {
                    return {
                        page: PaginationUtil.parsePage($stateParams.page),
                        sort: $stateParams.sort,
                        predicate: PaginationUtil.parsePredicate($stateParams.sort),
                        ascending: PaginationUtil.parseAscending($stateParams.sort),
                        search: $stateParams.search
                    };
                }],
                filters: ['$stateParams', function ($stateParams, PaginationUtil) {
                    return {
                        version:$stateParams.version,
                        project:$stateParams.project,
                        extension:$stateParams.extension,
                        search: $stateParams.search
                    }
                }],
                translatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate, $translatePartialLoader) {
                    $translatePartialLoader.addPart('file');
                    $translatePartialLoader.addPart('global');
                    return $translate.refresh();
                }]
            }
        })
        .state('home-detail', {
            parent: 'app',
            url: '/home-detail/{id}',
            data: {
                authorities: ['ROLE_USER'],
                pageTitle: 'klaskApp.home.detail.title'
            },
            views: {
                'content@': {
                    templateUrl: 'app/home/home-detail.html',
                    controller: 'FileDetailController',
                    controllerAs: 'vm'
                }
            },
            resolve: {
                translatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate, $translatePartialLoader) {
                    $translatePartialLoader.addPart('file');
                    return $translate.refresh();
                }],
                entity: ['$stateParams', 'File', function ($stateParams, File) {
                    return File.get({id: $stateParams.id}).$promise;
                }]
            }
        });
    }
})();
