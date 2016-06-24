(function() {
    'use strict';

    angular
        .module('researchApp')
        .config(stateConfig);

    stateConfig.$inject = ['$stateProvider'];

    function stateConfig($stateProvider) {
        $stateProvider.state('home', {
            parent: 'app',
            url: '/?page&sort&search',
            data: {
                authorities: [],
                pageTitle: 'researchApp.file.home.title'
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
                    search: null
                },
/*            resolve: {
                mainTranslatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate,$translatePartialLoader) {
                    $translatePartialLoader.addPart('home');
                    return $translate.refresh();
*/
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
                    translatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate, $translatePartialLoader) {
                        $translatePartialLoader.addPart('file');
                        $translatePartialLoader.addPart('global');
                        return $translate.refresh();
                    }]
                }
            })
            .state('file.crawler', {
                parent: 'app',
                url: '/crawler',
                data: {
                    authorities: ['ROLE_USER']
                },
                onEnter: ['$stateParams', '$state', '$uibModal', function ($stateParams, $state, $uibModal) {
                    $uibModal.open({
                        templateUrl: 'app/entities/file/file-dialog.html',
                        controller: 'FileDialogController',
                        controllerAs: 'vm',
                        backdrop: 'static',
                        size: 'lg',
                        resolve: {
                            entity: function () {
                                return {
                                    name: null,
                                    extension: null,
                                    path: null,
                                    content: null,
                                    version: null,
                                    size: null,
                                    id: null
                                };
                            }
                        }
                    }).result.then(function () {
                        $state.go('file', null, {reload: true});
                    }, function () {
                        $state.go('file');
                    });
                }]
            })

            .state('home-detail', {
                parent: 'app',
                url: '/file-detail/{id}',
                data: {
                    authorities: ['ROLE_USER'],
                    pageTitle: 'researchApp.file.detail.title'
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
