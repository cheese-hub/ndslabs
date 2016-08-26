/* global angular:false */
'use strict';

/**
 * Define our ndslabs module here. All other files will 
 * use the single-argument notation for angular.module()
 */
angular.module('ndslabs', [ 'navbar', 'footer', 'ndslabs-services', 'ndslabs-filters', 'ndslabs-directives',  'ndslabs-api', 'ngWizard', 'ngGrid', 'ngAlert', 'ngTagsInput',
    'ngRoute', 'ngResource', 'ngCookies', 'ngAnimate', 'ngMessages', 'ui.bootstrap', 'ngPasswordStrength', 'angular-clipboard', 'ui.pwgen', 'frapontillo.gage', 'chart.js', 'ui.gravatar' ])

/**
 * If true, display verbose debug data as JSON
 */ 
.constant('DEBUG', false)

/**
 *TODO: Whether or not to use mock data (false if talking to live etcd)
 */ 
//.constant('MOCKDATA', false)

/**
 * Make lodash available for injection into controllers
 */
.constant('_', window._)

/**
 * The route to our "Login" View
 */
.constant('LoginRoute', '/login')

/**
 * The route to our "Request Access" View
 */
.constant('SignUpRoute', '/register')

/**
 * The route to our "Verify Account" View
 */
.constant('VerifyAccountRoute', '/register/verify')

/**
 * The route to our "Recover Password" View
 */
.constant('ResetPasswordRoute', '/recover')

/**
 * The route to the "AppStore" view
 */
.constant('AppStoreRoute', '/store')

/**
 * The route to the "Add Application Spec" view
 */
.constant('AddSpecRoute', '/store/add')

/**
 * The route to the "Edit Application Spec" view
 */
.constant('EditSpecRoute', '/store/edit/:specKey')

/**
 * The route to our "Dashboard" View
 */
.constant('HomeRoute', '/home')

/**
 * The route to the "Add Application Service" view
 */
.constant('AddServiceRoute', '/home/:stackId/add/:service')

/**
 * The route to the "Edit Application Service" view
 */
.constant('EditServiceRoute', '/home/:stackId/edit/:service')

/**
 * The route to the "Application Service Console" view
 */
.constant('ConsoleRoute', '/home/:stackId/console/:service')


/**
 * The version/revision of this GUI
 */
.constant('BuildVersion', '1.0.2-devel')
.constant('BuildDate', '')

/**
 * Hostname / Port for communicating with etcd
 * 
 * This must be the external IP and nodePort (when running in k8)
 * 
 * TODO: We assume this is running on the same machine as the apiserver.
 */ 
.constant('ApiHost', '192.168.99.100')
.constant('ApiPort', '30001')
.constant('ApiPath', '/api')
.constant('ApiSecure', false) 

.constant('WebsocketPath', '/console')

/** Store our built ApiUri here */
.value('ApiUri', { api: '', ws: '' })

/**
 * Logic for communicating with etcd (powered by swagger-js-codegen)
 * @param {string} ApiHost - the hostname defined above
 * @param {string} ApiPort - the port defined above
 * @param {string} ApiPath - the path defined above
 * @param {Object} ApiServer - the REST API client generated by swagger; see 'app/shared/NdsLabsRestApi.js'
 */ 
.factory('NdsLabsApi', [ 'ApiHost', 'ApiPort', 'ApiPath', 'ApiSecure', 'WebsocketPath', 'ApiUri', 'ApiServer', 
    function(ApiHost, ApiPort, ApiPath, ApiSecure, WebsocketPath, ApiUri, ApiServer) {
  // TODO: Investigate options / caching
  // XXX: Caching may not be possible due to the unique token sent with every request
  
  // Start with the protocol
  if (ApiSecure) {
    ApiUri.api = 'https://' + ApiHost
    ApiUri.ws = 'wss://' + ApiHost
  } else {
    ApiUri.api = 'http://' + ApiHost
    ApiUri.ws = 'ws://' + ApiHost
  }
  
  // Add on the port suffix, if applicable
  if (ApiPort) {
    var portSuffix = ':' + ApiPort  
    
    ApiUri.api += portSuffix
    ApiUri.ws += portSuffix
  }
  
  // Add on the path suffix, if applicable
   ApiUri.api += ApiPath
   ApiUri.ws += ApiPath + WebsocketPath
  
  // Instantiate a new client for the ApiServer using our newly built uri
  return new ApiServer(ApiUri.api);
}])

/**
 * A shared store for our AuthInfo, done as a provider so that we
 * can easily inject it into the .config() block below
 */ 
.provider('AuthInfo', function() {
  this.authInfo = {
    namespace: '',
    password: '',
    saveCookie: false,
    project: null,
    token: null
  };

  this.$get = function() {
    var authInfo = this.authInfo;
    return {
      get: function() { return authInfo; },
      purge: function() {
        // We overwrite this stub function with "terminateSession" inside of the ".run()" handler below
        return true;
      }
    }
  };
})

