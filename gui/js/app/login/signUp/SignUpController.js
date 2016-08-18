/* global angular:false */

angular
.module('ndslabs')
/**
 * The controller for our "Sign-Up" Modal Window
 * 
 * @author lambert8
 * @see https://opensource.ncsa.illinois.edu/confluence/display/~lambert8/3.%29+Controllers%2C+Scopes%2C+and+Partial+Views
 */
.controller('SignUpController', [ '$scope', '$uibModalInstance', '$log', 'NdsLabsApi', 'Project', 'username', 'password', function($scope, $uibModalInstance, $log, NdsLabsApi, Project, username, password) {
  $scope.newProject = Project.create();
  $scope.progressMessage = '';
  
  if (username) {
    $scope.newProject.username = username;
  }
  
  if (password) {
    $scope.newProject.password = password;
  }
  
  $scope.ok = function(account) {
    $scope.progressMessage = 'Please wait...';
    $scope.errorMessage = '';
    
    NdsLabsApi.postRegister({ 'account': account }).then(function(data, xhr) {
      var user = account.namespace;
      var pass = account.password;
      
      $scope.errorMessage = '';
      
      // Clear out sensitive data
      $scope.newProject = Project.create();
      $uibModalInstance.close({ 'username': user, 'password': pass });
    }, function(response) {
      $log.error('Failed to create account: ' + account.namespace);
      $scope.errorMessage = response.body.Error || 'Username or e-mail address already in use';
    }).finally(function() {
      $scope.progressMessage = '';
    });
  };
  
  $scope.close = function() {
    $uibModalInstance.dismiss('cancel');
  };
}]);
