FROM <CI-REGISTRY>/lifecycle-automation/devsecops-tools/runtime-components/runtime-images-ubuntu/nginx:1.24.0-v1

COPY ./dist/ /srv/www/htdocs/nnp-km-sov/
COPY default.conf /etc/nginx/conf.d/default.conf
