<!DOCTYPE html>
<html lang="<?php $lang = explode(";",$_SERVER['HTTP_ACCEPT_LANGUAGE']);if ( strpos($lang[0],'fr') !== false) $lang = 'fr';else $lang = 'en';echo $lang;?>">
  <head>
    <title>Shkermit | Games</title>
    <?php INCLUDE '/var/www/shkermit/template/Head.html'; ?>
    <style>
    a{
      color: white;
      text-decoration: none;
      font-size: 25px;
    }
    </style>
  </head>
  <body>
    <?php INCLUDE '/var/www/shkermit/template/menu.html'; ?>
    <div id="body">
      <br>
    	<a href="snake">snake</a><br>
      <br>
    	<a href="Pacman">Pacman</a>
      <br><br><br><br>
      <br><br><br><br>
      <br><br><br><br>
      <br><br><br><br>
      <br><br><br><br>
    </div>
    <?php INCLUDE '/var/www/shkermit/template/footer.html'; ?>
  </body>
</html>
