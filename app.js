
var express = require('express');
var app = express();
var serv = require('http').Server(app);
var path = require('path');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/client/index.html');

});
app.use('/client', express.static(__dirname + '/client'));

serv.listen(2000);
console.log("Server started on port 2000.");

var io = require('socket.io')(serv, {});

var SOCKET_LIST = {};

var Entity = function(){
  var self = {
    x: 250,
    y: 250,
    spdX: 0,
    spdY: 0,
    id: "",
  }
  self.update = function(){
    self.updatePosition();
  }
  self.updatePosition = function(){
    self.x += self.spdX;
    self.y += self.spdY;
  }
  return self;
}

var Player = function(id){
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(1000 * Math.random());
    self.pressingRight = false;
    self.pressingLeft = false;
    self.pressingDown = false;
    self.pressingUp = false;
    self.maxSpd = 10;

  var super_update = self.update;
  self.update = function(){
    self.updateSpeed();
    super_update();
  }

  self.updateSpeed = function(){
    if(self.pressingRight){
      self.spdX = self.maxSpd;
    }
    else if(self.pressingLeft){
      self.spdX = -self.maxSpd;
    }
    else{
      self.spdX = 0;
    }

    if( self.pressingUp ){
      self.spdY = -self.maxSpd;
    }
    else if(self.pressingDown ){
      self.spdY = self.maxSpd;
    }
    else{
      self.spdY = 0;
    }
  }
  Player.list[id] = self;

  return self;
}
Player.list = {};

Player.onConnect = function(socket){
  var player = Player(socket.id);
  socket.on("keyPress", function(data){
    if( data.id === "right"){
      player.pressingRight = data.state;
    }
    if( data.id === "left"){
      player.pressingLeft = data.state;
    }
    if( data.id === "up"){
      player.pressingUp = data.state;
    }
    if( data.id === "down"){
      player.pressingDown = data.state;
    }
  });

}

Player.onDisconnect = function(socket){
    delete Player.list[socket.id];
}

Player.update = function(){
  var pack = [];
  for(var i in Player.list){
    var player = Player.list[i];
    player.update();
    pack.push({
      x: player.x,
      y: player.y,
      num: player.number
    })
  }
  return pack;
}


io.sockets.on("connection", function(socket){

  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;

  Player.onConnect(socket);

  socket.on('disconnect', function(){
    delete SOCKET_LIST[socket.id];
    Player.onDisconnect(socket);
    for(var i in SOCKET_LIST){
      SOCKET_LIST[i].emit("lobbylist", Player.list);
    }
  });

  socket.on("sendMessageToServer", function(data){
    var name = Player.list[socket.id].number;
    for( var i in SOCKET_LIST){
      SOCKET_LIST[i].emit("addToChat", { player: name, message: data });
    }
  });

  for(var i in SOCKET_LIST){
    SOCKET_LIST[i].emit("lobbylist", Player.list);
  }

});

setInterval(function(){
  var pack = Player.update();

  for( var i in SOCKET_LIST){
    var socket = SOCKET_LIST[i];
    socket.emit('newPositions', pack);
  }
},1000/25)
