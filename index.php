<!DOCTYPE html>
<html lang="<?php $lang = explode(";",$_SERVER['HTTP_ACCEPT_LANGUAGE']);if ( strpos($lang[0],'fr') !== false) $lang = 'fr';else $lang = 'en';echo $lang;?>">
  <head>
    <title>Shkermit</title>
    <?php INCLUDE '/var/www/shkermit/template/Head.html'; ?>
    <style>
    /*page intern style*/
    #body > img {
      width: 30%;
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
      <img src="Shkermit.png" alt="">
      <p style="color:rgba(0, 0, 0, 0);">J<a style="text-decoration:none;color:rgba(0, 0, 0, 0);" href="https://www.instagram.com/shkermit/">a</a><a style="text-decoration:none;color:rgba(0, 0, 0, 0);" href="https://www.instagram.com/mon_petit_jardin_secret__/">a</a>J</p>
    </div>
    <?php INCLUDE '/var/www/shkermit/template/footer.html'; ?>
  </body>
</html>
