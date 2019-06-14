FROM node:latest
RUN apt-get update
RUN apt-get install -y sudo git nano curl

WORKDIR /opt/
RUN git clone https://github.com/fartcoin-project/MiningPool.git

WORKDIR /opt/MiningPool
RUN npm install
RUN npm update
RUN rm -rf pool_configs
RUN rm config_example.json

RUN ln -s /opt/config/config.json /opt/MiningPool/config.json
RUN ln -s /opt/config/pool_configs /opt/MiningPool/pool_configs

RUN apt-get install -y redis-server

CMD service redis-server restart; node init.js
