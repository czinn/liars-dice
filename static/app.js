// Helper functions for cyrpto protocol
function hash(data) {
  var sha = new jsSHA("SHA-512", "TEXT");
  sha.update(data);
  return sha.getHash("HEX");
}

function getSeed(cs) {
  return hash(cs.sort().join(""));
}

function getPublic(s, c) {
  return hash(s + c);
}

function getPrivate(s, k) {
  return hash(s + k);
}

function getDice(h) {
  var num = parseInt(h.substring(0, 8), 16)
  var dice = [];
  console.log(num);
  for (var i = 0; i < 5; i++) {
    dice.push(num % 6 + 1);
    num = (num - num % 6) / 6;
  }
  return dice;
}

// Game helper functions

// returns true if b is a valid bet after a
function betCompare(a, b) {
  return a == null || a.count > 0 && ((b.count == 0 && b.face == 0) || b.count > a.count || (b.count == a.count && b.face > a.face));
}

function byProperty(prop) {
  return function(a, b) {
    return ((a[prop] < b[prop]) ? -1 : ((a[prop] > b[prop]) ? 1 : 0));
  };
}

function shortId(token) {
  return token.split("-")[0];
}

// Angular app
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
  ctrl.currentGame = null;
  var gameStateCache = null;

  if (old_token.length > 0) {
    $http.get("/status")
      .then(function(response) {
        ctrl.token = old_token;
        ctrl.username = response.data.username; // should be the same
        ctrl.status = response.data.status;
        if (ctrl.status.substring(0, 5) == "queue") {
          ctrl.currentQueue = response.data.queue;
        } else if(ctrl.status.substring(0, 4) == "game") {
          gameStateCache = null;
          ctrl.currentGame = response.data.game;
          console.log(response.data);
        }
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

  // A nice representation of the game state that's easier to display
  ctrl.gameState = function() {
    var g = ctrl.currentGame;
    if (!g) {
      return "";
    }
    if (gameStateCache) {
      return JSON.stringify(gameStateCache);
    }
    var users = {};
    var bets = [];

    var cheater = null; // Changed to user id if someone is breaking the rules somehow
    // (shouldn't happen because server is also doing checks, but client checks as well)

    for (var i = 0; i < g.users.length; i++) {
      var u = g.users[i];
      users[u.id] = {name: u.name, ready: false, rolled: false, revealed: false, d: null, c: null, k: null, dice: null, turn_order: null, is_self: u.id == shortId(ctrl.token)};
    }

    var ds = [];
    var cs = [];
    var ks = [];
    var state = 0; // 0 is waiting for ready, 1 is waiting for Cs (rolling), 2 is betting, 3 is waiting for reveals, 4 is waiting for ready after reveal
    var curbet = null;
    for (var i = 0; i < g.state.length; i++) {
      var act = g.state[i];
      if (act.type == "d") {
        if (state != 0 || users[act.id].d != null) {
          cheater = act.id;
        }
        users[act.id].d = act.value;
        users[act.ready] = true;
        ds.push(act.value);
        if (ds.length == g.users.length) {
          state = 1;
        }
      } else if(act.type == "c") {
        // Verify that it matches the announed d
        if (state != 1 || hash(act.value) != users[act.id].d) {
          cheater = act.id;
        }
        users[act.id].c = act.value;
        users[act.id].rolled = true;
        cs.push(act.value);
        if (cs.length == g.users.length) {
          state = 2;
        }
      } else if(act.type == "bet") {
        if (state == 2 && betCompare(curbet, act)) {
          bets.push(act);
          if (act.count == 0 && act.face == 0) {
            state = 3;
          }
        } else {
          cheater = act.id;
        }
      } else if(act.type == "k") {
        if (state != 3 || hash(act.value) != users[act.id].c) {
          cheater = act.id;
        }
        users[act.id].k = act.value;
        users[act.id].revealed = true;
        ks.push(act.value);
        if (ks.length == g.users.length) {
          state = 4;
        }
      }
    }

    var seed = state >= 2 ? getSeed(cs) : null;

    if (seed) {
      // Set own k even if not revealed and then calculate dice for all users possible, as well as turn_order
      var ownK = window.localStorage["k"];
      users[shortId(self.token)].k = ownK;
      for (var i = 0; i < g.users.length; i++) {
        var u = g.users[i];
        users[u.id].turn_order = getPublic(s, users[u.id].c);
        if(users[u.id].k) {
          users[u.id].dice = getDice(getPrivate(s, users[u.id].k));
        }
      }
    }

    var sortedUsers = [];
    for (var u in users) {
      sortedUsers.push(users[u]);
    }
    if (seed) {
      sortedUsers.sort(byProperty("turn_order"));
    }

    var obj = {
      "users": sortedUsers,
      "state": state,
      "bets": bets,
      "self": users[shortId(ctrl.token)]
    };
    gameStateCache = obj;
    return JSON.stringify(obj);
  };

  function handleUpdate(update) {
    console.log(update);
    if (update.status) {
      ctrl.status = update.status;
    }
    if (update.type == "queue") {
      ctrl.currentQueue = update.queue;
    }
    if (update.type == "game") {
      ctrl.currentQueue = null;
      gameStateCache = null;
      ctrl.currentGame = update.game;
    }
  }

  var last_id = 0;
  function getUpdates(callback) {
    $http.get("/updates?id=" + last_id)
      .then(function(response) {
        if (response.data.error) {
          // TODO: handle error
          console.log(response.data);
          return;
        }
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