/**
 * Configure routes / HTTP for our app using the services defined above
 */
.config([ '$routeProvider', '$httpProvider', '$logProvider', 'DEBUG', 'AuthInfoProvider', 'LoginRoute', 'AppStoreRoute', 'HomeRoute', 'ConsoleRoute', 'AddServiceRoute', 'EditServiceRoute', 'AddSpecRoute', 'EditSpecRoute', 'VerifyAccountRoute', 'ResetPasswordRoute', 'SignUpRoute',
    function($routeProvider, $httpProvider, $logProvider, DEBUG, authInfo, LoginRoute, AppStoreRoute, HomeRoute, ConsoleRoute, AddServiceRoute, EditServiceRoute, AddSpecRoute, EditSpecRoute, VerifyAccountRoute, ResetPasswordRoute, SignUpRoute) {
  // Squelch debug-level log messages
  $logProvider.debugEnabled(DEBUG);
      
  // Setup default behaviors for encountering HTTP errors
  $httpProvider.interceptors.push(['$rootScope', '$cookies', '$q', '$location', '$log', '_', 'DEBUG', 'ApiUri', 'AuthInfo',
      function (scope, $cookies, $q, $location, $log, _, DEBUG, ApiUri, AuthInfo) {
    return {
      // Attach our auth token to each outgoing request (to the api server)
      'request': function(config) {
        // If this is a request for our API server
        if (_.includes(config.url, ApiUri.api)) {
          // If this was *not* an attempt to authenticate
          if (!_.includes(config.url, '/authenticate')) {
            // We need to attach our token to this request
            config.headers['Authorization'] = 'Bearer ' + $cookies.get('token');
          }
        }
        return config;
      },
      'requestError': function(rejection) {
        if (_.includes(rejection.config.url, ApiUri.api)) {
          $log.error("Request error encountered: " + rejection.config.url);
        }
        return $q.reject(rejection);
      },
      'response': function(response) {
        // If this is a response from our API server
        if (_.includes(response.config.url, ApiUri.api)) {
          // If this was in response to an /authenticate or /refresh_token request
          if ((_.includes(response.config.url, '/authenticate') && response.config.method === 'POST')
              || (_.includes(response.config.url, '/refresh_token') && response.config.method === 'GET')) {
            // This response should contain a new token, so save it as a cookie
            $cookies.put('token', response.data.token);
          }
        }
        
        return response;
      },
      'responseError': function(rejection) {
        // If this is a response from our API server
        if (_.includes(rejection.config.url, ApiUri.api)) {
          $log.error("Response error encountered: " + rejection.config.url);
        
          // Read out the HTTP error code
          var status = rejection.status;
          
          // Handle HTTP 401: Not Authorized - User needs to provide credentials
          if (status == 401) {
            // TODO: If we want to intercept the route to redirect them after a successful login
            //window.location = "/account/login?redirectUrl=" + Base64.encode(document.URL);
            
            // Purge current session data
            authInfo.authInfo.token = null;
            $cookies.remove('token');
            $cookies.remove('namespace');
            
            // Route to Login Page to prompt for credentials
            if ($location.path() !== LoginRoute) {
              $location.path(LoginRoute);
            }
            return $q.reject(rejection);
          }
        }
        
        // otherwise
        return $q.reject(rejection);
      }
    };
  }]);
      
  // Setup routes to our different pages
  $routeProvider
  .when(LoginRoute, {
    title: 'Sign In to NDS Labs',
    controller: 'LoginController',
    templateUrl: 'app/login/login.html'
  })
  .when(SignUpRoute, {
    title: 'Sign Up for NDS Labs',
    controller: 'SignUpController',
    templateUrl: 'app/login/signUp/signUp.html'
  })
  .when(VerifyAccountRoute, {
    title: 'E-mail verified!',
    controller: 'VerifyAccountController',
    templateUrl: 'app/login/verify/verify.html'
  })
  .when(ResetPasswordRoute, {
    title: 'Reset Password',
    controller: 'ResetPasswordController',
    templateUrl: 'app/login/reset/reset.html'
  })
  .when(AppStoreRoute, {
    title: 'NDS Labs Catalog',
    controller: 'CatalogController',
    templateUrl: 'app/appStore/catalog.html'
  })
  .when(AddSpecRoute, {
    title: 'Add Application',
    controller: 'AddOrEditSpecController',
    templateUrl: 'app/appStore/addOrEdit/addOrEditSpec.html'
  })
  .when(EditSpecRoute, {
    title: 'Edit Application',
    controller: 'AddOrEditSpecController',
    templateUrl: 'app/appStore/addOrEdit/addOrEditSpec.html'
  })
  .when(HomeRoute, {
    title: 'NDS Labs Dashboard',
    controller: 'DashboardController',
    templateUrl: 'app/dashboard/dashboard.html'
  })
  .when(AddServiceRoute, {
    title: 'Add Application Service',
    controller: 'AddOrEditServiceController',
    templateUrl: 'app/dashboard/service/addOrEditService.html'
  })
  .when(EditServiceRoute, {
    title: 'Edit Application Service',
    controller: 'AddOrEditServiceController',
    templateUrl: 'app/dashboard/service/addOrEditService.html'
  })
  .when(ConsoleRoute, {
    title: 'Application Service Console',
    controller: 'ConsoleController',
    templateUrl: 'app/dashboard/console/console.html'
  })
  .otherwise({ redirectTo: LoginRoute });
}])

