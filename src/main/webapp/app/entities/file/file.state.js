(function () {
    'use strict';

    angular
        .module('researchApp')
        .config(stateConfig);

    stateConfig.$inject = ['$stateProvider'];

    function stateConfig($stateProvider) {
        $stateProvider
            .state('file', {
                parent: 'entity',
                url: '/file?page&sort&search',
                data: {
                    authorities: ['ROLE_USER'],
                    pageTitle: 'researchApp.file.home.title'
                },
                views: {
                    'content@': {
                        templateUrl: 'app/entities/file/files.html',
                        controller: 'FileController',
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
                        $translatePartialLoader.addPart('file');
                        $translatePartialLoader.addPart('global');
                        return $translate.refresh();
                    }]
                }
            })
            .state('file-detail', {
                parent: 'entity',
                url: '/file/{id}',
                data: {
                    authorities: ['ROLE_USER'],
                    pageTitle: 'researchApp.file.detail.title'
                },
                views: {
                    'content@': {
                        templateUrl: 'app/entities/file/file-detail.html',
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
            })
            .state('file.new', {
                parent: 'file',
                url: '/new',
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
            .state('file.edit', {
                parent: 'file',
                url: '/{id}/edit',
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
                            entity: ['File', function (File) {
                                return File.get({id: $stateParams.id}).$promise;
                            }]
                        }
                    }).result.then(function () {
                        $state.go('file', null, {reload: true});
                    }, function () {
                        $state.go('^');
                    });
                }]
            })
            .state('file.delete', {
                parent: 'file',
                url: '/{id}/delete',
                data: {
                    authorities: ['ROLE_USER']
                },
                onEnter: ['$stateParams', '$state', '$uibModal', function ($stateParams, $state, $uibModal) {
                    $uibModal.open({
                        templateUrl: 'app/entities/file/file-delete-dialog.html',
                        controller: 'FileDeleteController',
                        controllerAs: 'vm',
                        size: 'md',
                        resolve: {
                            entity: ['File', function (File) {
                                return File.get({id: $stateParams.id}).$promise;
                            }]
                        }
                    }).result.then(function () {
                        $state.go('file', null, {reload: true});
                    }, function () {
                        $state.go('^');
                    });
                }]
            });
    }

})();
