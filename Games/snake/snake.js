var req = new XMLHttpRequest();
var url = window.location.href.replace(window.location.pathname, "");
var pos1 = 0
var pos2 = 0
var xzpomme = []
var xptemp = null
var zptemp = null
var soc = 20
var nob = 1
var nobl = []
var nobl2 = []
var pomme = null
var direction = 'pause'
var canvas;
var ctx2d;
var timermouvement;
var shkermit = new Image();
shkermit.src = "/Picture/3 TeteShkermit RTX.png";
var apple = new Image();
apple.src = "apple.png";
var pause = false;
var time = 120;

Object.prototype.removeItem = function (key) {
   if (!this.hasOwnProperty(key))
      return
   if (isNaN(parseInt(key)) || !(this instanceof Array))
      delete this[key]
   else
      this.splice(key, 1)
};

function ActionTimer(){
  if(direction == 'est'){
	   pos1 = pos1 + soc
  }else if(direction == 'west'){
	   pos1 = pos1 - soc
  }else if(direction == 'nord'){
     pos2 = pos2 - soc
  }else if(direction == 'sud'){
     pos2 = pos2 + soc
  }
  nobl.push(pos1);
  nobl2.push(pos2);
  ctx.drawImage(shkermit,pos1,pos2,soc,soc);
  ctx.fillStyle = "GreenYellow"
  ctx.fillRect(nobl[nobl.length-2], nobl2[nobl2.length-2] ,soc,soc)
  checkloose();
  if (checkpomme()) fnpomme();else fndelqueue();
  if (nobl.length-2 > 0) {
    document.getElementById('score').innerHTML = "score : " + (nobl.length-2);
  }else{
    document.getElementById('score').innerHTML = "";
  }
}

function fndelqueue(){
  delx=nobl.shift();
  delz=nobl2.shift();
  ctx.fillStyle = "#424A4A";
  ctx.fillRect(delx,delz,soc,soc);
}

function fnpomme(){
  err=1;
  while (err>0) {
  	err=0
  	var rnum = Math.floor(Math.random() * 30)
  	var anum = Math.floor(Math.random() * 40)
  	xptemp=rnum*soc
  	zptemp=anum*soc
  	for (var i=0; i<nobl.length;i++) {
      	  if (xptemp == nobl[i] && zptemp == nobl2[i]) err++;
  	}
  	for (var i=0; i<xzpomme.length;i++) {
      	  if (xptemp == xzpomme[i]['x'] && zptemp == xzpomme[i]['z']) err++;
  	}
  }
  xzpomme.push({"x": xptemp, "z":zptemp});
  ctx.drawImage(apple,xzpomme[xzpomme.length-1]['x'],xzpomme[xzpomme.length-1]['z'],soc,soc);
}

function checkpomme(){
  var Return = false;
  for (var i=0; i<xzpomme.length;i++) {
    console.log(xzpomme.length)
    if(xzpomme[i]['x'] == pos1 && xzpomme[i]['z'] == pos2) {
      xzpomme.removeItem(i);
      Return = true;
    }
  }
  return Return;
}



function checkloose(){
  loose=false;

  if(pos1 >= canvas.width | pos2 >= canvas.height | pos1 < 0 | pos2 < 0) loose=true;
  for (var i=0; i<nobl.length-1;i++) {
    if (pos1 == nobl[i] && pos2 == nobl2[i]) loose=true;
  }

  if (loose) {
    //stop games
    direction = 'pause';
    clearInterval(timermouvement);

    //print your score
    ctx.fillStyle = "black"
    ctx.font = "30px Arial";
    ctx.fillText("You Lose", 100, 250);
    ctx.fillText("Score: "+(nobl.length-3) , 100, 290);

    //Enregistrement score
    req.open("POST", "/Games/snake/Score.php",false);
    req.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    req.DONE;
    req.send('pseudo='+prompt("Quelle est votre pseudo ? ")+'&score='+(nobl.length-3));

    //print Best Scores
    req.open("GET", "/Games/snake/BestScore.php",false);
    req.DONE;
    req.send(null);

    var listeScore = req.responseText.split('<br>')

    for(i = 0;i<8;i++){
      ctx.font = "20px Arial";
      ctx.fillText(listeScore[i] , 100,330+(30*i));
    }
  }
}

function fnstart(){
  canvas = document.getElementById("dessin");
  ctx = canvas.getContext("2d");


  ctx.fillStyle = "#424A4A"
  ctx.fillRect(0, 0 ,canvas.width, canvas.height)

  direction = 'est'
  pos1=soc;
  pos2=0;

  ctx.drawImage(shkermit,pos1,pos2,soc,soc);

  nobl = [ 0, pos1 ];
  nobl2 = [ 0, pos2 ];

  xzpomme = []

  fnpomme();

  timermouvement = setInterval(function(){ActionTimer()},time);
}

function fntouche(e){
  var touche = e.keyCode;

  if (direction == 'pause') {
	   if(touche == 32) fnstart();
  } else {
  	switch(touche) {
		case 39: case 68: direction = 'est'; break;
		case 37: case 65:direction = 'west'; break;
		case 38: case 87: direction = 'nord'; break;
		case 40: case 83: direction = 'sud'; break;
  		case 32 : fnpause(); break;
  	}
  }
}

function fnpause(){
	if(direction != 'pause'){
		if(!pause) {
			clearInterval(timermouvement);
			pause = !pause;
		}else {
			timermouvement = setInterval(function(){ActionTimer()},120);
			pause = !pause;
		}
	};

}
