var express = require('express');
var app = express();
var counter = 0;
var BALL_SPEED = 10;
var WIDTH = 1100;
var HEIGHT = 580;
var TANK_INIT_HP = 100;

app.use(express.static(__dirname + '/www'));

var server = app.listen(process.env.PORT || 3000, function () {
	var port = server.address().port;
	console.log('Server running at port %s', port);
});

var io = require('socket.io')(server);

function GameServer(){
	this.tanks = [];
	this.balls = [];
	this.lastBallId = 0;
}

GameServer.prototype = {

	addTank: function(tank){
		this.tanks.push(tank);
	},

	addBall: function(ball){
		this.balls.push(ball);
	},

	removeTank: function(tankId){
			this.tanks = this.tanks.filter( function(t){return t.id != tankId} );
	},

		syncTank: function(newTankData){
		this.tanks.forEach( function(tank){
			if(tank.id == newTankData.id){
				tank.x = newTankData.x;
				tank.y = newTankData.y;
				tank.baseAngle = newTankData.baseAngle;
				tank.cannonAngle = newTankData.cannonAngle;
			}
		});
	},

	
	syncBalls: function(){
		var self = this;
				this.balls.forEach( function(ball){
			self.detectCollision(ball);

			if(ball.x < 0 || ball.x > WIDTH
				|| ball.y < 0 || ball.y > HEIGHT){
				ball.out = true;
			}else{
				ball.fly();
			}
		});
	},


	detectCollision: function(ball){
		var self = this;

		this.tanks.forEach( function(tank){
			if(tank.id != ball.ownerId
				&& Math.abs(tank.x - ball.x) < 30
				&& Math.abs(tank.y - ball.y) < 30){
								self.hurtTank(tank);
				ball.out = true;
				ball.exploding = true;
			}
		});
	},

	hurtTank: function(tank){
		tank.hp -= 2;
	},

	getData: function(){
		var gameData = {};
		gameData.tanks = this.tanks;
		gameData.balls = this.balls;

		return gameData;
	},

	cleanDeadTanks: function(){
		this.tanks = this.tanks.filter(function(t){
			return t.hp > 0;
		});
	},

	cleanDeadBalls: function(){
		this.balls = this.balls.filter(function(ball){
			return !ball.out;
		});
	},

	increaseLastBallId: function(){
		this.lastBallId ++;
		if(this.lastBallId > 1000){
			this.lastBallId = 0;
		}
	}

}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}

var game = new GameServer();



io.on('connection', function(client) {
	console.log('User connected');

	client.on('joinGame', function(tank){
		console.log(tank.name + ' joined the game');
		var initX = getRandomInt(40, 900);
		var initY = getRandomInt(40, 500);
		var tankId = guid();

		client.emit('addTank', { id: tankId, name: tank.name, type: tank.type, isLocal: true, x: initX, y: initY, hp: TANK_INIT_HP });
		client.broadcast.emit('addTank', { id: tankId, name: tank.name, type: tank.type, isLocal: false, x: initX, y: initY, hp: TANK_INIT_HP} );

		game.addTank({ id: tankId, name: tank.name, type: tank.type, hp: TANK_INIT_HP});
	});

	client.on('sync', function(data){
				if(data.tank != undefined){
			game.syncTank(data.tank);
		}
		
		game.syncBalls();
		
		client.emit('sync', game.getData());
		client.broadcast.emit('sync', game.getData());

				game.cleanDeadTanks();
		game.cleanDeadBalls();
		counter ++;
	});

	client.on('shoot', function(ball){
		var ball = new Ball(ball.ownerId, ball.alpha, ball.x, ball.y );
		game.addBall(ball);
	});

	client.on('leaveGame', function(tankId){
		console.log(tankId + ' has left the game');
		game.removeTank(tankId);
		client.broadcast.emit('removeTank', tankId);
	});

});

function Ball(ownerId, alpha, x, y){
	this.id = game.lastBallId;
	game.increaseLastBallId();
	this.ownerId = ownerId;
	this.alpha = alpha;
	this.x = x;
	this.y = y;
	this.out = false;
}

Ball.prototype = {

	fly: function(){
			var speedX = BALL_SPEED * Math.sin(this.alpha);
		var speedY = -BALL_SPEED * Math.cos(this.alpha);
		this.x += speedX;
		this.y += speedY;
	}

};

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min)) + min;
}