/**
 * Once configured, run this section of code to finish bootstrapping our app
 */
.run([ '$rootScope', '$window', '$location', '$log', '$interval', '$cookies', '$uibModalStack', 'Stacks', '_', 'AuthInfo', 'LoginRoute', 'AppStoreRoute', 'HomeRoute', 'NdsLabsApi', 'AutoRefresh', 'ServerData',
    function($rootScope, $window, $location, $log, $interval, $cookies, $uibModalStack, Stacks, _, authInfo, LoginRoute, AppStoreRoute, HomeRoute, NdsLabsApi, AutoRefresh, ServerData) {
  
  // Grab saved auth data from cookies and attempt to use the leftover session
  var token = $cookies.get('token');
  var namespace = $cookies.get('namespace');
  if (token && namespace) {
    // Pull our token / namespace from cookies
    authInfo.get().token = token;
    authInfo.get().namespace = namespace;
  }
      
  // Make _ bindable in partial views
  // TODO: Investigate performance concerns here...
  $rootScope._ = window._;
  
  // Change the tab/window title when we change routes
  $rootScope.$on('$routeChangeSuccess', function (event, current, previous) {
    if (current.$$route) {
      $window.document.title = current.$$route.title;
    } else {
      $log.error('Encountered undefined route...');
    }
  });
  
  // When user changes routes, check that they are still authed
  $rootScope.$on( "$routeChangeStart", function(event, next, current) {
    // Skip token checking for the "Verify Account" View
    if (next.$$route.templateUrl === 'app/login/verify/verify.html') {
      return;
    }
    
    // Define the logic for ending a user's session in the browser
    var authInterval = null;
    var terminateSession = authInfo.purge = function() {
      // Cancel the auth check interval
      if (authInterval) {
        $interval.cancel(authInterval);
        authInfo.tokenInterval = authInterval = null;
      }
      
      if (authInfo.get().token) {
        
        // Purge current session data
        authInfo.get().token = null;
        $cookies.remove('token');
        $cookies.remove('namespace');
        
        // Close any open modals
        $uibModalStack.dismissAll();
        
        // Stop any running auto-refresh interval
        AutoRefresh.stop();
        
        // Purge any server data
        ServerData.purgeAll();
        
              
        // user needs to log in, redirect to /login
        if (!_.includes(next.templateUrl, "app/login/login.html")
            && !_.includes(next.templateUrl, "app/login/signUp/signUp.html")
            && !_.includes(next.templateUrl, "app/login/verify/verify.html")) {
          $location.path(LoginRoute);
        }
      }
    };
    
    // Check our token every 60s
    var tokenCheckMs = 60000;
    
    // Every so often, check that our token is still valid
    var checkToken = function() {
      NdsLabsApi.getCheckToken().then(function() { $log.debug('Token is still valid.'); }, function() {
        $log.error('Token expired, redirecting to login.');
        terminateSession();
        authInfo.purge();
      });
    };
  
    // Check if the token is still valid on route changes
    var token = $cookies.get('token');
    if (token) {
      authInfo.get().token = token;
      authInfo.get().namespace = $cookies.get('namespace');
      NdsLabsApi.getRefreshToken().then(function() {
        $log.debug('Token refreshed: ' + authInfo.get().token);
        
        // Populate all displayed data here from etcd
        ServerData.populateAll(authInfo.get().namespace).finally(function() {
          /*if (InitialRedirect) {
            InitialRedirect = false;
            var dest = Stacks.all.length > 0 ? HomeRoute : AppStoreRoute;
            debugger;
            $location.path(dest);
          }*/
        });
        // Restart our token check interval
        if (authInterval) {
          $interval.cancel(authInterval);
          authInterval = null;
        }
        authInfo.tokenInterval = authInterval = $interval(checkToken, tokenCheckMs);
        
      }, function() {
        $log.debug('Failed to refresh token!');
        
        // TODO: Allow login page to reroute user to destination?
        // XXX: This would matter more if there are multiple views
        //authInfo.returnRoute = next.$$route.originalPath;
        
        terminateSession();
      });
    } else {
      terminateSession();
    }
  });
}]);
