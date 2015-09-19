var app = angular.module("myApp", []);
 
app.config(["$interpolateProvider", function($interpolateProvider) {
  $interpolateProvider.startSymbol("{[");
  $interpolateProvider.endSymbol("]}");
}]);

app.controller("MainController", ["$http", "$timeout", function($http, $timeout) {
  var ctrl = this;
  ctrl.token = null;
  ctrl.status = null;
  ctrl.queueList = null;
  ctrl.currentQueue = null;

  if (old_token.length > 0) {
    $http.get("/status")
      .then(function(response) {
        ctrl.token = old_token;
        ctrl.username = response.data.username; // should be the same
        ctrl.status = response.data.status;
        if (ctrl.status.substring(0, 5) == "queue") {
          ctrl.currentQueue = {users: response.data.users, size: response.data.size};
          console.log(ctrl.currentQueue);
        }
        console.log(response.data);
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
        ctrl.status = "lobby";
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

  ctrl.joinQueue = function(queueIndex) {
    $http.post("joinqueue", {"queuetype": ctrl.queueList[queueIndex].size})
      .then(function(response) {
        getUpdates(null);
      }, function(response) {

      });
  };

  ctrl.leaveQueue = function() {
    $http.post("leavequeue", {})
      .then(function(response) {
        ctrl.currentQueue = null;
        getUpdates(null);
        ctrl.getQueues();
      }, function(response) {

      });
  };

  ctrl.getQueues = function() {
    $http.get("getqueues")
      .then(function(response) {
        ctrl.queueList = response.data;
      }, function(response) {

      });
  };

  function handleUpdate(update) {
    console.log(update);
    if (update.status) {
      ctrl.status = update.status;
    }
    if (update.type == "queue") {
      ctrl.currentQueue = {users: update.users, size: update.size};
    }
  }

  var last_id = 0;
  function getUpdates(callback) {
    $http.get("/updates?id=" + last_id)
      .then(function(response) {
        for (var i = 0; i < response.data.updates.length; i++) {
          handleUpdate(response.data.updates[i]);
          last_id = response.data.updates[i].id;
        }
        if (callback) {
          callback();
        }
      }, function(response) {
        // TODO: handle error
      });
  }

  function startUpdates() {
    ctrl.getQueues();
    (function tick() {
      getUpdates(function() {
        $timeout(tick, 1000);
      });
    })();
  }
}]);