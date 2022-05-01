<!DOCTYPE html>
<html lang="<?php $lang = explode(";",$_SERVER['HTTP_ACCEPT_LANGUAGE']);if ( strpos($lang[0],'fr') !== false) $lang = 'fr';else $lang = 'en';echo $lang;?>">
  <head>
    <title>Shkermit | Picture</title>
    <?php INCLUDE '/var/www/shkermit/template/Head.html'; ?>
    <style>
    /*page intern style*/
    #body > img {
      width: 40%;
    }

    @media (max-width: 730px) {
      #body > img {
        width: 70%;
      }
    }
    </style>
  </head>
  <body>
    <?php INCLUDE '/var/www/shkermit/template/menu.html'; ?>
    <div id="body">
      <img src="../Shkermit.png" alt="shkermit" class="img"/> <br>
      <?php
      if ($dossier = opendir(dirname(__FILE__).'/')) {
        while (($item = readdir($dossier)) !== false) {
          if ($item[0] == '.') { continue; }
          $tmp = explode('.', $item);
          if (!in_array(end($tmp), array('jpg','jpeg','png','gif'))) { continue; }
          $liste[] = '	<img class="img" src="'.$item.'" alt="'.$item.'" />';
        }
        closedir($dossier);
      }
      echo implode("<br> \n", $liste);
      ?>
    </div>
    <?php INCLUDE '/var/www/shkermit/template/footer.html'; ?>
  </body>
</html>
