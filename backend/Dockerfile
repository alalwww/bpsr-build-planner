# ローカル動作確認用(本番デプロイには使わない。デプロイは.github/workflows/deploy-backend.ymlが
# FTPで直接public/をアップロードする)。PHP 7.4 + Apache + mod_rewriteを本番環境に合わせて再現する。
FROM php:7.4-apache

RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite \
    # デフォルトのAllowOverride Noneのままだとpublic/.htaccess(拡張子非表示・直アクセス制限)が
    # 一切適用されず、本番と異なる挙動になってしまうため上書きする。
    && sed -i 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf
