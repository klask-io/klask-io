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
 link: {post : function (scope, element, attrs) {
 SyntaxHighlighter.all();
 scope.$watch('vm.file.content', function (v) {
 SyntaxHighlighter.highlight();
 });
 }}
 };
 }
 })();*/


(function () {
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

    /*
     function (syntaxHighlighterFactory) {
     return {
     restrict: 'A',
     scope: {
     source: '@'
     },
     controller:function ($scope, $element, $attrs){
     this.highlight=$scope.$eval ($attrs.syntaxHighlighter);
     },
     link:function ($scope, $element, $attrs, controller) {

     if (! controller.highlight)
     return;

     syntaxHighlighterFactory.highlight ($element);

     }
     }
     });
     */
})();
/*
 (function () {
 'use strict';

 angular
 .module('researchApp')
 .factory('syntaxHighlighterService',syntaxHighlighterFactory);

 function syntaxHighlighterFactory(){
 return {
 highlight:function ($element) {
 $element.find ("pre").each (function() {
 $( this ).addClass( "brush:js" );
 SyntaxHighlighter.highlight ({}, this);
 });
 $element.find (".toolbar").remove ();
 $element.find (".syntaxhighlighter").attr("style", "overflow-y: hidden !important");
 }
 };
 }

 })();
 */
