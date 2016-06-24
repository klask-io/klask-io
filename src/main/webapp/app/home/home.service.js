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

(function () {
    'use strict';
    angular
        .module('researchApp')
        .factory('Crawler', Crawler);

    Crawler.$inject = ['$resource'];

    function Crawler($resource) {
        var resourcelUrl = "api/crawler";

        return $resource(resourcelUrl, {}, {
            'crawler': {method: 'POST'}
        });
    }

})();
