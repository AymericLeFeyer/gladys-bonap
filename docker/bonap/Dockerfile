# Bonap image adapted to the Gladys sub-container sandbox.
#
# Gladys drops every Linux capability. The upstream image runs nginx as root
# and its workers switch to the `nginx` user (setuid/initgroups), which fails
# without CAP_SETUID/CAP_SETGID. This variant runs everything as uid 1000 (the
# owner of the volumes Gladys precreates), on port 8080, with the pid file in
# /tmp. Nothing else changes: same entrypoint, same env vars.

ARG BONAP_VERSION=1.4.2
FROM ghcr.io/aymericlefeyer/bonap:${BONAP_VERSION}

RUN sed -i '/^user[[:space:]]/d' /etc/nginx/nginx.conf \
 && sed -i 's#^pid[[:space:]].*#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf \
 && sed -i 's/listen 80;/listen 8080;/' /etc/nginx/templates/default.conf.template \
 && grep -q 'listen 8080;' /etc/nginx/templates/default.conf.template \
 && mkdir -p /data \
 && chown -R 1000:1000 /var/cache/nginx /etc/nginx/conf.d /usr/share/nginx/html /data

USER 1000:1000
EXPOSE 8080
