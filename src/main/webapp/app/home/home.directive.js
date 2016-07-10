/*(function () {
    'use strict';

    angular
        .module('researchApp')
        .directive('nagPrism', highlighter);

    function highlighter() {
        return {
            restrict: 'A',
            scope: {
                source: '@'
            },
            link: {
                post: function (scope, element, attrs) {
                    SyntaxHighlighter.all();
                    scope.$watch('vm.file.content', function (v) {
                        SyntaxHighlighter.highlight();
                    });
                }
            }
        };
    }
})();*/

(function () {
    'use strict';

    angular
        .module('researchApp')
        .directive('nagPrism', highlight);

    function highlight(){
        return {
            restrict: 'A',
            transclude: true,
            scope: {
                source: '@'
            },
            link: function(scope, element, attrs, controller, transclude) {
                scope.$watch('source', function(v) {
                    element.find("code").text(v).html();

                    Prism.highlightElement(element.find("code")[0]);
                });

                transclude(function(clone) {
                    if (clone.html() !== undefined) {
                        element.find("code").html(clone.html());
                        $compile(element.contents())(scope.$parent);
                    }
                });
            },
            template: "<code></code>"
        };

    }
})();

(function () {
    'use strict';

    angular
        .module('researchApp')
        .directive('html', htmlPrint);

    function htmlPrint(){
      return {
        restrict: 'A',
        link: function (scope, element, attrs) {
          element.html(attrs.html);
        }
      };
    }
})();

