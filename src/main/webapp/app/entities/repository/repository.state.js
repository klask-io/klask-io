(function() {
    'use strict';

    angular
        .module('klaskApp')
        .config(stateConfig);

    stateConfig.$inject = ['$stateProvider'];

    function stateConfig($stateProvider) {
        $stateProvider
        .state('repository', {
            parent: 'entity',
            url: '/repository?page&sort&search',
            data: {
                authorities: ['ROLE_USER'],
                pageTitle: 'klaskApp.repository.home.title'
            },
            views: {
                'content@': {
                    templateUrl: 'app/entities/repository/repositories.html',
                    controller: 'RepositoryController',
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
                    $translatePartialLoader.addPart('repository');
                    $translatePartialLoader.addPart('repositoryType');
                    $translatePartialLoader.addPart('global');
                    return $translate.refresh();
                }]
            }
        })
        .state('repository-detail', {
            parent: 'entity',
            url: '/repository/{id}',
            data: {
                authorities: ['ROLE_USER'],
                pageTitle: 'klaskApp.repository.detail.title'
            },
            views: {
                'content@': {
                    templateUrl: 'app/entities/repository/repository-detail.html',
                    controller: 'RepositoryDetailController',
                    controllerAs: 'vm'
                }
            },
            resolve: {
                translatePartialLoader: ['$translate', '$translatePartialLoader', function ($translate, $translatePartialLoader) {
                    $translatePartialLoader.addPart('repository');
                    $translatePartialLoader.addPart('repositoryType');
                    return $translate.refresh();
                }],
                entity: ['$stateParams', 'Repository', function($stateParams, Repository) {
                    return Repository.get({id : $stateParams.id}).$promise;
                }]
            }
        })
        .state('repository.new', {
            parent: 'repository',
            url: '/new',
            data: {
                authorities: ['ROLE_USER']
            },
            onEnter: ['$stateParams', '$state', '$uibModal', function($stateParams, $state, $uibModal) {
                $uibModal.open({
                    templateUrl: 'app/entities/repository/repository-dialog.html',
                    controller: 'RepositoryDialogController',
                    controllerAs: 'vm',
                    backdrop: 'static',
                    size: 'lg',
                    resolve: {
                        entity: function () {
                            return {
                                path: null,
                                username: null,
                                password: null,
                                type: null,
                                name: null,
                                revision: null,
                                id: null
                            };
                        }
                    }
                }).result.then(function() {
                    $state.go('repository', null, { reload: true });
                }, function() {
                    $state.go('repository');
                });
            }]
        })
        .state('repository.edit', {
            parent: 'repository',
            url: '/{id}/edit',
            data: {
                authorities: ['ROLE_USER']
            },
            onEnter: ['$stateParams', '$state', '$uibModal', function($stateParams, $state, $uibModal) {
                $uibModal.open({
                    templateUrl: 'app/entities/repository/repository-dialog.html',
                    controller: 'RepositoryDialogController',
                    controllerAs: 'vm',
                    backdrop: 'static',
                    size: 'lg',
                    resolve: {
                        entity: ['Repository', function(Repository) {
                            return Repository.get({id : $stateParams.id}).$promise;
                        }]
                    }
                }).result.then(function() {
                    $state.go('repository', null, { reload: true });
                }, function() {
                    $state.go('^');
                });
            }]
        })
        .state('repository.delete', {
            parent: 'repository',
            url: '/{id}/delete',
            data: {
                authorities: ['ROLE_USER']
            },
            onEnter: ['$stateParams', '$state', '$uibModal', function($stateParams, $state, $uibModal) {
                $uibModal.open({
                    templateUrl: 'app/entities/repository/repository-delete-dialog.html',
                    controller: 'RepositoryDeleteController',
                    controllerAs: 'vm',
                    size: 'md',
                    resolve: {
                        entity: ['Repository', function(Repository) {
                            return Repository.get({id : $stateParams.id}).$promise;
                        }]
                    }
                }).result.then(function() {
                    $state.go('repository', null, { reload: true });
                }, function() {
                    $state.go('^');
                });
            }]
        });
    }

})();
