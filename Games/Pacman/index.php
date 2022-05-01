<!DOCTYPE html>
<html>
   <head>
      <title>Shkermit | Games | Pacman</title>
      <link rel="icon" type="image/png" href="/Shkermit.png" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script type="text/javascript" src="pacman.js"></script>
      <style>
      body, html{
        background-color: black;
        text-align: center;
        padding: 0px;
        margin: 0px;
        height: 100%;
        width: 100%;
      }

      /*
      retour page principale
      */
      #retour{
        position: fixed;
        top:5px;
        left:5px;
        width: 3%;
      }

      @media (max-width: 700px) {
        #retour{
          width: 7%;
        }
      }

      /*
      Canvas
      */
      #dessin{
        height: 90%;
        width: auto;
      }

      @media (max-width: 700px) {
        #dessin{
          height: auto;
          width: 90%;
        }
      }

      /*
      game controller
      */
      controler{
        position: fixed;
        bottom:0;
        right: 0;
        text-align: center;
      }

      .controler > img{
        width: 20%;
      }

    	@media (min-width: 850px) {
    	  .controler{
    	    display: none;
    	  }
    	}
      </style>
   </head>
   <body onkeydown="fntouche(event)">
    <a href="..">
     <img id="retour" src="../retour.png" alt="retour">
    </a>
    <canvas id="dessin" onclick="if(direction == 'pause') fnstart(); //clickcan(event)" width="870" height="900" style="border:1px solid black;background-color:#444f">Indisponnible</canvas>
    <script>
if(window.navigator.userAgent.search(/(MSIE|Trident|Edge)/)> -1){
  alert("Vous utilisez un navigateur de MERDE !!\n Veuillez utiliser un autre navigateur S'IL VOUS PLAIT !!!!");
  document.location='https://www.mozilla.org/fr/firefox/new/';
}
    </script>
    <div class="controler">
      <img id="flecheHaut" src="../flecheHaut.png" alt="" onclick='if(!wall.includes(pacmancoordX+" "+(pacmancoordY-pixel))){direction = "nord";}'><br>
      <img id="flecheGauche" src="../flecheGauche.png" alt="" onclick='if(!wall.includes((pacmancoordX-pixel)+" "+pacmancoordY)){direction = "west";}'>
      <img id="flecheDroite" src="../flecheDroite.png" alt="" onclick='if(!wall.includes((pacmancoordX+pixel)+" "+pacmancoordY)){direction = "est";}'><br>
      <img id="flecheBas" src="../flecheBas.png" alt="" onclick='if(!wall.includes(pacmancoordX+" "+(pacmancoordY+pixel))){direction = "sud";}'>
    </div>

   </body>
</html>
