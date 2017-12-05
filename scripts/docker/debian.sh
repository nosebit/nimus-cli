#!/usr/bin/env bash

# instal docker
if command -v docker 2>/dev/null; then
    echo ">> docker already installed"
else
    echo ">> installing docker ..."
    
    sudo apt-get -y update

    sudo apt-get -y install \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg2 \
        software-properties-common
    
    curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg | sudo apt-key add -
    
    sudo add-apt-repository \
        "deb [arch=amd64] https://download.docker.com/linux/$(. /etc/os-release; echo "$ID") \
        $(lsb_release -cs) \
        stable"

    sudo apt-get -y update

    sudo apt-get -y install docker-ce
fi