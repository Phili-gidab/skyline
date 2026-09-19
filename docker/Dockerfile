# Local stand-in for the Yegara cPanel host: Apache + PHP 8.3 with the same
# extensions the API uses (PDO MySQL, GD, fileinfo, curl) and .htaccess on.
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpng-dev libjpeg62-turbo-dev libwebp-dev \
 && docker-php-ext-configure gd --with-jpeg --with-webp \
 && docker-php-ext-install -j"$(nproc)" gd pdo_mysql \
 && a2enmod rewrite headers \
 && sed -ri 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf \
 && printf "upload_max_filesize=12M\npost_max_size=14M\nmemory_limit=256M\n" > /usr/local/etc/php/conf.d/skyline.ini \
 && mkdir -p /var/www/html/uploads /var/www/private \
 && chown -R www-data:www-data /var/www/html/uploads /var/www/private \
 && rm -rf /var/lib/apt/lists/*
