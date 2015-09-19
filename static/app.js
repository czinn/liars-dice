var app = angular.module("myApp", []);
 
app.config(["$interpolateProvider", function($interpolateProvider) {
  $interpolateProvider.startSymbol("{[");
  $interpolateProvider.endSymbol("]}");
}]);

app.controller("MainController", ["$http", "$timeout", function($http, $timeout) {
  var ctrl = this;
  ctrl.token = null;

  if (old_token.length > 0) {
    $http.get("/username")
      .then(function(response) {
        ctrl.token = old_token;
        ctrl.username = response.data.username; // should be the same
        startUpdates();
      }, function(response) {
        // TODO: handle error
      });
  }

  ctrl.getToken = function() {
    $http.get("/token?username=" + ctrl.username)
      .then(function(response) {
        ctrl.token = response.data.token;
        ctrl.username = response.data.username; // should be the same
        startUpdates();
      }, function(response) {
        // TODO: handle error
      });
  };

  ctrl.sendChat = function() {
    var msg = ctrl.chatmsg;
    ctrl.chatmsg = "";
    $http.post("/chat", {"message": msg})
      .then(function(response) {
        // TODO
      }, function(response) {
        // TODO
      });
  };

  function startUpdates() {
    var last_id = 0;
    (function tick() {
      $http.get("/updates?id=" + last_id)
        .then(function(response) {
          for (var i = 0; i < response.data.updates.length; i++) {
            console.log(response.data.updates[i]);
            last_id = response.data.updates[i].id;
          }
          $timeout(tick, 1000);
        }, function(response) {
          // TODO: handle error
          //$timeout(tick, 1000);
        });
    })();
  }
}]);