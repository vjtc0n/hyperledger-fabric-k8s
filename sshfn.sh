#!/bin/bash

#
# Copyright KBank Corp All Rights Reserved
#
# SPDX-License-Identifier: Apache-2.0
#
# export so other script can access

build(){
  echo "Try to install sshpass:"
  # bash ./sshpass/install-sh  
  cd sshpass
  ./configure
  sudo make install
  # echo "apt-get install sshpass"
  # echo "brew install https://raw.githubusercontent.com/kadwanev/bigboybrew/master/Library/Formula/sshpass.rb"
}

if [ ! `command -v sshpass` ];then
  build
  exit
fi

CONFIG=$1
first=${CONFIG%%@*}
last=${CONFIG##*@}
user=${first%%:*}
passwd=${first##*:}
server=${last%%:*}
base_dir=${last##*:}
shift
if [[ $1 == "sync" ]];then
  path=${2:-$PWD}
  echo "Sync folder to server"
  sshpass -p $passwd rsync -chavP --stats --exclude '.git' \
    --exclude '**/node_modules/' \
    --exclude '**/vendor/' \
    --exclude 'bin' \
    --exclude 'admin/hfc-key-store' \
    --exclude 'setupCluster/crypto-config' \
    --exclude 'setupCluster/channel-artifacts' \
    $path/ $user@$last
elif [[ $1 == "build" ]]; then
  #statements
  build
elif [[ $1 == "--" ]];then
  shift
  QUERY="$@"
sshpass -p $passwd ssh -t $user@$server "sudo su <<\EOF
$base_dir/fn.sh $QUERY
EOF"
else
  echo "Unknow command $1" 1>&2
fi


