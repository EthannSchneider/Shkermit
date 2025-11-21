<!DOCTYPE html>
<html>
   <head>
      <title>Shkermit | Jeux | Snake</title>
      <link rel="icon" type="image/png" href="/Shkermit.png" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script type="text/javascript" src="snake.js"></script>
      <style>
      body, html {
          height: 100%;
          width: 100%;

      }

      /*
	     canvas
      */

      #dessin{
        border: 1px solid black;
        background-color: #424A4A;
        height: 90%;
        width: auto;
      }

      @media (max-width: 700px) {
        #dessin{
          height: auto;
          width: 90%;
        }
      }

      /*Retour */

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


      /*Controler */

      .controler{
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
   <body style="background-color: black;text-align: center;margin: 0px;padding: 0px;" onkeydown="fntouche(event)">
    <a href="..">
      <img id="retour" src="../retour.png" alt="retour">
    </a>
    <canvas id="dessin" width="600" height="800" onclick="if(direction == 'pause') fnstart();">Indisponnible</canvas>
    <p style="color: white;font-family:arial;" id="score"></p>
    <div class="controler">
      <img id="flecheHaut" src="../flecheHaut.png" alt="" onclick="direction = 'nord';"><br> 
      <img id="flecheGauche" src="../flecheGauche.png" alt="" onclick="direction = 'west';">
      <img id="pause" src="../pause.png" alt="" onclick="fnpause()">
      <img id="flecheDroite" src="../flecheDroite.png" alt="" onclick="direction = 'est';"><br>
      <img id="flecheBas" src="../flecheBas.png" alt="" onclick="direction = 'sud';">
    </div>
   </body>
</html>
