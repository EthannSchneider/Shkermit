<!DOCTYPE html>
<html lang="<?php $lang = explode(";",$_SERVER['HTTP_ACCEPT_LANGUAGE']);if ( strpos($lang[0],'fr') !== false) $lang = 'fr';else $lang = 'en';echo $lang;?>">
  <head>
    <title>Shkermit | Error 403</title>
    <?php INCLUDE '/var/www/shkermit/template/Head.html'; ?>
  </head>
  <body>
    <?php INCLUDE '/var/www/shkermit/template/menu.html'; ?>
    <div id="body">
      <h1> Error 403 </h1>
      <br><br><br>
      <br><br><br>
      <br><br><br>
      <br><br><br>
      <br><br><br>
    </div>
    <?php INCLUDE '/var/www/shkermit/template/footer.html'; ?>
  </body>
</html>
