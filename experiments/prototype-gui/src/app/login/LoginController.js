angular
.module('ndslabs')
.controller('LoginController', [ '$scope', '$cookies', '$location', 'AuthInfo', 'ExpressRoute', 'LoginRoute',
    function($scope, $cookies, $location, authInfo, ExpressRoute, LoginRoute) {
  $scope.settings = authInfo.get();
  $scope.errorMessage = '';
  
  var HomeRoute = ExpressRoute;
  
  if ($scope.settings.authenticated) {
    $location.path(HomeRoute);
  } else {
    $location.path(LoginRoute);
  }
  
  $scope.login = function() {
    console.log("Logged in!");
    $scope.settings.authenticated = true;
    if ($scope.settings.saveCookie === true) {
      $cookies.putObject('auth', $scope.settings);
    }
    $location.path(HomeRoute);
  };

  $scope.logout = function() {
    console.log("Logged out!");
    $scope.settings.authenticated = false;
    $cookies.remove('auth');
    $location.path(LoginRoute);
  };
}]);
