(function () {
    'use strict';
    angular
        .module('researchApp')
        .factory('File', File);

    File.$inject = ['$resource'];

    function File($resource) {
        var resourceUrl = 'api/files/:id';

        return $resource(resourceUrl, {}, {
            'query': {method: 'GET', isArray: true},
            'get': {
                method: 'GET',
                transformResponse: function (data) {
                    if (data) {
                        data = angular.fromJson(data);
                    }
                    return data;
                }
            },
            'update': {method: 'PUT'}
        });
    }
})();
